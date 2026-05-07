"""
parse-balancete-pdf.py

NOTE: The PDFs from the contador are scanned images (no text layer), so we
use the official Razao Contabil CSVs (which have the same chart of accounts
and final balances) as the source-of-truth instead. The CSVs are the same
source data used to print the balancete PDF — they list every analytical
account with its closing balance per the Brazilian standard chart of
accounts (1.x = Ativo, 2.x = Passivo+PL, 3.x = Resultado).

Output: data/balancete_oficial.json with structure:
{
  "<empresa>": {
    "periodo": "JAN-FEV 2026",
    "moeda": "BRL",
    # Aggregated groups
    "ativo_circulante":             ...,
    "ativo_realizavel_lp":          ...,
    "ativo_nao_circulante":         ...,
    "ativo_imobilizado":            ...,
    "ativo_total":                  ...,
    "passivo_circulante":           ...,
    "passivo_nao_circulante":       ...,
    "patrimonio_liquido":           ...,
    "passivo_pl_total":             ...,
    # Subgroups for liquidez
    "disponivel":                   ...,  # caixa + bancos + aplic. liq. imediata
    "estoques":                     ...,
    "clientes":                     ...,
    "emprestimos_financiamentos_pc":  ...,
    "emprestimos_financiamentos_pnc": ...,
    "fornecedores":                 ...,
    # Resultado (jan+fev 2026)
    "receita_bruta":                ...,
    "deducoes_receita":             ...,
    "receita_liquida":              ...,
    "cmv":                          ...,
    "lucro_bruto":                  ...,
    "despesas_operacionais":        ...,
    "resultado_financeiro":         ...,
    "lucro_liquido_periodo":        ...,
    # Raw groups for inspection
    "grupos": { "<codigo>": {"name": ..., "saldo": ..., "natureza": "D"|"C"} }
  }
}
"""
from __future__ import annotations
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent
OUT  = ROOT / "data" / "balancete_oficial.json"

CSV_GLOBALMAC = ROOT / "data" / "contabil" / "GLOBALMAC Razao contabil JAN A FEV 2026.csv"
CSV_DC_TRACTOR = ROOT / "data" / "contabil" / "DC Trator razão contábil jan a fev 2026.csv"


def parse_value(s: str) -> float:
    """'12.345,67' or '-12345,67' or '   1234,56  ' -> float."""
    s = s.strip()
    if not s:
        return 0.0
    # Brazilian: thousands sep '.', decimal ','
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_csv(path: Path) -> list[dict]:
    """
    Returns list of accounts with:
      num, name, grupo_codigo (e.g. '1.01.01.01'), grupo_nome,
      saldo_signed (positive = D natural, negative = C natural)
    """
    contas = []
    current = None
    with open(path, "r", encoding="latin-1") as f:
        for raw in f:
            line = raw.rstrip("\r\n")
            parts = line.split(";")

            # Header of a new account
            if line.startswith("Conta;"):
                # Conta;<num>;<name>;[Sintetica/Analitica;]?<grupo desc>;
                num = parts[1].strip() if len(parts) > 1 else ""
                name = parts[2].strip() if len(parts) > 2 else ""
                grupo_field = None
                for p in parts[3:]:
                    p = p.strip()
                    if re.match(r"^\d+\.\d", p):
                        grupo_field = p
                        break
                grupo_codigo = ""
                grupo_nome = ""
                if grupo_field:
                    sp = grupo_field.split(" ", 1)
                    grupo_codigo = sp[0]
                    grupo_nome = sp[1] if len(sp) > 1 else ""
                current = {
                    "num": num,
                    "name": name,
                    "grupo_codigo": grupo_codigo,
                    "grupo_nome": grupo_nome,
                    "saldo_signed": None,
                }
                contas.append(current)
                continue

            if current is None:
                continue

            # Closing line WITH movement:
            #   "Saldo anterior;<X>;Débitos;<Y>;Créditos;<Z>;Saldo período;<W>;Atual;<A>;"
            # X and A are signed (positive = D, negative = C).
            if line.startswith("Saldo anterior;") and "Atual" in parts:
                idx = parts.index("Atual")
                if idx + 1 < len(parts):
                    val = parse_value(parts[idx + 1])
                    current["saldo_signed"] = val
                continue

            # Closing line WITHOUT movement:
            #   ";;;;;;Saldo anterior;<X>;<D|C>;"
            # X is absolute, sign comes from the D/C indicator.
            if "Saldo anterior" in parts and current["saldo_signed"] is None:
                idx = parts.index("Saldo anterior")
                if idx + 1 < len(parts):
                    val = parse_value(parts[idx + 1])
                    dc = parts[idx + 2].strip() if idx + 2 < len(parts) else "D"
                    if dc == "C":
                        val = -val
                    current["saldo_signed"] = val
                continue

    # Drop accounts that never produced a closing line
    contas = [c for c in contas if c["saldo_signed"] is not None and c["grupo_codigo"]]
    return contas


def starts_with_any(code: str, prefixes: tuple[str, ...]) -> bool:
    return any(code == p or code.startswith(p + ".") for p in prefixes)


def aggregate(contas: list[dict]) -> dict:
    """
    Aggregate accounts into balance-sheet groups using the Brazilian
    chart of accounts code structure observed in the CSVs:

      1.01.x.x      Ativo Circulante
        1.01.01.x    Disponivel (Caixa, Bancos, Aplicacoes Liq. Imediata)
        1.01.02.x    Clientes / Cartoes / Cheques
        1.01.03.x    Outros creditos / Adiantamentos / Impostos a recuperar
        1.01.06.x    Estoques
        1.01.08.x    Outros estoques (Demonstracao, Conserto, etc.)
      1.04.x        Despesas Antecipadas (Realizavel a LP / AC dependendo do plano)
      1.05.x        Ativo Nao Circulante (Investimentos, Imobilizado, Intangivel)
        1.05.01.x    Realizavel a LP (Creditos com pessoas ligadas)
        1.05.03.x    Investimentos / Imobilizado / Depreciacao
        1.05.05.x    Intangivel
      1.80.x        Contas Temporarias  (descartadas — nao integram balanco)

      2.01.x        Passivo Circulante
        2.01.01     Emprestimos e Financiamentos
        2.01.02     Bens Financiados (CDC bancario)
        2.01.03     Fornecedores
        2.01.04     Adiantamento de Clientes
        2.01.05     Duplicatas Descontadas
        2.01.10     Obrigacoes Trabalhistas
        2.01.15     Obrigacoes Fiscais
        2.01.20     Outras Obrigacoes
        2.01.45     Parcelamentos
        2.01.70     Provisoes
      2.03.x        Passivo Nao Circulante
        2.03.01     Obrigacoes a LP (incluindo emprestimos LP)
      2.05.x        Contas de Compensacao  (descartadas)
      2.07.x        Patrimonio Liquido
        2.07.01     Capital Social
        2.07.03     Reservas
        2.07.05     Resultados Acumulados / Ajustes

      3.01.x        Receitas (saldo natural C => signed negativo)
      3.02.x        Deducoes da receita (saldo natural D => signed positivo)
      3.03.x        Custos (CMV) (D => positivo)
      3.04.x ->    Despesas operacionais e financeiras (D => positivo)

    Signed convention used here:
      ativo_xxx, disponivel, clientes, estoques: positive number = saldo natural D
      passivo_xxx, pl, fornecedores, etc.:       positive number = saldo natural C

    Implementation: we keep saldo_signed (D positivo, C negativo). For ATIVO
    we sum saldo_signed directly (a contra-asset like Depreciacao Acumulada
    has C balance and reduces the total naturally). For PASSIVO/PL we sum
    -saldo_signed (so credit balances become positive).
    """

    # Group totals
    groups = defaultdict(lambda: {"name": "", "saldo_d_signed": 0.0, "n": 0})

    # AC subgroups
    disponivel = 0.0
    clientes = 0.0
    cartoes_cheques = 0.0
    outros_creditos_cp = 0.0
    estoques = 0.0
    despesas_antecipadas = 0.0

    # ANC subgroups
    realizavel_lp = 0.0
    investimentos = 0.0
    imobilizado_bruto = 0.0
    depreciacao_acum = 0.0  # natural C (negative when summed signed)
    intangivel = 0.0

    # PC subgroups
    pc_emp_fin = 0.0
    pc_fornec = 0.0
    pc_adiant_clientes = 0.0
    pc_dup_descontadas = 0.0
    pc_obr_trabalh = 0.0
    pc_obr_fiscais = 0.0
    pc_outras = 0.0
    pc_parcelamentos = 0.0
    pc_provisoes = 0.0

    # PNC
    pnc_obr_lp = 0.0

    # PL
    pl_capital = 0.0
    pl_reservas = 0.0
    pl_resultados = 0.0

    # DRE
    receita_bruta = 0.0      # 3.01
    deducoes = 0.0           # 3.02
    cmv = 0.0                # 3.03
    despesas_op = 0.0        # 3.04 - 3.07 (varies)
    resultado_financeiro_d = 0.0
    resultado_financeiro_c = 0.0

    for c in contas:
        code = c["grupo_codigo"]
        v = c["saldo_signed"]
        # Build groups dict (signed by D natural)
        groups[code]["name"] = c["grupo_nome"]
        groups[code]["saldo_d_signed"] += v
        groups[code]["n"] += 1

        # ===== Ativo =====
        if code.startswith("1.01.01"):
            disponivel += v
        elif code.startswith("1.01.02"):
            # 1.01.02.01 / .01.01 / .02 / .03 -> clientes + cartoes
            if "1.01.02.01" in code:
                clientes += v
            else:
                cartoes_cheques += v
        elif code.startswith("1.01.03"):
            outros_creditos_cp += v
        elif code.startswith("1.01.06") or code.startswith("1.01.08"):
            estoques += v
        elif code.startswith("1.04"):
            despesas_antecipadas += v
        elif code.startswith("1.05.01"):
            realizavel_lp += v
        elif code.startswith("1.05.03"):
            # 1.05.03.10 = Depreciacao Acum (natural C)
            if code.startswith("1.05.03.10"):
                depreciacao_acum += v
            elif code.startswith("1.05.03.01"):
                investimentos += v
            else:
                # Bens em uso, consorcios, etc -> imobilizado bruto
                imobilizado_bruto += v
        elif code.startswith("1.05.05"):
            intangivel += v
        elif code.startswith("1.80"):
            # Contas temporarias — pequenas, alocadas a outros creditos cp
            outros_creditos_cp += v

        # ===== Passivo / PL =====  (saldo natural C => v negativo => -v positivo)
        elif code.startswith("2.01.01") or code.startswith("2.01.02"):
            pc_emp_fin += -v
        elif code.startswith("2.01.03"):
            pc_fornec += -v
        elif code.startswith("2.01.04"):
            pc_adiant_clientes += -v
        elif code.startswith("2.01.05"):
            pc_dup_descontadas += -v
        elif code.startswith("2.01.10"):
            pc_obr_trabalh += -v
        elif code.startswith("2.01.15"):
            pc_obr_fiscais += -v
        elif code.startswith("2.01.20"):
            pc_outras += -v
        elif code.startswith("2.01.45"):
            pc_parcelamentos += -v
        elif code.startswith("2.01.70"):
            pc_provisoes += -v
        elif code.startswith("2.03"):
            pnc_obr_lp += -v
        elif code.startswith("2.05"):
            pass  # contas de compensacao
        elif code.startswith("2.07.01"):
            pl_capital += -v
        elif code.startswith("2.07.03"):
            pl_reservas += -v
        elif code.startswith("2.07.05"):
            pl_resultados += -v

        # ===== Resultado =====
        elif code.startswith("3.01"):
            # natural C, v negativo => receita = -v positivo
            receita_bruta += -v
        elif code.startswith("3.02"):
            deducoes += v          # natural D, positivo
        elif code.startswith("3.03"):
            cmv += v                # natural D, positivo
        elif code.startswith("3.04") or code.startswith("3.05") or code.startswith("3.06"):
            despesas_op += v        # natural D
        elif code.startswith("3.07"):
            # resultado financeiro pode ter D e C
            if v >= 0:
                resultado_financeiro_d += v
            else:
                resultado_financeiro_c += -v
        elif code.startswith("3."):
            despesas_op += v

    # Aggregates
    ativo_circulante = (
        disponivel + clientes + cartoes_cheques + outros_creditos_cp
        + estoques + despesas_antecipadas
    )
    imobilizado_liquido = imobilizado_bruto + depreciacao_acum  # depreciacao is negative-signed
    ativo_nao_circulante = realizavel_lp + investimentos + imobilizado_liquido + intangivel
    ativo_total = ativo_circulante + ativo_nao_circulante

    passivo_circulante = (
        pc_emp_fin + pc_fornec + pc_adiant_clientes + pc_dup_descontadas
        + pc_obr_trabalh + pc_obr_fiscais + pc_outras + pc_parcelamentos + pc_provisoes
    )
    passivo_nao_circulante = pnc_obr_lp

    # Lucro do periodo (DRE jan-fev)
    receita_liquida = receita_bruta - deducoes
    lucro_bruto = receita_liquida - cmv
    resultado_financeiro = resultado_financeiro_c - resultado_financeiro_d
    lucro_periodo = lucro_bruto - despesas_op + resultado_financeiro

    pl_subtotal = pl_capital + pl_reservas + pl_resultados
    # Lucro do periodo deve compor o PL (resultado do exercicio)
    pl_total = pl_subtotal + lucro_periodo

    passivo_pl_total = passivo_circulante + passivo_nao_circulante + pl_total

    return {
        "moeda": "BRL",
        "periodo": "JAN-FEV 2026",
        # Ativo
        "disponivel": round(disponivel, 2),
        "clientes": round(clientes, 2),
        "cartoes_cheques": round(cartoes_cheques, 2),
        "outros_creditos_cp": round(outros_creditos_cp, 2),
        "estoques": round(estoques, 2),
        "despesas_antecipadas": round(despesas_antecipadas, 2),
        "ativo_circulante": round(ativo_circulante, 2),
        "realizavel_lp": round(realizavel_lp, 2),
        "investimentos": round(investimentos, 2),
        "imobilizado_bruto": round(imobilizado_bruto, 2),
        "depreciacao_acumulada": round(depreciacao_acum, 2),
        "imobilizado_liquido": round(imobilizado_liquido, 2),
        "intangivel": round(intangivel, 2),
        "ativo_nao_circulante": round(ativo_nao_circulante, 2),
        "ativo_total": round(ativo_total, 2),
        # Passivo
        "emprestimos_financiamentos_pc": round(pc_emp_fin, 2),
        "fornecedores": round(pc_fornec, 2),
        "adiantamento_clientes": round(pc_adiant_clientes, 2),
        "duplicatas_descontadas": round(pc_dup_descontadas, 2),
        "obrigacoes_trabalhistas": round(pc_obr_trabalh, 2),
        "obrigacoes_fiscais": round(pc_obr_fiscais, 2),
        "outras_obrigacoes_pc": round(pc_outras, 2),
        "parcelamentos_pc": round(pc_parcelamentos, 2),
        "provisoes_pc": round(pc_provisoes, 2),
        "passivo_circulante": round(passivo_circulante, 2),
        "emprestimos_financiamentos_pnc": round(pnc_obr_lp, 2),
        "passivo_nao_circulante": round(passivo_nao_circulante, 2),
        "capital_social": round(pl_capital, 2),
        "reservas_lucros": round(pl_reservas, 2),
        "resultados_acumulados": round(pl_resultados, 2),
        "lucro_periodo": round(lucro_periodo, 2),
        "patrimonio_liquido": round(pl_total, 2),
        "passivo_pl_total": round(passivo_pl_total, 2),
        # DRE
        "receita_bruta": round(receita_bruta, 2),
        "deducoes_receita": round(deducoes, 2),
        "receita_liquida": round(receita_liquida, 2),
        "cmv": round(cmv, 2),
        "lucro_bruto": round(lucro_bruto, 2),
        "despesas_operacionais": round(despesas_op, 2),
        "resultado_financeiro": round(resultado_financeiro, 2),
        "lucro_liquido_periodo": round(lucro_periodo, 2),
        # check
        "_check_diff_ativo_vs_passivo": round(ativo_total - passivo_pl_total, 2),
        # Raw groups for inspection
        "grupos": {
            code: {"name": g["name"], "saldo_d_signed": round(g["saldo_d_signed"], 2), "n_contas": g["n"]}
            for code, g in sorted(groups.items())
        },
    }


def main():
    out = {}
    for empresa, path in [("GLOBALMAC", CSV_GLOBALMAC), ("DC_TRACTOR", CSV_DC_TRACTOR)]:
        if not path.exists():
            print(f"[skip] {path} not found", file=sys.stderr)
            continue
        contas = parse_csv(path)
        agg = aggregate(contas)
        agg["_n_contas"] = len(contas)
        out[empresa] = agg
        print(f"[{empresa}] contas: {len(contas)}  ativo: {agg['ativo_total']:,.2f}  pas+pl: {agg['passivo_pl_total']:,.2f}  diff: {agg['_check_diff_ativo_vs_passivo']:,.2f}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSaved -> {OUT}")


if __name__ == "__main__":
    main()
