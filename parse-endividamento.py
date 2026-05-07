#!/usr/bin/env python3
"""
parse-endividamento.py — Extrai endividamento bancario do Razao Contabil

Cliente JCE pediu (Ajustes BI Global, secao 2.5):
  - Separar emprestimo banco vs fornecedor (estavam misturados em CP)
  - Drill por instituicao (Itau, Sicredi, Bradesco, BB...)
  - Saldo atual + movimentacao + ultima data por banco

Plano de contas Solution mapeado (de full_ledger.parquet):
  2.01.01 EMPRESTIMOS E FINANCIAMENTOS                  (curto prazo)
  2.01.02 BENS FINANCIADOS- CREDITO BANCARIO            (CP, financiamento de bens)
  2.01.05 DUPLICATAS DESCONTADAS                        (CP, antecipacao de receivables)
  2.03.01 OBRIGACOES A LONGO PRAZO                      (LP, emprestimos)

NAO inclui:
  2.01.03.01 FORNECEDORES (esses ficam em outra view)
  2.01.04   ADIANTAMENTO DE CLIENTES (passivo operacional, nao bancario)
  Mutuo intercompany (DC TRACTOR / GLOBALMAC / DC MAQUINAS) — separado em "Intercompany"
    (cliente quer ver, mas nao misturar com banco)

Output: data/endividamento.json
"""
import re
import json
from pathlib import Path
from collections import defaultdict
import pandas as pd

ROOT = Path("C:/Projects/jce-bi-web")
OUT = ROOT / "data"
LEDGER = OUT / "full_ledger.parquet"

# Sinteticas que representam endividamento bancario
SINT_REGEX = r"^2\.01\.0[125]|^2\.03\.01"

# Classifica banco por regex no conta_nome
def detect_bank(nome: str) -> str:
    """Retorna nome canonico do banco a partir do conta_nome do plano de contas.
    Mojibake comum: ITA� = ITAU (ç) — normalizamos antes."""
    if not nome:
        return "NAO IDENTIFICADO"
    n = nome.upper()
    # Normaliza mojibake (latin-1 -> ?) — caracteres comuns do plano JCE
    n = n.replace("Ã€", "A").replace("�", "U").replace("?", "U")
    # Mutuo intercompany — nao e banco
    if "MUTUO" in n:
        return "INTERCOMPANY"
    # Ordem matters: ITAU antes que generico
    if "ITAU" in n or n.startswith("BANCO ITA") or "ITA U" in n:
        return "ITAU"
    if "BRADESCO" in n:
        return "BRADESCO"
    if "SICREDI" in n:
        return "SICREDI"
    if "SICOOB" in n:
        return "SICOOB"
    if "SANTANDER" in n:
        return "SANTANDER"
    if "BANCO DO BRASIL" in n or n.startswith("BB ") or "BB GIRO" in n:
        return "BANCO DO BRASIL"
    if "BNDES" in n:
        return "BNDES"
    if "FINAME" in n:
        return "FINAME"
    if "CAIXA" in n:
        return "CAIXA ECONOMICA"
    if "BANCO GM" in n:
        return "BANCO GM"
    if "DLL" in n or "DE LAGE LANDEN" in n:
        return "DLL"
    if "SECURITIZADORA" in n or "FID SECURITIZADOR" in n or "DUL DESCONTADA" in n:
        return "SECURITIZADORA"
    if "NBC" in n:
        return "NBC BANK"
    if "AMERICA TRADING" in n or "AMÉRICA" in n:
        return "AMERICA TRADING"
    if "EMPRESTIMOS DE TERCEIROS" in n or "PJ " in n:
        return "TERCEIROS"
    return "OUTROS"


def detect_contrato(nome: str) -> str:
    """Extrai numero de contrato/conta do nome quando possivel."""
    if not nome:
        return ""
    # Numeros tipo "16217-1", "C32631124-2", "237/3271/584609", "149.706.317"
    m = re.search(r"(?:CONTR\.?\s*|CTA\s*|N[°ºªR]\.?\s*|NR\.?\s*)?([A-Z]?\d[\d.\-/\s]{4,})", nome)
    if m:
        return m.group(1).strip()[:30]
    return ""


def is_lp(sint_codigo: str) -> bool:
    return str(sint_codigo).startswith("2.03")


def main():
    print("=== Parsing endividamento bancario ===")
    df = pd.read_parquet(LEDGER)
    print(f"  Ledger total: {len(df):,} rows")

    mask = df["sint_codigo"].astype(str).str.match(SINT_REGEX)
    emp = df[mask].copy()
    print(f"  Lcto endividamento (2.01.01/02/05 + 2.03.01): {len(emp):,}")

    # Detecta banco
    emp["banco"] = emp["conta_nome"].apply(detect_bank)
    emp["contrato_id"] = emp["conta_nome"].apply(detect_contrato)
    emp["prazo"] = emp["sint_codigo"].apply(lambda c: "LP" if is_lp(c) else "CP")

    # Saldo atual de cada conta = ultimo saldo (por data) ja com sinal natural
    # Em conta passivo, saldo C (credor) = divida; saldo D = credito (raro)
    emp_sorted = emp.sort_values(["empresa", "conta_id", "data", "lancto"])
    last_per_conta = emp_sorted.groupby(["empresa", "empresa_label", "conta_id", "conta_nome",
                                          "sint_codigo", "sint_nome", "banco", "contrato_id", "prazo"]).agg(
        saldo_atual=("saldo", "last"),
        ultima_data=("data", "max"),
        primeira_data=("data", "min"),
        n_lctos=("lancto", "count"),
        movimentacao_periodo=("valor_abs", "sum"),
        ultimo_dc=("d_c", "last"),
    ).reset_index()

    # Em conta passivo, se ultimo d_c = 'C', saldo positivo = divida em aberto
    # Se 'D', saldo positivo = saldo devedor da conta (credito a receber, raro em passivo)
    # Convenção do BI: divida e SEMPRE numero positivo (a pagar). Saldo D em passivo = inverter sinal.
    last_per_conta["saldo_atual"] = last_per_conta.apply(
        lambda r: r["saldo_atual"] if r["ultimo_dc"] == "C" else -r["saldo_atual"],
        axis=1
    )

    print(f"\n  Contas distintas: {len(last_per_conta)}")
    print(f"  Distribuicao por banco:")
    bcounts = last_per_conta.groupby("banco").size().sort_values(ascending=False)
    print(bcounts.to_string())

    # === Construir output ===

    # Por empresa: agregacao por banco
    EMPRESAS_LABEL = {"1": "GLOBALMAC", "2": "DCTRACTOR", "4": "DCCOMERCIO"}
    por_empresa = {}
    for emp_cod, emp_label in EMPRESAS_LABEL.items():
        sub = last_per_conta[last_per_conta["empresa"] == emp_cod].copy()
        if len(sub) == 0:
            por_empresa[emp_cod] = {
                "empresa": emp_label,
                "instituicoes": [],
                "contratos": [],
                "total_dividas_banco": 0,
                "total_intercompany": 0,
                "total_consolidado": 0,
                "n_contratos": 0,
            }
            continue

        sub_banco = sub[sub["banco"] != "INTERCOMPANY"].copy()
        sub_inter = sub[sub["banco"] == "INTERCOMPANY"].copy()

        # Por banco (agrupa contratos)
        instituicoes = []
        for banco, g in sub_banco.groupby("banco"):
            instituicoes.append({
                "banco": banco,
                "saldo_atual": float(round(g["saldo_atual"].sum(), 2)),
                "saldo_cp": float(round(g[g["prazo"] == "CP"]["saldo_atual"].sum(), 2)),
                "saldo_lp": float(round(g[g["prazo"] == "LP"]["saldo_atual"].sum(), 2)),
                "movimentacoes_periodo": float(round(g["movimentacao_periodo"].sum(), 2)),
                "n_contratos": int(len(g)),
                "ultima_data": str(g["ultima_data"].max())[:10] if g["ultima_data"].max() else None,
            })
        instituicoes.sort(key=lambda x: x["saldo_atual"], reverse=True)

        # Lista de contratos individuais (drill)
        contratos = []
        for _, r in sub.sort_values("saldo_atual", ascending=False).iterrows():
            contratos.append({
                "conta_id": r["conta_id"],
                "conta_nome": r["conta_nome"],
                "banco": r["banco"],
                "contrato_id": r["contrato_id"],
                "prazo": r["prazo"],
                "saldo_atual": float(round(r["saldo_atual"], 2)),
                "movimentacao_periodo": float(round(r["movimentacao_periodo"], 2)),
                "n_lctos": int(r["n_lctos"]),
                "primeira_data": str(r["primeira_data"])[:10] if r["primeira_data"] else None,
                "ultima_data": str(r["ultima_data"])[:10] if r["ultima_data"] else None,
            })

        total_banco = sum(i["saldo_atual"] for i in instituicoes)
        total_inter = float(round(sub_inter["saldo_atual"].sum(), 2))

        por_empresa[emp_cod] = {
            "empresa": emp_label,
            "instituicoes": instituicoes,
            "contratos": contratos,
            "total_dividas_banco": float(round(total_banco, 2)),
            "total_intercompany": total_inter,
            "total_consolidado": float(round(total_banco + total_inter, 2)),
            "total_cp": float(round(sub_banco[sub_banco["prazo"] == "CP"]["saldo_atual"].sum(), 2)),
            "total_lp": float(round(sub_banco[sub_banco["prazo"] == "LP"]["saldo_atual"].sum(), 2)),
            "n_contratos": int(len(sub_banco)),
        }

    # Consolidado: por banco somando 3 empresas
    consolidado_banco = last_per_conta[last_per_conta["banco"] != "INTERCOMPANY"].groupby("banco").agg(
        saldo_atual=("saldo_atual", "sum"),
        movimentacoes=("movimentacao_periodo", "sum"),
        n_contratos=("conta_id", "count"),
        n_empresas=("empresa", "nunique"),
    ).reset_index().sort_values("saldo_atual", ascending=False)

    por_banco_consolidado = []
    for _, r in consolidado_banco.iterrows():
        # Detalhe por empresa
        sub = last_per_conta[(last_per_conta["banco"] == r["banco"]) & (last_per_conta["banco"] != "INTERCOMPANY")]
        por_empresa_detalhe = {}
        for emp_cod in EMPRESAS_LABEL:
            v = sub[sub["empresa"] == emp_cod]["saldo_atual"].sum()
            por_empresa_detalhe[emp_cod] = float(round(v, 2))
        por_banco_consolidado.append({
            "banco": r["banco"],
            "saldo_atual": float(round(r["saldo_atual"], 2)),
            "movimentacoes_periodo": float(round(r["movimentacoes"], 2)),
            "n_contratos": int(r["n_contratos"]),
            "n_empresas": int(r["n_empresas"]),
            "por_empresa": por_empresa_detalhe,
        })

    # Movimentacao mensal (pra cronograma) — soma valor_abs por mes/banco
    mov_mensal = emp[emp["banco"] != "INTERCOMPANY"].copy()
    mov_mensal["ano_mes"] = mov_mensal["data"].dt.strftime("%Y-%m")
    movs_por_mes = mov_mensal.groupby(["ano_mes", "banco"]).agg(
        movimentacao=("valor_abs", "sum"),
        n=("lancto", "count"),
    ).reset_index().sort_values("ano_mes")

    # Total geral (3 empresas, so banco)
    total_banco_geral = sum(p["total_dividas_banco"] for p in por_empresa.values())
    total_inter_geral = sum(p["total_intercompany"] for p in por_empresa.values())

    out = {
        "fetched_at": pd.Timestamp.now().isoformat(),
        "fonte": "Razao contabil (sintetica 2.01.01 EMPRESTIMOS+FINANCIAMENTOS, "
                 "2.01.02 BENS FINANCIADOS, 2.01.05 DUPLICATAS DESCONTADAS, "
                 "2.03.01 OBRIGACOES A LONGO PRAZO)",
        "totais_consolidados": {
            "divida_banco": float(round(total_banco_geral, 2)),
            "intercompany_pagar": float(round(total_inter_geral, 2)),
            "total_endividamento_consolidado": float(round(total_banco_geral + total_inter_geral, 2)),
            "n_instituicoes_distintas": int(len(consolidado_banco)),
            "n_contratos_distintos": int(len(last_per_conta[last_per_conta["banco"] != "INTERCOMPANY"])),
        },
        "por_empresa": por_empresa,
        "por_banco_consolidado": por_banco_consolidado,
        "movimentacao_mensal": movs_por_mes.to_dict("records"),
    }

    out_path = OUT / "endividamento.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"\n[ok] {out_path}: {out_path.stat().st_size/1024:.1f} KB")

    # Sanity print
    print("\n=== TOP 5 BANCOS (consolidado, divida atual) ===")
    for i, b in enumerate(por_banco_consolidado[:5]):
        print(f"  {i+1}. {b['banco']:<25s} R$ {b['saldo_atual']:>15,.2f}  ({b['n_contratos']} contratos)")
    print(f"\n  TOTAL DIVIDA BANCARIA:    R$ {total_banco_geral:>15,.2f}")
    print(f"  + INTERCOMPANY:           R$ {total_inter_geral:>15,.2f}")
    print(f"  = TOTAL ENDIVIDAMENTO:    R$ {total_banco_geral + total_inter_geral:>15,.2f}")
    print()
    print("=== Por empresa (so banco) ===")
    for emp_cod, p in por_empresa.items():
        print(f"  {p['empresa']:<12s} CP R$ {p['total_cp']:>14,.2f}  LP R$ {p['total_lp']:>14,.2f}  "
              f"Total R$ {p['total_dividas_banco']:>14,.2f}  ({p['n_contratos']} contratos)")


if __name__ == "__main__":
    main()
