#!/usr/bin/env python3
"""
parse-razao-completo.py — Parser do Razão Contábil COMPLETO (full ledger)

Diferente do parse antigo que só pegava CAIXA+BANCOS, este parseia TODAS as contas
(ativo, passivo, resultado) e classifica via plano de contas Solution:

Plano:
  1.x = ATIVO
    1.01.01.01-02 = caixa + bancos (físicos)
    1.01 outros   = AC (clientes, estoque, etc)
    1.04          = despesas antecipadas
    1.05          = ANC (imobilizado, intangível, depreciação)
    1.80          = contas temporárias
  2.x = PASSIVO + PL
    2.01          = PC (fornecedores, empréstimos curto, obrigações)
    2.03          = PNC (empréstimos longo)
    2.07          = PL (capital, reservas)
  3.x = RESULTADO
    3.01          = Receita Bruta
    3.02          = Deduções (impostos s/ vendas, devoluções)
    3.03          = CMV / Custos
    3.04          = Despesas Operacionais (inclui Receitas Financeiras dentro)
    3.06          = Resultado Não Operacional
    3.09          = Provisão IRPJ/CSLL

Output:
  data/full_ledger.parquet  — toda a transação (uma row por lado de cada lançamento)
  data/full_ledger.csv      — versão CSV
  data/dre_summary.json     — DRE agregada por empresa × mês × ano
"""
import re
import json
from pathlib import Path
from collections import defaultdict
import pandas as pd

ROOT = Path("C:/Projects/jce-bi-web")
ERP_DATA = Path("C:/Projects/erp-extraction/data")
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

SOURCES = [
    ("1", "GLOBALMAC",  ERP_DATA / "razao_full_emp1_GLOBALMAC.csv"),
    ("2", "DCTRACTOR",  ERP_DATA / "razao_full_emp2_DCTRACTOR.csv"),
    ("4", "DCCOMERCIO", ERP_DATA / "razao_full_emp4_DCCOMERCIO.csv"),
]

# ----------- classificação plano de contas -----------
def classify_sintetica(sint_codigo: str, sint_nome: str = "") -> str:
    """Retorna tipo (ATIVO_CAIXA, ATIVO_AC, ATIVO_ANC, PASSIVO_PC, PASSIVO_PNC, PL,
    RECEITA_BRUTA, DEDUCAO, CMV, DESPESA_OP, RECEITA_FIN, DESPESA_FIN,
    RES_NAO_OP, PROVISAO_IR, OUTROS)."""
    if not sint_codigo:
        return "OUTROS"
    cod = sint_codigo.split('.')
    if len(cod) < 2:
        return "OUTROS"
    n0, n1 = cod[0], cod[1]
    name_up = (sint_nome or "").upper()

    if n0 == "1":
        # ativo
        prefix3 = '.'.join(cod[:3]) if len(cod) >= 3 else ""
        if prefix3 in ("1.01.01",):
            # caixa, bancos, aplicações
            if "CAIXA" in name_up: return "ATIVO_CAIXA"
            if "BANCO" in name_up or "APLICA" in name_up: return "ATIVO_BANCO"
            return "ATIVO_AC"
        if n1 == "01": return "ATIVO_AC"
        if n1 == "04": return "ATIVO_AC"
        if n1 == "05": return "ATIVO_ANC"
        if n1 == "80": return "ATIVO_TEMP"
        return "ATIVO_OUTROS"
    if n0 == "2":
        if n1 == "01":
            if "EMPRESTIMO" in name_up or "FINANCIAMENTO" in name_up:
                return "PASSIVO_BANCO"
            if "FORNECEDOR" in name_up:
                return "PASSIVO_FORNECEDOR"
            return "PASSIVO_PC"
        if n1 == "03": return "PASSIVO_PNC"
        if n1 == "07": return "PL"
        return "PASSIVO_OUTROS"
    if n0 == "3":
        if n1 == "01": return "RECEITA_BRUTA"
        if n1 == "02": return "DEDUCAO"
        if n1 == "03": return "CMV"
        if n1 == "04":
            # 3.04 mistura desp e RECEITAS FINANCEIRAS
            if "RECEITA" in name_up and "FINANC" in name_up: return "RECEITA_FIN"
            if "FINANC" in name_up: return "DESPESA_FIN"
            return "DESPESA_OP"
        if n1 == "06":
            if "RECEITA" in name_up: return "RES_NAO_OP_REC"
            return "RES_NAO_OP_DESP"
        if n1 == "09": return "PROVISAO_IR"
        return "RESULTADO_OUTROS"
    return "OUTROS"


def is_resultado(tipo: str) -> bool:
    return tipo in (
        "RECEITA_BRUTA", "DEDUCAO", "CMV", "DESPESA_OP",
        "RECEITA_FIN", "DESPESA_FIN", "RES_NAO_OP_REC", "RES_NAO_OP_DESP",
        "PROVISAO_IR",
    )


# ----------- parsing CSV hierárquico -----------
def parse_money(s: str) -> float:
    if not s: return 0.0
    s = s.strip().replace('.', '').replace(',', '.')
    if not s or s == '-': return 0.0
    try: return float(s)
    except: return 0.0


def parse_data(s: str):
    if not s: return None
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', s.strip())
    if not m: return None
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"


def parse_csv_file(empresa: str, label: str, fpath: Path):
    if not fpath.exists():
        print(f"  [skip] {fpath}")
        return []
    print(f"  [reading] {label} {fpath.stat().st_size/1024/1024:.1f} MB")
    rows = []
    cur_conta_id = ""
    cur_conta_nome = ""
    cur_sint_cod = ""
    cur_sint_nome = ""
    cur_tipo = ""

    with open(fpath, encoding='latin-1') as f:
        for raw in f:
            if not raw.strip():
                continue
            parts = raw.rstrip('\n').split(';')
            parts = [p.strip() for p in parts]

            # Conta header: 'Conta;ID;NOME;[;]Sintética;COD NAME;'
            if parts[0] == "Conta" and len(parts) >= 4:
                cur_conta_id = parts[1]
                cur_conta_nome = parts[2]
                # localiza sintética: campo após "Sintética"
                cur_sint_cod = ""
                cur_sint_nome = ""
                for i, p in enumerate(parts):
                    if p.lower().startswith("sint") and i + 1 < len(parts):
                        m = re.match(r'^([\d\.]+)\s*(.*)$', parts[i + 1])
                        if m:
                            cur_sint_cod = m.group(1).rstrip('.')
                            cur_sint_nome = m.group(2).strip()
                        break
                cur_tipo = classify_sintetica(cur_sint_cod, cur_sint_nome)
                continue

            # Skip non-data rows
            if not cur_conta_id:
                continue
            # Saldo anterior single line
            if len(parts) >= 8 and parts[6] == "Saldo anterior" and parts[0] == "":
                continue
            # Totalizador
            if parts[0] == "Saldo anterior":
                continue
            # cabeçalhos diversos
            if parts[0] in ("Emp", "Emp ") or parts[0].startswith("CNPJ") or parts[0].startswith("Sint"):
                continue

            # Lançamento — espera 12+ colunas
            if len(parts) >= 9:
                emp_lcto = parts[0].strip()
                data = parse_data(parts[1])
                if not data:
                    continue
                lancto = parts[2].strip()
                lote = parts[3].strip()
                filial = parts[4].strip()
                v_deb = parse_money(parts[5])
                v_cre = parse_money(parts[6])  # vem com sinal negativo no CSV
                saldo = parse_money(parts[7])
                d_c = parts[8].strip()
                ctp_full = parts[9] if len(parts) > 9 else ""
                cta_vinc = parts[10] if len(parts) > 10 else ""
                hist = ";".join(parts[11:]) if len(parts) > 11 else ""

                # contrapartida
                ctp_cod = ""
                ctp_nome = ""
                m = re.match(r'^(\d+)\s+(.+)$', ctp_full)
                if m:
                    ctp_cod = m.group(1)
                    ctp_nome = m.group(2).strip()
                else:
                    ctp_nome = ctp_full

                # extrai cliente/fornecedor + centro custo do histórico
                cliente = ""
                cc_id = ""
                cc_nome = ""
                op = ""
                nf_num = ""

                m_nf = re.search(r"Vlr\.NFiscal\s+nro\.?:\s*(\S+)", hist)
                if m_nf: nf_num = m_nf.group(1).strip()

                m_op = re.search(r"Opera[çc][aã]o\s*=\s*(\S+)\s+de\s+([A-Z][^\n]*?)(?:\s+modelo fiscal|\s+tipo pagto|\s+cod\.tabela|\s+centro de custo|$)", hist)
                if m_op:
                    op = m_op.group(1).strip()
                    cliente = m_op.group(2).strip()

                m_cc = re.search(r"centro\s+de\s+custo\s*=\s*(\d+)\s*-\s*([A-Z\sÀ-Ú]+?)(?:,|$)", hist, re.I)
                if m_cc:
                    cc_id = m_cc.group(1).strip()
                    cc_nome = m_cc.group(2).strip()

                rows.append({
                    "empresa": empresa,
                    "empresa_label": label,
                    "data": data,
                    "lancto": lancto,
                    "lote": lote,
                    "filial": filial,
                    "valor_debito": v_deb,
                    "valor_credito": v_cre,  # negativo
                    "valor": v_deb + v_cre,  # delta líquido
                    "valor_abs": abs(v_deb + v_cre),
                    "saldo": saldo,
                    "d_c": d_c,
                    "conta_id": cur_conta_id,
                    "conta_nome": cur_conta_nome,
                    "sint_codigo": cur_sint_cod,
                    "sint_nome": cur_sint_nome,
                    "tipo": cur_tipo,
                    "ctp_codigo": ctp_cod,
                    "ctp_nome": ctp_nome,
                    "cta_vinc": cta_vinc,
                    "cliente": cliente,
                    "cc_id": cc_id,
                    "cc_nome": cc_nome,
                    "operacao": op,
                    "nf": nf_num,
                    "historico": hist[:500],
                })
    return rows


# ----------- main -----------
print("=== Parsing Razão completo ===")
all_rows = []
for emp, label, path in SOURCES:
    rows = parse_csv_file(emp, label, path)
    print(f"  {label}: {len(rows):,} rows")
    all_rows.extend(rows)

print(f"\n  Total: {len(all_rows):,} rows")
df = pd.DataFrame(all_rows)
df["data"] = pd.to_datetime(df["data"], errors="coerce")
df["ano"] = df["data"].dt.year
df["mes"] = df["data"].dt.month
df["ano_mes"] = df["data"].dt.strftime("%Y-%m")

# Stats
print("\n=== Distribuição por TIPO ===")
print(df.groupby("tipo").agg(
    n=("lancto", "count"),
    total_abs=("valor_abs", "sum"),
).sort_values("total_abs", ascending=False).round(2))

print("\n=== Por empresa ===")
print(df.groupby("empresa_label").agg(
    n=("lancto", "count"),
    total_abs=("valor_abs", "sum"),
    n_meses=("ano_mes", "nunique"),
).round(2))

# DRE — só lançamentos do lado RESULTADO (cada lcto aparece 1x assim — dedupe natural)
df_dre = df[df["tipo"].apply(is_resultado)].copy()
print(f"\n=== DRE rows ({len(df_dre):,}) ===")

# Para receitas/dedução: SOMA crédito (entrada) menos débito (saída). 3.01 normal cresce em CRÉDITO.
# Para custos/despesas: SOMA débito menos crédito. 3.03/3.04 cresce em DÉBITO.
# Convenção: usar valor_abs e sinal por tipo.
SIGN = {
    "RECEITA_BRUTA": +1,    # entrada
    "DEDUCAO":       -1,    # redução de receita
    "CMV":           -1,    # saída
    "DESPESA_OP":    -1,    # saída
    "RECEITA_FIN":   +1,    # entrada
    "DESPESA_FIN":   -1,
    "RES_NAO_OP_REC": +1,
    "RES_NAO_OP_DESP": -1,
    "PROVISAO_IR":   -1,
}

# Para cada lcto do tipo resultado, se d_c=='C' e tipo='RECEITA_*' → entrada
# se d_c=='D' e tipo='DESPESA_*' → saída
# Vamos só usar valor_abs e aplicar SIGN[tipo]

df_dre["resultado_signed"] = df_dre.apply(
    lambda r: SIGN.get(r["tipo"], 0) * abs(r["valor"]), axis=1
)

# DRE consolidada por empresa × mês
dre_by_month = df_dre.groupby(["empresa", "empresa_label", "ano_mes", "tipo"])["resultado_signed"].sum().reset_index()
print("\n=== DRE primeiros meses ===")
print(dre_by_month.head(30))

# Salvar
print("\n=== Salvando ===")
df.to_parquet(OUT / "full_ledger.parquet", index=False)
print(f"  full_ledger.parquet: {(OUT / 'full_ledger.parquet').stat().st_size/1024/1024:.1f} MB ({len(df):,} rows)")

dre_by_month.to_parquet(OUT / "dre_by_month.parquet", index=False)
df_dre.to_parquet(OUT / "dre_lancamentos.parquet", index=False)

# DRE summary JSON
summary = {
    "fetched_at": pd.Timestamp.now().isoformat(),
    "n_rows_full_ledger": len(df),
    "n_rows_dre": len(df_dre),
    "by_empresa": df.groupby("empresa_label").agg(
        n=("lancto", "count"),
        total_abs=("valor_abs", "sum"),
    ).to_dict("index"),
    "dre_consolidado_por_tipo": df_dre.groupby("tipo")["resultado_signed"].sum().to_dict(),
    "dre_consolidado_total": {
        "receita_bruta":   df_dre[df_dre["tipo"] == "RECEITA_BRUTA"]["valor_abs"].sum(),
        "deducoes":        df_dre[df_dre["tipo"] == "DEDUCAO"]["valor_abs"].sum(),
        "cmv":             df_dre[df_dre["tipo"] == "CMV"]["valor_abs"].sum(),
        "despesa_op":      df_dre[df_dre["tipo"] == "DESPESA_OP"]["valor_abs"].sum(),
        "receita_fin":     df_dre[df_dre["tipo"] == "RECEITA_FIN"]["valor_abs"].sum(),
        "despesa_fin":     df_dre[df_dre["tipo"] == "DESPESA_FIN"]["valor_abs"].sum(),
        "res_nao_op_rec":  df_dre[df_dre["tipo"] == "RES_NAO_OP_REC"]["valor_abs"].sum(),
        "res_nao_op_desp": df_dre[df_dre["tipo"] == "RES_NAO_OP_DESP"]["valor_abs"].sum(),
        "provisao_ir":     df_dre[df_dre["tipo"] == "PROVISAO_IR"]["valor_abs"].sum(),
    },
}
# DRE calculada
t = summary["dre_consolidado_total"]
t["receita_liquida"]    = t["receita_bruta"] - t["deducoes"]
t["margem_bruta"]       = t["receita_liquida"] - t["cmv"]
t["resultado_op"]       = t["margem_bruta"] - t["despesa_op"]
t["resultado_fin"]      = t["receita_fin"] - t["despesa_fin"]
t["res_nao_op"]         = t["res_nao_op_rec"] - t["res_nao_op_desp"]
t["resultado_antes_ir"] = t["resultado_op"] + t["resultado_fin"] + t["res_nao_op"]
t["lucro_liquido"]      = t["resultado_antes_ir"] - t["provisao_ir"]
t["margem_liquida"]     = (t["lucro_liquido"] / t["receita_liquida"] * 100) if t["receita_liquida"] > 0 else 0
t["margem_ebitda_caixa"] = (t["resultado_op"] / t["receita_liquida"] * 100) if t["receita_liquida"] > 0 else 0

(OUT / "dre_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8")

# ====== Exporta agregações para o BI consumir via build-data.cjs ======
# bi_data.json contém TUDO que o BI precisa, em formato JSON-friendly

# Agregação por (empresa × ano_mes × tipo) — pra DRE mensal
dre_pivot = df_dre.groupby(["empresa", "ano_mes", "tipo"]).agg(
    valor_signed=("resultado_signed", "sum"),
    valor_abs=("valor_abs", "sum"),
    n=("lancto", "count"),
).reset_index()

# Agregação por (empresa × ano_mes) — totais mensais para charts
month_totals = df_dre.groupby(["empresa", "ano_mes"]).apply(
    lambda g: pd.Series({
        "receita_bruta":   g[g["tipo"] == "RECEITA_BRUTA"]["valor_abs"].sum(),
        "deducoes":        g[g["tipo"] == "DEDUCAO"]["valor_abs"].sum(),
        "cmv":             g[g["tipo"] == "CMV"]["valor_abs"].sum(),
        "despesa_op":      g[g["tipo"] == "DESPESA_OP"]["valor_abs"].sum(),
        "receita_fin":     g[g["tipo"] == "RECEITA_FIN"]["valor_abs"].sum(),
        "despesa_fin":     g[g["tipo"] == "DESPESA_FIN"]["valor_abs"].sum(),
        "provisao_ir":     g[g["tipo"] == "PROVISAO_IR"]["valor_abs"].sum(),
        "n_lctos":         len(g),
    }), include_groups=False
).reset_index()

month_totals["receita_liquida"] = month_totals["receita_bruta"] - month_totals["deducoes"]
month_totals["margem_bruta"]    = month_totals["receita_liquida"] - month_totals["cmv"]
month_totals["resultado_op"]    = month_totals["margem_bruta"] - month_totals["despesa_op"]
month_totals["resultado_fin"]   = month_totals["receita_fin"] - month_totals["despesa_fin"]
month_totals["lucro_liquido"]   = month_totals["resultado_op"] + month_totals["resultado_fin"] - month_totals["provisao_ir"]

# Top categorias por empresa (Receita e Despesa) — agrupando por sint_nome (nível 4)
top_receita = df_dre[df_dre["tipo"] == "RECEITA_BRUTA"].groupby(["empresa", "sint_nome"]).agg(
    valor=("valor_abs", "sum"), n=("lancto", "count")
).reset_index().sort_values("valor", ascending=False)

top_cmv = df_dre[df_dre["tipo"] == "CMV"].groupby(["empresa", "sint_nome"]).agg(
    valor=("valor_abs", "sum"), n=("lancto", "count")
).reset_index().sort_values("valor", ascending=False)

top_despesa = df_dre[df_dre["tipo"] == "DESPESA_OP"].groupby(["empresa", "sint_nome"]).agg(
    valor=("valor_abs", "sum"), n=("lancto", "count")
).reset_index().sort_values("valor", ascending=False)

# Top fornecedores (CMV + DESPESA): cliente=fornecedor extraído do histórico
top_fornecedores = df_dre[df_dre["tipo"].isin(["CMV", "DESPESA_OP"]) & (df_dre["cliente"] != "")].groupby(
    ["empresa", "cliente"]).agg(valor=("valor_abs", "sum"), n=("lancto", "count")).reset_index().sort_values("valor", ascending=False)

# Top clientes (RECEITA): cliente do histórico
top_clientes = df_dre[(df_dre["tipo"] == "RECEITA_BRUTA") & (df_dre["cliente"] != "")].groupby(
    ["empresa", "cliente"]).agg(valor=("valor_abs", "sum"), n=("lancto", "count")).reset_index().sort_values("valor", ascending=False)

# Top categorias / centros de custo de despesa (pra drill-down Opex)
top_cc_despesa = df_dre[df_dre["tipo"] == "DESPESA_OP"].groupby(
    ["empresa", "cc_nome"]).agg(valor=("valor_abs", "sum"), n=("lancto", "count")).reset_index().sort_values("valor", ascending=False)

# Saldo caixa atual (último valor da conta de cada filial)
saldos_atuais = None
sp = OUT / "saldos_razao.json"
if sp.exists():
    try:
        saldos_atuais = json.loads(sp.read_text(encoding="utf-8"))
    except Exception:
        saldos_atuais = None

bi_data = {
    "fetched_at": pd.Timestamp.now().isoformat(),
    "ref_year": int(df["ano"].dropna().max()) if len(df) else 2026,
    "available_years": sorted(df["ano"].dropna().unique().astype(int).tolist(), reverse=True),
    "available_months": sorted(df["ano_mes"].dropna().unique().tolist()),
    "empresas": [
        {"codigo": "1", "label": "GLOBALMAC", "razao_social": "GLOBAL MAC COM. E SERV. DE MÁQ. E TRATORES LTDA"},
        {"codigo": "2", "label": "DCTRACTOR", "razao_social": "DC TRACTOR COM. E SERV. DE MÁQ. E TRATORES LTDA"},
        {"codigo": "4", "label": "DCCOMERCIO", "razao_social": "DC COMERCIO DE MAQUINAS LTDA"},
    ],
    "dre_consolidado": summary["dre_consolidado_total"],
    "month_totals": month_totals.to_dict("records"),
    "dre_pivot": dre_pivot.to_dict("records"),
    "top_receita_por_empresa": top_receita.to_dict("records"),
    "top_cmv_por_empresa": top_cmv.to_dict("records"),
    "top_despesa_por_empresa": top_despesa.to_dict("records"),
    "top_fornecedores": top_fornecedores.head(50).to_dict("records"),
    "top_clientes": top_clientes.head(50).to_dict("records"),
    "top_cc_despesa": top_cc_despesa.to_dict("records"),
}

(OUT / "bi_data.json").write_text(json.dumps(bi_data, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
print(f"\n[ok] bi_data.json: {(OUT / 'bi_data.json').stat().st_size/1024:.1f} KB")

# ====== ALL_TX RAZÃO DE CAIXA — só lcto do lado CAIXA+BANCO (sint 1.01.01.x) ======
# Cliente exige Razão CAIXA (não contábil completo). Filtra rows onde lado primário
# é conta caixa+banco. Categoria mostrada = contrapartida (de onde veio / pra onde foi).
# Schema tuple: [kind, ymonth, dia, categoria, cliente, valor, realizado, fornecedor, centroCusto, empresa, sint_codigo, conta_caixa]
df_caixa = df[df["sint_codigo"].astype(str).str.startswith("1.01.01")].copy()
print(f"\n=== RAZÃO CAIXA (lado caixa+banco) ===")
print(f"  {len(df_caixa):,} lcto · {df_caixa['valor_abs'].sum():,.2f} total movimentação")
print(df_caixa.groupby(["empresa_label", "sint_nome"]).agg(
    n=("lancto", "count"),
    total=("valor_abs", "sum"),
).round(2))

all_tx_caixa = []
for r in df_caixa.itertuples(index=False):
    if not r.data or pd.isna(r.data):
        continue
    valor = abs(r.valor) if r.valor else 0
    if not valor:
        continue
    # kind: D = entrada de caixa (recebimento) → 'r'; C = saída → 'd'
    # No lado caixa, Débito = entra dinheiro (cliente paga, banco transfere etc)
    # Crédito = sai dinheiro (paga fornecedor, transfere pra outro banco)
    if r.valor_debito > 0 and r.valor_credito == 0:
        kind = "r"  # entrada
    elif r.valor_credito < 0 and r.valor_debito == 0:
        kind = "d"  # saída
    else:
        # ambos zero ou ambos com valor — descartar (consistência)
        continue
    ymonth = r.data.strftime("%Y-%m")
    # Categoria = nome da contrapartida (pra onde foi o dinheiro)
    categoria = (r.ctp_nome or "").upper()[:60]
    # Cliente extraído do histórico do lcto (regex já aplicado no parser)
    parte = (r.cliente or "")[:60]
    cliente = parte if kind == "r" else ""
    fornecedor = parte if kind == "d" else ""
    all_tx_caixa.append([
        kind, ymonth, int(r.data.day),
        categoria,
        cliente, round(valor, 2),
        1,
        fornecedor,
        (r.cc_nome or "")[:30],
        str(r.empresa),
        r.sint_codigo or "",
        (r.conta_nome or "")[:60],
    ])

(OUT / "all_tx.json").write_text(json.dumps(all_tx_caixa, ensure_ascii=False), encoding="utf-8")
print(f"[ok] all_tx.json (CAIXA): {(OUT / 'all_tx.json').stat().st_size/1024/1024:.1f} MB ({len(all_tx_caixa):,} rows)")

# Soma por empresa pra sanity (deve estar próximo do contábil)
from collections import defaultdict
totais = defaultdict(lambda: {"r": 0, "d": 0})
for t in all_tx_caixa:
    totais[t[9]][t[0]] += t[5]
print(f"\n  Totais Razão Caixa por empresa:")
for emp, tot in totais.items():
    label = next((e[1] for e in [("1","GLOBALMAC"),("2","DCTRACTOR"),("4","DCCOMERCIO")] if e[0]==emp), emp)
    print(f"    {label}: receitas R$ {tot['r']:,.2f} · despesas R$ {tot['d']:,.2f}")

print("\n=== DRE CONSOLIDADA (3 empresas) ===")
print(f"  Receita Bruta:        R$ {t['receita_bruta']:>15,.2f}")
print(f"  (-) Deduções:         R$ {t['deducoes']:>15,.2f}")
print(f"  Receita Líquida:      R$ {t['receita_liquida']:>15,.2f}")
print(f"  (-) CMV:              R$ {t['cmv']:>15,.2f}")
print(f"  Margem Bruta:         R$ {t['margem_bruta']:>15,.2f}")
print(f"  (-) Despesas Op:      R$ {t['despesa_op']:>15,.2f}")
print(f"  Resultado Op (EBIT):  R$ {t['resultado_op']:>15,.2f}")
print(f"  Resultado Financ:     R$ {t['resultado_fin']:>15,.2f}")
print(f"  Resultado Não Op:     R$ {t['res_nao_op']:>15,.2f}")
print(f"  Resultado antes IR:   R$ {t['resultado_antes_ir']:>15,.2f}")
print(f"  (-) Provisão IRPJ:    R$ {t['provisao_ir']:>15,.2f}")
print(f"  ============================================")
print(f"  Lucro Líquido:        R$ {t['lucro_liquido']:>15,.2f}")
print(f"  Margem Líquida:           {t['margem_liquida']:>14.2f}%")
print(f"  Margem EBITDA caixa:      {t['margem_ebitda_caixa']:>14.2f}%")

print(f"\n[ok] arquivos em {OUT}")
