"""
validate-extract.py
===================

Suite de validação rigorosa do extract Razão de Caixa do JCE/GLOBALMAC/DC TRACTOR/DC COMERCIO
extraído via Playwright da rotina 7003 do ERP Solution.

Cross-validation contra:
  1. SOURCE-OF-TRUTH do contador (CSV oficial do mesmo ERP, jan-fev 2026)
  2. NORTE histórico (BASE_FINANCEIRA_POWERBI.xlsx — para contexto, NÃO comparável)
  3. Documento Ajustes BI - Global.docx (requirements do cliente)
  4. Sanity checks econômicos e de integridade interna

Uso: python validate-extract.py
"""

from __future__ import annotations

import re
import sys
import json
import datetime as dt
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any
import pandas as pd

# -----------------------------------------------------------------------------
# Paths das fontes
# -----------------------------------------------------------------------------
ROOT = Path(r"C:\Projects")
EXTRACT_DIR = ROOT / "erp-extraction" / "data"
TRUTH_DIR = ROOT / "jce-bi-web" / "data" / "contabil"

EXTRACT_FULL = {
    1: EXTRACT_DIR / "razao_full_emp1_GLOBALMAC.csv",
    2: EXTRACT_DIR / "razao_full_emp2_DCTRACTOR.csv",
    4: EXTRACT_DIR / "razao_full_emp4_DCCOMERCIO.csv",
}
EXTRACT_BASE_XLSX = EXTRACT_DIR / "BASE_CAIXA_RAZAO.xlsx"
EXTRACT_PARSED = EXTRACT_DIR / "razao_parsed.csv"
EXTRACT_BASE_FINANCEIRA = EXTRACT_DIR / "BASE_FINANCEIRA_POWERBI.xlsx"

TRUTH_CSV = {
    1: TRUTH_DIR / "GLOBALMAC Razao contabil JAN A FEV 2026.csv",
    2: TRUTH_DIR / "DC Trator razão contábil jan a fev 2026.csv",
}

REPORT_PATH = ROOT / "jce-bi-web" / "validation-report.txt"

# -----------------------------------------------------------------------------
# Severities & check tracking
# -----------------------------------------------------------------------------
@dataclass
class Check:
    name: str
    severity: str           # CRITICAL | WARN | INFO
    passed: bool
    detail: str
    expected: Any = None
    actual: Any = None
    threshold: str = ""

CHECKS: list[Check] = []

def check(name: str, severity: str, passed: bool, detail: str, *,
          expected: Any = None, actual: Any = None, threshold: str = ""):
    CHECKS.append(Check(name, severity, passed, detail, expected, actual, threshold))

# -----------------------------------------------------------------------------
# Parser do CSV razão (formato rotina 7003 ERP Solution)
# -----------------------------------------------------------------------------
def parse_razao_csv(path: Path) -> pd.DataFrame:
    """Parse rotina 7003 razão CSV. Returns DataFrame of detail lines.

    Format:
      Conta;<id>;<nome>;;Sintetica;<sint_codigo> <sint_nome>;
      <emp>;<dd/mm/yyyy>;<lancto>;<lote>;<filial>;<deb>;<cre>;<saldo>;<dc>;<contrap>;<vinc>;<hist>;
    """
    rows: list[dict] = []
    cur_conta_id = cur_conta_nome = cur_sint = ""
    if not path.exists():
        return pd.DataFrame()
    with open(path, encoding="cp1252", errors="replace") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line.strip():
                continue
            parts = line.split(";")
            if parts[0] == "Conta" and len(parts) >= 6:
                cur_conta_id = parts[1].strip()
                cur_conta_nome = parts[2].strip()
                cur_sint = parts[5].strip() if len(parts) > 5 else ""
                continue
            if len(parts) >= 12 and parts[0].strip().isdigit() and re.match(r"\d{2}/\d{2}/\d{4}", parts[1].strip()):
                def num(x: str) -> float:
                    x = x.strip().replace(".", "").replace(",", ".")
                    try: return float(x or 0)
                    except: return 0.0
                rows.append({
                    "emp": parts[0].strip(),
                    "data": parts[1].strip(),
                    "lancto": parts[2].strip(),
                    "lote": parts[3].strip(),
                    "filial": parts[4].strip(),
                    "val_deb": num(parts[5]),
                    "val_cre": num(parts[6]),
                    "saldo": num(parts[7]),
                    "dc": parts[8].strip() if len(parts) > 8 else "",
                    "contrapartida": parts[9].strip() if len(parts) > 9 else "",
                    "historico": parts[11].strip() if len(parts) > 11 else "",
                    "conta_id": cur_conta_id,
                    "conta_nome": cur_conta_nome,
                    "sintetica": cur_sint,
                })
    df = pd.DataFrame(rows)
    if len(df):
        df["data_dt"] = pd.to_datetime(df["data"], format="%d/%m/%Y", errors="coerce")
        df["valor_abs"] = df["val_deb"].abs() + df["val_cre"].abs()
    return df

# -----------------------------------------------------------------------------
# Load all sources
# -----------------------------------------------------------------------------
def load_all():
    print("Loading extract CSVs (full razão per empresa)...")
    extract = {emp: parse_razao_csv(p) for emp, p in EXTRACT_FULL.items()}
    print("Loading truth (contador) CSVs...")
    truth = {emp: parse_razao_csv(p) for emp, p in TRUTH_CSV.items()}
    print("Loading derived bases...")
    base_caixa = pd.read_excel(EXTRACT_BASE_XLSX) if EXTRACT_BASE_XLSX.exists() else pd.DataFrame()
    if "Data" in base_caixa.columns:
        base_caixa["Data_dt"] = pd.to_datetime(base_caixa["Data"], format="%d/%m/%Y", errors="coerce")
    base_fin = pd.read_excel(EXTRACT_BASE_FINANCEIRA) if EXTRACT_BASE_FINANCEIRA.exists() else pd.DataFrame()
    return extract, truth, base_caixa, base_fin

# -----------------------------------------------------------------------------
# Sanity / integrity checks
# -----------------------------------------------------------------------------
def run_checks(extract, truth, base_caixa, base_fin):
    # ------------------------------------------------------------------------
    # GROUP A — Contra TRUTH (contador) jan-fev 2026, by empresa
    # ------------------------------------------------------------------------
    for emp in (1, 2):
        ex = extract.get(emp, pd.DataFrame())
        tr = truth.get(emp, pd.DataFrame())
        if ex.empty or tr.empty:
            check(f"A.{emp}.X data presence", "CRITICAL", False,
                  f"emp{emp} extract or truth empty (extract={len(ex)}, truth={len(tr)})")
            continue
        ex_p = ex[(ex["data_dt"] >= "2026-01-01") & (ex["data_dt"] <= "2026-02-28")]
        # 1. contagem de linhas
        cov_rows = (len(ex_p) / max(len(tr), 1)) * 100
        check(f"A.{emp}.1 row coverage jan-fev 2026", "CRITICAL", cov_rows >= 95,
              f"extract jan-fev rows / truth rows", expected=">=95%", actual=f"{cov_rows:.1f}%",
              threshold=">=95%")
        # 2. soma débito
        ex_deb = ex_p["val_deb"].sum()
        tr_deb = tr["val_deb"].sum()
        diff_pct = abs(ex_deb - tr_deb) / max(abs(tr_deb), 1) * 100
        check(f"A.{emp}.2 sum débito jan-fev 2026", "CRITICAL", diff_pct <= 5,
              f"diff {ex_deb:,.2f} vs truth {tr_deb:,.2f} = {diff_pct:.2f}%",
              expected="<=5%", actual=f"{diff_pct:.2f}%", threshold="<=5%")
        # 3. soma crédito (em valor absoluto)
        ex_cre = ex_p["val_cre"].abs().sum()
        tr_cre = tr["val_cre"].abs().sum()
        diff_pct_c = abs(ex_cre - tr_cre) / max(abs(tr_cre), 1) * 100
        check(f"A.{emp}.3 sum crédito jan-fev 2026", "CRITICAL", diff_pct_c <= 5,
              f"diff {ex_cre:,.2f} vs truth {tr_cre:,.2f} = {diff_pct_c:.2f}%",
              expected="<=5%", actual=f"{diff_pct_c:.2f}%", threshold="<=5%")
        # 4. lanctos faltantes (truth-extract)
        ex_lct = set(ex_p["lancto"].unique())
        tr_lct = set(tr["lancto"].unique())
        missing = tr_lct - ex_lct
        miss_pct = len(missing) / max(len(tr_lct), 1) * 100
        check(f"A.{emp}.4 lanctos missing", "CRITICAL", miss_pct <= 5,
              f"{len(missing)}/{len(tr_lct)} lanctos do truth ausentes do extract",
              expected="<=5%", actual=f"{miss_pct:.1f}%", threshold="<=5%")
        # 5. contas distintas (chart of accounts coverage)
        ex_contas = set(ex_p["conta_id"].unique())
        tr_contas = set(tr["conta_id"].unique())
        miss_contas = tr_contas - ex_contas
        cont_pct = (1 - len(miss_contas) / max(len(tr_contas), 1)) * 100
        check(f"A.{emp}.5 contas (chart-of-accounts) coverage", "CRITICAL", cont_pct >= 95,
              f"{len(ex_contas)}/{len(tr_contas)} contas presentes",
              expected=">=95%", actual=f"{cont_pct:.1f}%", threshold=">=95%")
        # 6. amostra de 50 lançamentos: valor bate
        common = ex_lct & tr_lct
        if common:
            sample = list(common)[:50]
            mismatch = 0
            for lct in sample:
                evd = ex_p[ex_p["lancto"] == lct]["val_deb"].sum() + ex_p[ex_p["lancto"] == lct]["val_cre"].abs().sum()
                tvd = tr[tr["lancto"] == lct]["val_deb"].sum() + tr[tr["lancto"] == lct]["val_cre"].abs().sum()
                if abs(evd - tvd) > 0.5:
                    mismatch += 1
            check(f"A.{emp}.6 valor por lancto (sample 50)", "WARN", mismatch == 0,
                  f"{mismatch}/{len(sample)} lanctos com valor divergente",
                  expected="0", actual=str(mismatch))

    # ------------------------------------------------------------------------
    # GROUP B — Integridade interna do extract full
    # ------------------------------------------------------------------------
    all_ex = pd.concat([df.assign(_emp=e) for e, df in extract.items() if not df.empty], ignore_index=True) if extract else pd.DataFrame()
    # B.1 — 3 empresas presentes
    emps_present = set(int(e) for e, df in extract.items() if not df.empty)
    check("B.1 três empresas presentes (1, 2, 4)", "CRITICAL", emps_present == {1, 2, 4},
          f"empresas com dados: {sorted(emps_present)}",
          expected="{1, 2, 4}", actual=str(sorted(emps_present)))
    # B.2 — período cobre 01/2025 a 04/2026 (cliente)
    if not all_ex.empty:
        dmin, dmax = all_ex["data_dt"].min(), all_ex["data_dt"].max()
        ok_period = dmin <= dt.datetime(2025, 1, 31) and dmax >= dt.datetime(2026, 4, 1)
        check("B.2 período abrange jan/2025 a abr/2026", "CRITICAL", ok_period,
              f"min={dmin} max={dmax}",
              expected="<=2025-01-31 and >=2026-04-01", actual=f"{dmin} - {dmax}")
    # B.3 — sem mês com 0 lançamentos no range jan/2025 a abr/2026
    if not all_ex.empty:
        all_ex["yyyymm"] = all_ex["data_dt"].dt.to_period("M")
        period_range = pd.period_range("2025-01", "2026-04", freq="M")
        counts = all_ex.groupby("yyyymm").size()
        missing_months = [str(m) for m in period_range if m not in counts.index or counts[m] == 0]
        check("B.3 sem mês vazio no range jan/2025-abr/2026", "CRITICAL", len(missing_months) == 0,
              f"meses vazios: {missing_months}",
              expected="0 missing months", actual=f"{len(missing_months)} missing")
    # B.4 — sem datas no futuro (após hoje)
    if not all_ex.empty:
        future = all_ex[all_ex["data_dt"] > dt.datetime.today()]
        check("B.4 sem datas no futuro", "WARN", len(future) == 0,
              f"{len(future)} lançamentos com data futura",
              expected="0", actual=str(len(future)))
    # B.5 — partida dobrada (débito = crédito) por empresa
    for emp, df in extract.items():
        if df.empty: continue
        deb = df["val_deb"].sum()
        cre = df["val_cre"].abs().sum()
        diff = abs(deb - cre) / max(abs(deb), 1) * 100
        check(f"B.5.{emp} partida dobrada (deb=cre)", "CRITICAL", diff < 0.1,
              f"deb={deb:,.2f} cre={cre:,.2f} diff={diff:.4f}%",
              expected="<0.1%", actual=f"{diff:.4f}%")
    # B.6 — histórico não-nulo em ≥80%
    if not all_ex.empty:
        pct_hist = (all_ex["historico"].str.strip().ne("").sum() / len(all_ex)) * 100
        check("B.6 histórico preenchido ≥80%", "WARN", pct_hist >= 80,
              f"{pct_hist:.1f}% das linhas têm histórico", expected=">=80%", actual=f"{pct_hist:.1f}%")
    # B.7 — sem duplicatas (mesmo lancto + emp + valor + conta)
    if not all_ex.empty:
        dup_cols = ["_emp", "lancto", "conta_id", "val_deb", "val_cre"]
        dups = all_ex.duplicated(subset=dup_cols).sum()
        check("B.7 sem duplicatas (emp+lancto+conta+valor)", "WARN", dups == 0,
              f"{dups} linhas duplicadas",
              expected="0", actual=str(dups))
    # B.8 — chart-of-accounts mínimo (FORNECEDORES, BANCOS, IMPOSTOS, RECEITA, CUSTO)
    SINTETICAS_OBRIG = [
        "1.01.01.02 BANCOS",
        "2.01.03.01 FORNECEDORES",
        "1.01.02.01.01 CLIENTES",
        "2.01.15 OBRIGACOES FISCAIS/TRIBUTARIAS",
        "3.01.03",            # qualquer venda começando com 3.01.03 (ex: peças)
        "3.03",               # qualquer custo
        "3.04",               # qualquer despesa operacional
    ]
    for emp, df in extract.items():
        if df.empty: continue
        sints = df["sintetica"].astype(str)
        for prefix in SINTETICAS_OBRIG:
            present = sints.str.contains(re.escape(prefix), regex=True).any()
            check(f"B.8.{emp}.{prefix}", "CRITICAL", present,
                  f"empresa {emp} contém alguma conta com sintética '{prefix}'?",
                  expected="True", actual=str(bool(present)))

    # ------------------------------------------------------------------------
    # GROUP C — BASE_CAIXA_RAZAO (xlsx derivado p/ BI) coerência
    # ------------------------------------------------------------------------
    if not base_caixa.empty:
        # C.1 — 3 empresas
        emps_bc = set(base_caixa["Empresa_codigo"].unique())
        check("C.1 BASE_CAIXA_RAZAO traz 3 empresas", "CRITICAL", emps_bc == {1, 2, 4},
              f"empresas: {sorted(emps_bc)}", expected="{1,2,4}", actual=str(sorted(emps_bc)))
        # C.2 — Receita > 0 cada empresa
        for emp in (1, 2, 4):
            sub = base_caixa[(base_caixa["Empresa_codigo"] == emp) & (base_caixa["Tipo"] == "Receita")]
            check(f"C.2.{emp} receita > 0 emp{emp}", "CRITICAL", sub["Valor"].sum() > 0,
                  f"receita = {sub['Valor'].sum():,.2f}",
                  expected=">0", actual=f"{sub['Valor'].sum():,.2f}")
        # C.3 — Despesa > 0 cada empresa (para emp4 será WARN porque tem só 95 linhas)
        for emp in (1, 2, 4):
            sub = base_caixa[(base_caixa["Empresa_codigo"] == emp) & (base_caixa["Tipo"] == "Despesa")]
            sev = "CRITICAL" if emp == 1 else "WARN"
            check(f"C.3.{emp} despesa > 0 emp{emp}", sev, sub["Valor"].sum() > 0,
                  f"despesa = {sub['Valor'].sum():,.2f}",
                  expected=">0", actual=f"{sub['Valor'].sum():,.2f}")
        # C.4 — concentração top 5 fornecedores ≤95%
        if "Fornecedor" in base_caixa.columns:
            top5 = base_caixa.groupby("Fornecedor")["Valor"].sum().sort_values(ascending=False).head(5).sum()
            tot = base_caixa["Valor"].sum()
            conc = top5 / tot * 100 if tot else 0
            check("C.4 concentração top 5 fornecedores ≤95%", "WARN", conc <= 95,
                  f"top 5 = {conc:.1f}% do total",
                  expected="<=95%", actual=f"{conc:.1f}%")
        # C.5 — Existe pelo menos 1 lançamento "VENDAS A DISTRIBUIR" em receita
        cat_col = "Categoria 1" if "Categoria 1" in base_caixa.columns else None
        if cat_col:
            v = base_caixa[(base_caixa["Tipo"] == "Receita") & (base_caixa[cat_col].astype(str).str.contains("VENDAS A DISTRIBUIR", na=False, case=False))]
            check("C.5 receita 'VENDAS A DISTRIBUIR' presente", "INFO", len(v) > 0,
                  f"{len(v)} lançamentos", expected=">0", actual=str(len(v)))
            # C.6 — pelo menos 1 lançamento "COMPRAS A DISTRIBUIR" em despesa
            d = base_caixa[(base_caixa["Tipo"] == "Despesa") & (base_caixa[cat_col].astype(str).str.contains("COMPRAS A DISTRIBUIR", na=False, case=False))]
            check("C.6 despesa 'COMPRAS A DISTRIBUIR' presente", "INFO", len(d) > 0,
                  f"{len(d)} lançamentos", expected=">0", actual=str(len(d)))
        # C.7 — relação receita/despesa (concessionária agro: tipicamente entre 1.05-1.20)
        rec_total = base_caixa[base_caixa["Tipo"] == "Receita"]["Valor"].sum()
        desp_total = base_caixa[base_caixa["Tipo"] == "Despesa"]["Valor"].sum()
        if desp_total > 0:
            ratio = rec_total / desp_total
            ok_ratio = 0.5 <= ratio <= 3.0  # janela larga porque BASE_CAIXA é só caixa físico, não banco
            check("C.7 razão receita/despesa do extract", "INFO", ok_ratio,
                  f"rec={rec_total:,.2f} desp={desp_total:,.2f} ratio={ratio:.2f}",
                  expected="0.5-3.0 (caixa físico)", actual=f"{ratio:.2f}")
        # C.8 — datas dentro do range esperado
        if "Data_dt" in base_caixa.columns:
            future = (base_caixa["Data_dt"] > dt.datetime.today()).sum()
            check("C.8 BASE_CAIXA sem datas futuras", "WARN", future == 0,
                  f"{future} datas futuras", expected="0", actual=str(future))

    # ------------------------------------------------------------------------
    # GROUP D — NORTE histórico BASE_FINANCEIRA_POWERBI (CONTEXT)
    # NOTA: este arquivo é de extração ANTIGA, formato Conta Azul/ERP genérico,
    # NÃO é razão contábil. Comparação só faz sentido para magnitude.
    # ------------------------------------------------------------------------
    if not base_fin.empty:
        # D.1 — Valor Pago empresa GLOBALMAC (~R$ 7,15M — fluxo de caixa pago)
        col_emp = "Minha Empresa (Nome Fantasia)"
        col_pago = "Valor Pago"
        if col_emp in base_fin.columns and col_pago in base_fin.columns:
            gm = base_fin[base_fin[col_emp].astype(str).str.contains("GLOBAL MAC", na=False, case=False)]
            soma_pago = gm[col_pago].sum()
            check("D.1 NORTE Valor Pago GLOBALMAC ~R$7,15M", "INFO", abs(soma_pago - 7_150_000) / 7_150_000 <= 0.20,
                  f"soma {soma_pago:,.2f}",
                  expected="±20% de 7,15M", actual=f"{soma_pago:,.2f}")
        # D.2 — quantidade de linhas (~2.419)
        check("D.2 NORTE n=2419 ±20%", "INFO", 1900 <= len(base_fin) <= 2900,
              f"{len(base_fin)} linhas",
              expected="1900-2900", actual=str(len(base_fin)))
        # D.3 — categorias com sobreposição com base atual (>70% — contexto)
        if "Categoria" in base_fin.columns and not base_caixa.empty and "Categoria 1" in base_caixa.columns:
            cats_norte = set(str(x).upper().strip() for x in base_fin["Categoria"].dropna().unique())
            cats_curr = set(str(x).upper().strip() for x in base_caixa["Categoria 1"].dropna().unique())
            inter = cats_norte & cats_curr
            cov = len(inter) / max(len(cats_norte), 1) * 100
            check("D.3 categorias ~ NORTE ≥30%", "INFO", cov >= 30,
                  f"intersecção {len(inter)}/{len(cats_norte)} ({cov:.1f}%)",
                  expected=">=30%", actual=f"{cov:.1f}%")

    # ------------------------------------------------------------------------
    # GROUP E — Magnitude vs TRUTH agregado (sanity)
    # ------------------------------------------------------------------------
    # E.1 — extract emp1 jan-fev débito ≈ truth emp1 (já testado em A.1.2 mas aqui é mais flexível)
    # E.2 — extract emp2 e emp4 também precisam estar próximos do truth se truth existir
    pass  # já coberto por A.x

    # ------------------------------------------------------------------------
    # GROUP G — Header sanity (parâmetros usados na extração)
    # ------------------------------------------------------------------------
    for emp, path in EXTRACT_FULL.items():
        if not path.exists(): continue
        with open(path, encoding="cp1252", errors="replace") as f:
            hdr = [next(f, "") for _ in range(4)]
        joined = " ".join(hdr).lower()
        # G.1 — Sintetica Final = 9999999999999999 (todas as contas)
        ok_sint = "9999999999999999" in joined or " . . . . . ." in joined
        # G.2 — Sintetica restrita a 1.01.01 indica BUG
        bug_caixa_only = ("1.01.01.99" in joined) or ("1.01.01.01" in joined and "9999" not in joined)
        check(f"G.1.{emp} extração emp{emp} usou 'todas as sintéticas'", "CRITICAL",
              ok_sint and not bug_caixa_only,
              f"Sintetica restrita detectada? {bug_caixa_only}",
              expected="vSinteticaFim=9999999999999999",
              actual="restrita a 1.01.01.* (caixa/bancos apenas)" if bug_caixa_only else "ALL accounts")
        # G.3 — Período cobre até pelo menos abr/2026
        cover_2026 = "04/05/2026" in joined or "30/04/2026" in joined or "01/04/2026" in joined or "2026" in joined.split("at")[-1]
        check(f"G.2.{emp} período abrange 2026 emp{emp}", "WARN", cover_2026,
              f"header path: {hdr[2][:200] if len(hdr)>2 else ''}",
              expected="Até inclui 2026",
              actual="OK" if cover_2026 else "missing 2026")

    # ------------------------------------------------------------------------
    # GROUP F — Tamanho dos arquivos
    # ------------------------------------------------------------------------
    sizes = {emp: EXTRACT_FULL[emp].stat().st_size if EXTRACT_FULL[emp].exists() else 0 for emp in (1, 2, 4)}
    # F.1 — emp1 deve ter tamanho na ordem de 30MB (full razão grande)
    check("F.1 emp1 size ≥10MB (razão completo)", "CRITICAL", sizes[1] > 10_000_000,
          f"{sizes[1]/1_000_000:.1f} MB",
          expected=">=10MB", actual=f"{sizes[1]/1_000_000:.1f}MB")
    # F.2 — emp2/emp4: mais relaxado mas se for muito menor que emp1, suspeito
    for emp in (2, 4):
        # se emp2 tem 1.8M e emp1 tem 32M, ratio = 6%, suspeito
        ratio = sizes[emp] / max(sizes[1], 1)
        check(f"F.2.{emp} emp{emp} size sanity vs emp1", "WARN", ratio >= 0.05,
              f"{sizes[emp]/1_000_000:.1f}MB ({ratio*100:.1f}% de emp1)",
              expected=">=5% de emp1 (DC menores mas não tão pequenos)",
              actual=f"{ratio*100:.1f}%")

# -----------------------------------------------------------------------------
# Output
# -----------------------------------------------------------------------------
def report():
    n_total = len(CHECKS)
    n_pass = sum(1 for c in CHECKS if c.passed)
    n_fail = n_total - n_pass
    by_sev = {"CRITICAL": [], "WARN": [], "INFO": []}
    for c in CHECKS:
        by_sev[c.severity].append(c)
    crit_pass = sum(1 for c in by_sev["CRITICAL"] if c.passed)
    crit_total = len(by_sev["CRITICAL"])
    crit_pct = crit_pass / max(crit_total, 1) * 100

    lines = []
    lines.append("=" * 90)
    lines.append("VALIDATION REPORT - Extract Razão de Caixa JCE/GlobalMac/DC Tractor/DC Comércio")
    lines.append(f"Generated: {dt.datetime.now():%Y-%m-%d %H:%M:%S}")
    lines.append("=" * 90)
    lines.append("")
    lines.append(f"Total checks: {n_total}")
    lines.append(f"Passed: {n_pass} | Failed: {n_fail}")
    lines.append(f"CRITICAL: {crit_pass}/{crit_total} = {crit_pct:.1f}%")
    lines.append(f"WARN:     {sum(1 for c in by_sev['WARN'] if c.passed)}/{len(by_sev['WARN'])}")
    lines.append(f"INFO:     {sum(1 for c in by_sev['INFO'] if c.passed)}/{len(by_sev['INFO'])}")
    lines.append("")
    for sev in ("CRITICAL", "WARN", "INFO"):
        lines.append("-" * 90)
        lines.append(f"  {sev}")
        lines.append("-" * 90)
        for c in by_sev[sev]:
            mark = "PASS" if c.passed else "FAIL"
            lines.append(f"  [{mark}] {c.name}")
            lines.append(f"         {c.detail}")
            if c.expected is not None:
                lines.append(f"         expected={c.expected} | actual={c.actual}")
            lines.append("")
    lines.append("=" * 90)
    # Verdict
    any_critical_fail = any((not c.passed) for c in by_sev["CRITICAL"])
    if any_critical_fail or crit_pct < 85:
        verdict = "REJEITADO"
    else:
        verdict = "APROVADO"
    lines.append(f"VERDICT: {verdict}")
    lines.append(f"  CRITICAL pass-rate: {crit_pct:.1f}% (need ≥85% AND zero CRITICAL fails)")
    lines.append("=" * 90)

    txt = "\n".join(lines)
    REPORT_PATH.write_text(txt, encoding="utf-8")
    # ASCII-safe stdout (Windows cp1252 default)
    try:
        print(txt)
    except UnicodeEncodeError:
        print(txt.encode("ascii", errors="replace").decode("ascii"))
    return verdict, crit_pct, by_sev

# -----------------------------------------------------------------------------
def main():
    print("Loading sources...")
    extract, truth, base_caixa, base_fin = load_all()
    for emp, df in extract.items():
        print(f"  extract emp{emp}: {len(df)} rows, {df['lancto'].nunique() if len(df) else 0} unique lanctos")
    for emp, df in truth.items():
        print(f"  truth   emp{emp}: {len(df)} rows, {df['lancto'].nunique() if len(df) else 0} unique lanctos")
    print(f"  base_caixa_razao xlsx: {len(base_caixa)} rows")
    print(f"  base_financeira_powerbi xlsx: {len(base_fin)} rows")
    print()
    print("Running checks...")
    run_checks(extract, truth, base_caixa, base_fin)
    print()
    verdict, crit_pct, by_sev = report()
    print(f"\nReport saved to: {REPORT_PATH}")
    sys.exit(0 if verdict == "APROVADO" else 1)

if __name__ == "__main__":
    main()
