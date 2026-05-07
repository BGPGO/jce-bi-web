/* BIT/BGP Finance — Pages 2: Fluxo, Tesouraria, Comparativo */
const { useState, useMemo, useEffect } = React;

// useIsMobile é declarado em pages-1.jsx e disponibilizado globalmente no bundle
// concatenado (build-jsx.cjs). Reutilizado aqui pra ajustar height/showLabels dos
// TrendCharts em mobile.

// ====== OPEX_BUCKETS: agrupa sint_nome do plano de contas em 4 buckets ======
// Source: data/bi_data.json -> top_despesa_por_empresa (sint_nome, valor, empresa)
// Agregação consolidada em 16 meses (não tem quebra mensal por sint_nome).
const OPEX_BUCKETS = [
  {
    key: "PESSOAL",
    label: "Pessoal",
    color: "#22d3ee",
    sints: ["REMUNERACAO", "ENCARGOS SOCIAIS", "BENEFICIOS", "GASTOS COM PESSOAL"],
  },
  {
    key: "MARKETING",
    label: "Marketing & Vendas",
    color: "#a78bfa",
    sints: ["DESPESAS COM MARKETING", "DESPESAS GERAIS DE VENDAS"],
  },
  {
    key: "ADMINISTRATIVO",
    label: "Administrativo",
    color: "#f59e0b",
    sints: ["DESPESAS GERAIS ADMINISTRATIVAS", "IMPOSTOS E TAXAS DIVERSAS", "PROVISOES"],
  },
  {
    key: "OUTRAS",
    label: "Outras",
    color: "#ef4444",
    sints: [
      "DESPESAS COM VIAGENS",
      "DESPESAS FINANCEIRAS",
      "(-)OUTRAS DESPESAS OPERACIONAIS",
      "(+)OUTRAS RECEITAS OPERACIONAIS",
    ],
  },
];
const SINT_TO_BUCKET = (() => {
  const m = {};
  for (const b of OPEX_BUCKETS) for (const s of b.sints) m[s] = b.key;
  return m;
})();

// Computa breakdown opex a partir de window.BI_DATA.top_despesa_por_empresa
function computeOpexBreakdown(empresa) {
  const td = (window.BI_DATA && window.BI_DATA.top_despesa_por_empresa) || [];
  const filtered = (empresa && empresa !== "0")
    ? td.filter(r => String(r.empresa) === String(empresa))
    : td;
  const buckets = {};
  for (const b of OPEX_BUCKETS) buckets[b.key] = { ...b, total: 0, items: [] };
  buckets.NAO_MAPEADO = { key: "NAO_MAPEADO", label: "Não classificado", color: "#6b7686", total: 0, items: [] };
  for (const r of filtered) {
    const key = SINT_TO_BUCKET[r.sint_nome] || "NAO_MAPEADO";
    buckets[key].total += r.valor;
    const exist = buckets[key].items.find(i => i.sint === r.sint_nome);
    if (exist) exist.valor += r.valor;
    else buckets[key].items.push({ sint: r.sint_nome, valor: r.valor });
  }
  // Ordena items por valor desc dentro de cada bucket
  for (const k of Object.keys(buckets)) buckets[k].items.sort((a, b) => b.valor - a.valor);
  const total = Object.values(buckets).reduce((s, b) => s + b.total, 0);
  // Lista ordenada (4 buckets fixos + nao mapeado se houver)
  const ordered = OPEX_BUCKETS.map(b => buckets[b.key]);
  if (buckets.NAO_MAPEADO.total > 0) ordered.push(buckets.NAO_MAPEADO);
  return { total, buckets: ordered };
}

// ====== OpexBreakdown: 4 cards (pessoal/mkt/admin/outras) com drill em sint_nome ======
const OpexBreakdown = ({ empresa, fmt }) => {
  const [expanded, setExpanded] = useState(null);
  const { total, buckets } = useMemo(() => computeOpexBreakdown(empresa), [empresa]);
  if (!total) {
    return <div className="status-line" style={{ padding: 18 }}>Sem dados de Opex para os filtros selecionados.</div>;
  }
  const fmtMoney = fmt || (n => "R$ " + Math.round(n).toLocaleString("pt-BR"));
  return (
    <div>
      <div className="status-line" style={{ marginBottom: 10, fontSize: 11 }}>
        Total Opex (consolidado 16 meses, todas as empresas selecionadas): <b style={{ color: "var(--red)" }}>{fmtMoney(total)}</b>
        {" · "}clique em um bucket para detalhar por sint_nome
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {buckets.map(b => {
          const pct = total > 0 ? (b.total / total) * 100 : 0;
          const isOpen = expanded === b.key;
          return (
            <div
              key={b.key}
              className="indicator-card"
              style={{
                cursor: "pointer",
                padding: 12,
                borderColor: isOpen ? b.color : undefined,
                boxShadow: isOpen ? `0 0 0 1px ${b.color}` : undefined,
              }}
              onClick={() => setExpanded(isOpen ? null : b.key)}
            >
              <div className="kpi-label" style={{ fontSize: 10, color: b.color, fontWeight: 700, letterSpacing: "0.08em" }}>
                {b.label.toUpperCase()}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 17, color: "var(--text)" }}>
                {fmtMoney(b.total)}
              </div>
              <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 2 }}>
                {pct.toFixed(1).replace(".", ",")}% do Opex
              </div>
              <div className="m-bar" style={{ marginTop: 8 }}>
                <div style={{ width: `${Math.min(100, pct)}%`, background: b.color }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 6 }}>
                {b.items.length} {b.items.length === 1 ? "categoria" : "categorias"} {isOpen ? "▾" : "▸"}
              </div>
            </div>
          );
        })}
      </div>
      {expanded && (() => {
        const b = buckets.find(x => x.key === expanded);
        if (!b || b.items.length === 0) return null;
        return (
          <div className="card" style={{ marginTop: 10, background: "rgba(8,14,18,0.4)", padding: 12 }}>
            <div className="card-title-row" style={{ marginBottom: 8 }}>
              <h2 className="card-title" style={{ fontSize: 12, color: b.color }}>{b.label} · detalhamento</h2>
              <span className="chip" style={{ fontSize: 10 }}>{b.items.length} sint_nome</span>
            </div>
            <table className="t" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Conta sintética (sint_nome)</th>
                  <th className="num">Valor</th>
                  <th className="num">% bucket</th>
                  <th className="num">% Opex</th>
                </tr>
              </thead>
              <tbody>
                {b.items.map(it => (
                  <tr key={it.sint}>
                    <td>{it.sint}</td>
                    <td className="num red">{fmtMoney(it.valor)}</td>
                    <td className="num">{b.total > 0 ? ((it.valor / b.total) * 100).toFixed(1).replace(".", ",") : "0,0"}%</td>
                    <td className="num">{((it.valor / total) * 100).toFixed(1).replace(".", ",")}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
};

const PageFluxo = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month, empresa }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const isMobile = useIsMobile();
  const [view, setView] = useState("horizontal");
  const months6 = B.MONTHS_FULL.slice(0, 6);
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const handleMonthHeader = (i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const mn = B.MONTHS_FULL[i] || "";
    setDrilldown({ type: "mes", value: ym, label: `${mn.charAt(0).toUpperCase() + mn.slice(1, 3)}/${refYear}` });
  };
  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? parseInt(drilldown.value.slice(5, 7), 10) - 1 : -1;

  // ====== Saldo inicial vs atual (do Razão) ======
  const SALDOS_INFO = useMemo(() => {
    const S = (typeof window !== "undefined" && window.SALDOS) || null;
    if (!S || !S.contas) return null;
    let contas = S.contas;
    if (empresa && empresa !== "0") contas = contas.filter(c => String(c.empresa) === String(empresa));
    const totalAtual = contas.reduce((s, c) => s + (c.saldo_atual || 0), 0);
    const totalAnterior = contas.reduce((s, c) => s + (c.saldo_anterior || 0), 0);
    const variacao = totalAtual - totalAnterior;
    const bancos = contas
      .filter(c => c.saldo_atual !== 0)
      .map(c => ({ nome: c.conta_nome, sint: c.sintetica_nome, saldoAtual: c.saldo_atual, empresa: c.empresa_label }))
      .sort((a, b) => b.saldoAtual - a.saldoAtual);
    return { totalAtual, totalAnterior, variacao, bancos, fetchedAt: S.fetched_at };
  }, [empresa]);

  // ====== Opex breakdown (dado consolidado 16m) ======
  const OPEX_DATA = useMemo(() => computeOpexBreakdown(empresa), [empresa]);

  // ====== Waterfall: saldo inicial → entradas → CMV → opex → desp fin → saldo final ======
  const waterfallData = useMemo(() => {
    const saldoInicial = (SALDOS_INFO && SALDOS_INFO.totalAnterior) || 0;
    const receitas = B.RECEITA_LIQUIDA || B.TOTAL_RECEITA || 0;
    const cmv = B.CMV || 0;
    const opex = OPEX_DATA.total || 0;
    const despFin = B.DESPESA_FIN || 0;
    const recFin = B.RECEITA_FIN || 0;
    const saldoFinal = saldoInicial + receitas + recFin - cmv - opex - despFin;
    return [
      { label: "Saldo inicial", value: saldoInicial, kind: "start" },
      { label: "+ Receitas", value: receitas, kind: "in" },
      { label: "+ Rec. Fin", value: recFin, kind: "in" },
      { label: "− CMV", value: cmv, kind: "out" },
      { label: "− Opex", value: opex, kind: "out" },
      { label: "− Desp. Fin", value: despFin, kind: "out" },
      { label: "Saldo projetado", value: saldoFinal, kind: "end" },
    ];
  }, [SALDOS_INFO, B, OPEX_DATA]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Fluxo de Caixa</h1>
          <div className="status-line">Caixa · Entradas · Opex (4 buckets) · Saídas · Saldo projetado</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      {/* ====== BLOCO CAIXA: saldo inicial vs atual + variação ====== */}
      {SALDOS_INFO && (
        <div className="row row-3" style={{ marginBottom: 14 }}>
          <div className="indicator-card">
            <div className="kpi-label">Saldo inicial (anterior)</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 20, color: "var(--cyan)" }}>
              {B.fmt(SALDOS_INFO.totalAnterior)}
            </div>
            <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>
              Saldo no início do período (saldo_anterior do Razão)
            </div>
          </div>
          <div className="indicator-card">
            <div className="kpi-label">Saldo atual</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 20, color: SALDOS_INFO.totalAtual >= 0 ? "var(--green)" : "var(--red)" }}>
              {B.fmt(SALDOS_INFO.totalAtual)}
            </div>
            <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>
              {SALDOS_INFO.fetchedAt ? "Atualizado " + (SALDOS_INFO.fetchedAt || "").slice(0, 10).split("-").reverse().join("/") : "—"}
              {" · "}{SALDOS_INFO.bancos.length} contas com saldo
            </div>
          </div>
          <div className={"indicator-card" + (SALDOS_INFO.variacao < 0 ? " red" : "")}>
            <div className="kpi-label">Variação no período</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 20, color: SALDOS_INFO.variacao >= 0 ? "var(--green)" : "var(--red)" }}>
              {SALDOS_INFO.variacao >= 0 ? "+" : ""}{B.fmt(SALDOS_INFO.variacao)}
            </div>
            <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>
              {SALDOS_INFO.totalAnterior > 0 ? `${((SALDOS_INFO.variacao / SALDOS_INFO.totalAnterior) * 100).toFixed(1).replace(".", ",")}% vs inicial` : "—"}
            </div>
          </div>
        </div>
      )}

      {/* ====== BLOCO ENTRADAS / SAÍDAS / NETO ====== */}
      <div className="metric-strip">
        <div className="metric">
          <div className="m-label">Entradas (Receita Líquida)</div>
          <div className="m-value">{B.fmt(B.TOTAL_RECEITA)}</div>
          <div className="m-pct">100%</div>
          <div className="m-bar"><div style={{ width: `100%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Saídas (CMV + Opex)</div>
          <div className="m-value">{B.fmt(B.TOTAL_DESPESA)}</div>
          <div className="m-pct">{B.TOTAL_RECEITA > 0 ? `${((B.TOTAL_DESPESA / B.TOTAL_RECEITA) * 100).toFixed(2).replace(".",",")}%` : "—"}</div>
          <div className="m-bar red"><div style={{ width: `${B.TOTAL_RECEITA > 0 ? Math.min(100, (B.TOTAL_DESPESA / B.TOTAL_RECEITA) * 100) : 0}%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Valor líquido</div>
          <div className="m-value" style={{ color: B.VALOR_LIQUIDO >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(B.VALOR_LIQUIDO)}</div>
          <div className="m-pct">{B.MARGEM_LIQUIDA.toFixed(2).replace(".",",")}%</div>
          <div className="m-bar cyan"><div style={{ width: `${Math.min(100, Math.max(0, B.MARGEM_LIQUIDA))}%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Margem líquida</div>
          <div className="m-value">{B.MARGEM_LIQUIDA.toFixed(2).replace(".",",")}%</div>
          <div className="m-pct">média do período</div>
          <div className="m-bar"><div style={{ width: `${Math.min(100, Math.max(0, B.MARGEM_LIQUIDA))}%` }} /></div>
        </div>
      </div>

      {/* ====== BLOCO WATERFALL: caixa inicial → entradas → saídas → caixa final ====== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title-row">
          <h2 className="card-title">Caixa: inicial → entradas → saídas → projetado</h2>
          <span className="chip">Regime competência (DRE)</span>
        </div>
        <div className="status-line" style={{ marginBottom: 8, fontSize: 11 }}>
          Saldo inicial do Razão + Receita Líquida + Receita Fin − CMV − Opex (4 buckets) − Despesa Financeira = saldo projetado.
          Não é o saldo bancário em tempo real (esse está no bloco Caixa acima).
        </div>
        <Waterfall data={waterfallData} height={isMobile ? 240 : 300} formatFn={B.fmtK} />
      </div>

      {/* ====== BLOCO OPEX BREAKDOWN: 4 buckets + drill em sint_nome ====== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title-row">
          <h2 className="card-title">Despesas Operacionais (Opex) por bucket</h2>
          <span className="chip red">Total: {B.fmt(OPEX_DATA.total)}</span>
        </div>
        <OpexBreakdown empresa={empresa} fmt={B.fmt} />
      </div>

      <div className="row" style={{ gridTemplateColumns: "minmax(220px, 1fr) minmax(0, 4fr)", marginTop: 14 }}>
        <div className="card">
          <h2 className="card-title">Valor líquido por mês</h2>
          <DivergingBars values={B.VALOR_LIQ_SERIES} labels={B.MONTHS.map(m => m.charAt(0).toUpperCase() + m.slice(1))} />
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Fluxo de caixa</h2>
            <div className="seg">
              <button className={view === "horizontal" ? "active" : ""} onClick={() => setView("horizontal")}>Análise horizontal</button>
              <button className={view === "vertical" ? "active" : ""} onClick={() => setView("vertical")}>Análise vertical</button>
            </div>
          </div>
          <div className="status-line" style={{ marginBottom: 8, fontSize: 11 }}>
            {view === "vertical"
              ? "Vertical: todas as linhas (receita e despesa) como % da receita do mês"
              : "Horizontal: cada mês como % do total anual da linha"}
          </div>
          <div className="t-scroll" style={{ maxHeight: 320 }}>
            <table className="t">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Receita / Despesa</th>
                  {months6.map((m, i) => {
                    const isActive = i === activeMonthIdx;
                    return (
                      <React.Fragment key={m}>
                        <th className={`num clickable-th ${isActive ? "active" : ""}`}
                            onClick={() => handleMonthHeader(i)}
                            style={{ cursor: "pointer" }}
                            title="Clique para filtrar este mês">
                          {m}
                        </th>
                        <th className="num">{view === "horizontal" ? "Δ%" : "%"}</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Pre-calcula totais usados nas duas análises */}
                {(() => null)()}
                <tr className="section">
                  <td>Receita</td>
                  {months6.map((_, i) => {
                    const total = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                    let pctLabel = "100%";
                    let pctColor = "var(--fg-3)";
                    if (view === "horizontal") {
                      // Total ANUAL da seção Receita (soma todos os meses)
                      const totalAno = B.FLUXO_RECEITA.reduce((s, r) => s + r.values.reduce((a, b) => a + (b || 0), 0), 0);
                      pctLabel = totalAno ? ((total / totalAno) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                    } else {
                      // Vertical: receita do mês = 100% da base
                      pctLabel = "100%";
                    }
                    return (
                      <React.Fragment key={i}>
                        <td className="num green">{B.fmt(total)}</td>
                        <td className="num" style={{ color: pctColor, fontWeight: view === "horizontal" ? 600 : 400 }}>{pctLabel}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
                {B.FLUXO_RECEITA.map(row => (
                  <tr key={row.cat}>
                    <td><span className="chev">+</span>{row.cat}</td>
                    {months6.map((_, i) => {
                      const v = row.values[i] || 0;
                      let pctLabel = "0,00%";
                      let pctColor = "var(--fg-3)";
                      if (view === "vertical") {
                        // % da receita do mês (linha como fração da receita do mês)
                        const totalReceitaMes = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                        const pct = totalReceitaMes ? (v / totalReceitaMes) * 100 : 0;
                        pctLabel = pct.toFixed(2).replace(".", ",") + "%";
                      } else {
                        // Horizontal: % do total anual desta linha
                        const totalAnoLinha = row.values.reduce((s, x) => s + (x || 0), 0);
                        pctLabel = totalAnoLinha ? ((v / totalAnoLinha) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                      }
                      return (
                        <React.Fragment key={i}>
                          <td className="num green">{B.fmt(v)}</td>
                          <td className="num" style={{ color: pctColor }}>{pctLabel}</td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
                <tr className="section">
                  <td>Despesa</td>
                  {months6.map((_, i) => {
                    const totalDespesa = B.FLUXO_DESPESA.reduce((s, r) => s + (r.values[i] || 0), 0);
                    let pctLabel = "—";
                    let pctColor = "var(--fg-3)";
                    if (view === "vertical") {
                      // Despesa total do mês como % da receita do mês
                      const totalReceitaMes = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                      pctLabel = totalReceitaMes ? ((totalDespesa / totalReceitaMes) * 100).toFixed(2).replace(".", ",") + "%" : "—";
                      pctColor = totalDespesa > totalReceitaMes ? "var(--red)" : "var(--fg-3)";
                    } else {
                      // Horizontal: % do total anual da seção Despesa
                      const totalAnoDesp = B.FLUXO_DESPESA.reduce((s, r) => s + r.values.reduce((a, b) => a + (b || 0), 0), 0);
                      pctLabel = totalAnoDesp ? ((totalDespesa / totalAnoDesp) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                    }
                    return (
                      <React.Fragment key={i}>
                        <td className="num red">{B.fmt(totalDespesa)}</td>
                        <td className="num" style={{ color: pctColor, fontWeight: view === "horizontal" ? 600 : 400 }}>{pctLabel}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
                {B.FLUXO_DESPESA.map(row => (
                  <tr key={row.cat}>
                    <td><span className="chev">+</span>{row.cat}</td>
                    {months6.map((_, i) => {
                      const v = row.values[i] || 0;
                      let pctLabel = "0,00%";
                      let pctColor = "var(--fg-3)";
                      if (view === "vertical") {
                        // Despesa categoria como % da RECEITA do mês (não da despesa)
                        const totalReceitaMes = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                        const pct = totalReceitaMes ? (v / totalReceitaMes) * 100 : 0;
                        pctLabel = pct.toFixed(2).replace(".", ",") + "%";
                      } else {
                        // Horizontal: % do total anual desta linha de despesa
                        const totalAnoLinha = row.values.reduce((s, x) => s + (x || 0), 0);
                        pctLabel = totalAnoLinha ? ((v / totalAnoLinha) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                      }
                      return (
                        <React.Fragment key={i}>
                          <td className="num red">{B.fmt(v)}</td>
                          <td className="num" style={{ color: pctColor }}>{pctLabel}</td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
                <tr className="total">
                  <td>Total Líquido</td>
                  {months6.map((_, i) => {
                    const r = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                    const d = B.FLUXO_DESPESA.reduce((s, r) => s + (r.values[i] || 0), 0);
                    const liq = r - d;
                    let pctLabel = "—";
                    let pctColor = liq >= 0 ? "var(--green)" : "var(--red)";
                    if (view === "vertical") {
                      // Margem líquida: liq / receita do mês
                      pctLabel = r ? ((liq / r) * 100).toFixed(2).replace(".", ",") + "%" : "—";
                    } else {
                      // Horizontal: cada mês como % do total liquido anual
                      const liqAno = B.FLUXO_RECEITA.reduce((s, rr) => s + rr.values.reduce((a, b) => a + (b || 0), 0), 0)
                                   - B.FLUXO_DESPESA.reduce((s, rr) => s + rr.values.reduce((a, b) => a + (b || 0), 0), 0);
                      pctLabel = liqAno ? ((liq / liqAno) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                    }
                    return (
                      <React.Fragment key={i}>
                        <td className="num" style={{ color: liq >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(liq)}</td>
                        <td className="num" style={{ color: pctColor, fontWeight: 600 }}>{pctLabel}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Saldos acumulados por mês</h2>
        <TrendChart
          values={B.SALDOS_MES}
          labels={B.MONTHS.map(m => m.charAt(0).toUpperCase() + m.slice(1) + " " + String((B.META && B.META.ref_year) || "").slice(-2))}
          color="var(--cyan)"
          height={isMobile ? 200 : 300}
          showLabels={!isMobile}
          gradientId="fl-saldos"
        />
      </div>
    </div>
  );
};

const PageTesouraria = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month, empresa }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const isMobile = useIsMobile();
  const SEG = window.BIT_SEGMENTS || {};
  // CR/CP REAIS (rotina 7093) — fonte primária pra "a receber" e "a pagar"
  const crCp = useMemo(() => (window.getCrCp ? window.getCrCp(empresa) : null), [empresa]);
  const recebido = (SEG.realizado && SEG.realizado.KPIS && SEG.realizado.KPIS.TOTAL_RECEITA) || 0;
  const aReceber = crCp ? crCp.totais.a_receber_total
                        : ((SEG.a_pagar_receber && SEG.a_pagar_receber.KPIS && SEG.a_pagar_receber.KPIS.TOTAL_RECEITA) || 0);
  const pago = (SEG.realizado && SEG.realizado.KPIS && SEG.realizado.KPIS.TOTAL_DESPESA) || 0;
  const aPagar = crCp ? crCp.totais.a_pagar_total
                      : ((SEG.a_pagar_receber && SEG.a_pagar_receber.KPIS && SEG.a_pagar_receber.KPIS.TOTAL_DESPESA) || 0);
  const aReceberVencido = crCp ? crCp.totais.a_receber_vencido : 0;
  const aPagarVencido = crCp ? crCp.totais.a_pagar_vencido : 0;
  const recDiaSeg = (SEG.realizado && SEG.realizado.RECEITA_DIA) || B.RECEITA_DIA;
  const pagoDiaSeg = (SEG.realizado && SEG.realizado.DESPESA_DIA) || B.DESPESA_DIA;
  const aReceberDiaSeg = (SEG.a_pagar_receber && SEG.a_pagar_receber.RECEITA_DIA) || B.RECEITA_DIA;
  const aPagarDiaSeg = (SEG.a_pagar_receber && SEG.a_pagar_receber.DESPESA_DIA) || B.DESPESA_DIA;

  const saldosMes = (SEG.tudo && SEG.tudo.SALDOS_MES) || B.SALDOS_MES;
  // Cumulativo (running balance): cada mês = saldo atual após acumular movimentos
  // JCE: lê window.SALDOS (saldos_razao.json) — adapta pro shape SALDOS_REAIS do template.
  // Template espera: { last: { total, data }, bancos: [{ nome, saldoAtual, ... }], saldoBaseInicial }
  const SALDOS_REAIS = useMemo(() => {
    const S = (typeof window !== 'undefined' && window.SALDOS) || null;
    if (!S || !S.contas || S.contas.length === 0) return null;
    let contas = S.contas;
    if (empresa && empresa !== '0') contas = contas.filter(c => String(c.empresa) === String(empresa));
    const totalAtual = contas.reduce((s, c) => s + (c.saldo_atual || 0), 0);
    const totalAnterior = contas.reduce((s, c) => s + (c.saldo_anterior || 0), 0);
    return {
      last: {
        total: totalAtual,
        data: S.fetched_at || new Date().toISOString(),
      },
      saldoBaseInicial: totalAnterior,
      bancos: contas.filter(c => c.saldo_atual !== 0).map(c => ({
        nome: c.conta_nome,
        empresa: c.empresa_label,
        saldoAtual: c.saldo_atual || 0,
        sintetica: c.sintetica_nome || '',
      })),
    };
  }, [empresa]);
  // Saldo inicial do ano: usa o saldo real mais antigo da planilha (se disponível) menos os movimentos até o mês desse saldo.
  // Sem isso, parte de 0 e mostra apenas o efeito dos movimentos.
  const saldoInicial = (function() {
    if (!SALDOS_REAIS || !SALDOS_REAIS.last) return 0;
    const lastDate = new Date(SALDOS_REAIS.last.data);
    const lastMonthIdx = lastDate.getMonth();
    // Saldo no mês N = saldoInicial + sum(saldosMes[0..N]). Sabemos saldo atual e queremos saldo inicial.
    // saldoInicial = saldoAtual - sum(saldosMes[0..lastMonthIdx])
    let acumAteAgora = 0;
    for (let i = 0; i <= lastMonthIdx; i++) acumAteAgora += saldosMes[i] || 0;
    return SALDOS_REAIS.last.total - acumAteAgora;
  })();
  const saldosCum = saldosMes.reduce((acc, v, i) => {
    acc.push((acc[i - 1] != null ? acc[i - 1] : saldoInicial) + (v || 0));
    return acc;
  }, []);
  const sMax = Math.max(...saldosCum, 0);
  const sMin = Math.min(...saldosCum, 0);
  const sMed = saldosCum.length ? saldosCum.reduce((s, v) => s + v, 0) / saldosCum.length : 0;

  // Fluxo a vencer: pega o segmento a_pagar_receber (que tem só items NÃO realizados)
  // e filtra por data >= hoje. Ordem ascendente (próximo vencimento primeiro).
  const todayKey = (function() {
    const t = new Date();
    return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
  })();
  const parseFluxoDate = (s) => {
    const [d, m, y] = (s || '').split('/').map(Number);
    if (!d || !m || !y) return 0;
    return y * 10000 + m * 100 + d;
  };
  const saldoBaseInicial = (SALDOS_REAIS && SALDOS_REAIS.last && SALDOS_REAIS.last.total) || 0;
  const fluxoFuturoFull = useMemo(() => {
    // Lê direto de ALL_TX (não usa SEG.EXTRATO porque buildExtrato faz slice(0,200)
    // sortado DESC, perdendo lançamentos de 2026 quando há parcelas até 2033).
    const allTx = window.ALL_TX || [];
    // Filtra: não realizado (a-vencer) E data >= hoje
    // ALL_TX schema: [kind, mes (yyyy-mm), dia, categoria, cliente, valor, realizado, fornecedor, cc]
    const apr = allTx.filter(r => r[6] === 0);
    // Constrói tupla compatível com EXTRATO: [data DD/MM/YYYY, cc, categoria, cliente/fornec, valorAssinado, status]
    const rows = apr.map(r => {
      const [kind, mes, dia, categoria, cliente, valor, _realizado, fornecedor, cc] = r;
      if (!mes || !dia) return null;
      const dataStr = String(dia).padStart(2, '0') + '/' + mes.slice(5, 7) + '/' + mes.slice(0, 4);
      const valorAssinado = kind === 'r' ? valor : -valor;
      return [dataStr, cc || 'Operações', categoria, kind === 'r' ? cliente : fornecedor, valorAssinado, ''];
    }).filter(Boolean);
    // Aplica drilldown se houver
    const filtered = window.applyDrilldown ? window.applyDrilldown(rows, drilldown) : rows;
    // Filtra futuro + sort ASC (mais próximas primeiro)
    const sorted = filtered
      .filter(e => parseFluxoDate(e[0]) >= todayKey)
      .sort((a, b) => parseFluxoDate(a[0]) - parseFluxoDate(b[0]));
    // Saldo running
    let saldoRunning = saldoBaseInicial;
    return sorted.map((e) => {
      saldoRunning += (e[4] || 0);
      return [...e, saldoRunning];
    });
  }, [drilldown, todayKey, saldoBaseInicial]);

  // Tabela limita a 60 linhas, mas análise de risco usa o full
  const fluxoFuturo = useMemo(() => fluxoFuturoFull.slice(0, 60), [fluxoFuturoFull]);

  // Análise de risco de caixa: quando o saldo cai abaixo de zero pela 1ª vez?
  // Mínimo projetado e em qual data?
  const riscoAnalise = useMemo(() => {
    if (fluxoFuturoFull.length === 0) return null;
    let primeiroNegativo = null;
    let minSaldo = saldoBaseInicial;
    let minSaldoData = null;
    let saldoFinal = saldoBaseInicial;
    for (const row of fluxoFuturoFull) {
      const saldo = row[6];
      if (saldo < 0 && primeiroNegativo == null) {
        primeiroNegativo = { data: row[0], saldo, valor: row[4], movimento: row[3] || row[2] };
      }
      if (saldo < minSaldo) {
        minSaldo = saldo;
        minSaldoData = row[0];
      }
      saldoFinal = saldo;
    }
    // Dias até primeiro negativo
    let diasAteCrise = null;
    if (primeiroNegativo) {
      const [d, m, y] = primeiroNegativo.data.split('/').map(Number);
      const t = new Date(); t.setHours(0,0,0,0);
      const target = new Date(y, m - 1, d);
      diasAteCrise = Math.round((target - t) / (1000 * 60 * 60 * 24));
    }
    return { primeiroNegativo, minSaldo, minSaldoData, saldoFinal, diasAteCrise, totalLancamentos: fluxoFuturoFull.length };
  }, [fluxoFuturoFull, saldoBaseInicial]);

  // Saldo dia-a-dia agregado (pra chart de projeção). Agrupa lançamentos do mesmo dia.
  const saldoDiario = useMemo(() => {
    if (fluxoFuturoFull.length === 0) return [];
    const byDay = new Map();
    for (const row of fluxoFuturoFull) {
      const dataKey = row[0]; // DD/MM/YYYY
      // Para o chart, queremos o saldo NO FIM do dia
      byDay.set(dataKey, row[6]);
    }
    return [...byDay.entries()].map(([data, saldo]) => ({ data, saldo }));
  }, [fluxoFuturoFull]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Tesouraria</h1>
          <div className="status-line"><span className="live-dot" /> Saldos e pulso · {(B.META && B.META.ref_year) || "—"}</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="row row-4">
        <KpiTile label="Recebido (PAGO)" value={(recebido / 1e6).toFixed(2).replace(".", ",")} unit="M" sparkValues={recDiaSeg} sparkColor="var(--green)" tone="green" />
        <KpiTile label="A receber" value={(aReceber / 1e6).toFixed(2).replace(".", ",")} unit="M" sparkValues={aReceberDiaSeg} sparkColor="var(--cyan)" tone="cyan" />
        <KpiTile label="Pago" value={(pago / 1e6).toFixed(2).replace(".", ",")} unit="M" sparkValues={pagoDiaSeg} sparkColor="var(--red)" tone="red" />
        <KpiTile label="A pagar" value={(aPagar / 1e6).toFixed(2).replace(".", ",")} unit="M" sparkValues={aPagarDiaSeg} sparkColor="var(--amber)" tone="amber" />
      </div>

      <div className="row row-1-1">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Pulso de receitas</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="chip green">Recebido · {B.fmt(recebido)}</span>
              <span className="chip cyan">A receber · {B.fmt(aReceber)}</span>
            </div>
          </div>
          <DailyBars values={recDiaSeg} color="green" />
        </div>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Pulso de despesas</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="chip red">Pago · {B.fmt(pago)}</span>
              <span className="chip" style={{ background: "rgba(245,158,11,0.12)", color: "#fcd34d", borderColor: "rgba(245,158,11,0.28)" }}>A pagar · {B.fmt(aPagar)}</span>
            </div>
          </div>
          <DailyBars values={pagoDiaSeg} color="red" />
        </div>
      </div>

      {/* Saldo real (do Razão) + projeção futura via CR/CP (rotina 7093) */}
      {(function() {
        if (!SALDOS_REAIS || !SALDOS_REAIS.last) return null;
        const last = SALDOS_REAIS.last;
        const contas = (SALDOS_REAIS.bancos || []).map(b => [b.nome, b.saldoAtual]).sort((a, b) => b[1] - a[1]);

        // Projeção: caixa atual + (a receber - a pagar) distribuído por bucket de aging.
        // Usa data/cr_cp.json (rotina 7093) pra ter números reais. Buckets:
        // - "agora" (vencidos):    impacto imediato (já era pra ter caído)
        // - "30 dias" (a vencer 0-30 + vencido 0-30 que ainda pode entrar)
        // - "60 dias" (vencido 31-60)
        // - "90+ dias" (vencido 61+)
        // Modelo simplificado: assume vencidos + a_vencer entram nos próximos N meses
        // proporcionalmente ao bucket.
        let projItems = [];
        let usingCrCp = false;
        if (crCp && crCp.aging_receber && crCp.aging_pagar) {
          usingCrCp = true;
          const agR = crCp.aging_receber;
          const agP = crCp.aging_pagar;
          // Buckets monetários (sem N_*)
          const recPorMes = [
            agR['0-30'] || 0,                         // mês +1: títulos vencidos 0-30 (cobrança imediata)
            (agR['a_vencer'] || 0) * 0.5 + (agR['31-60'] || 0),    // mês +2: a_vencer parcial + vencidos 31-60
            (agR['a_vencer'] || 0) * 0.3 + (agR['61-90'] || 0),    // mês +3: a_vencer parcial + vencidos 61-90
            (agR['a_vencer'] || 0) * 0.2 + (agR['90+'] || 0) * 0.5,// mês +4: resto a_vencer + 50% vencidos 90+
            (agR['90+'] || 0) * 0.5,                  // mês +5: 50% restante vencidos 90+
            0,
          ];
          const pagPorMes = [
            agP['0-30'] || 0,
            (agP['a_vencer'] || 0) * 0.5 + (agP['31-60'] || 0),
            (agP['a_vencer'] || 0) * 0.3 + (agP['61-90'] || 0),
            (agP['a_vencer'] || 0) * 0.2 + (agP['90+'] || 0) * 0.5,
            (agP['90+'] || 0) * 0.5,
            0,
          ];
          let saldo = last.total;
          for (let i = 0; i < 6; i++) {
            saldo += recPorMes[i] - pagPorMes[i];
            projItems.push({
              m: `+${i+1} mês${i === 0 ? '' : 'es'}`,
              saldo,
              entrada: recPorMes[i],
              saida: pagPorMes[i],
            });
          }
        } else {
          // Fallback: usa BIT_SEGMENTS.a_pagar_receber.MONTH_DATA (modelo antigo)
          const seg = (window.BIT_SEGMENTS || {}).a_pagar_receber || { MONTH_DATA: [] };
          const lastDate = new Date(last.data);
          const lastMonthIdx = lastDate.getMonth();
          let saldo = last.total;
          for (let i = lastMonthIdx + 1; i < 12; i++) {
            const md = seg.MONTH_DATA[i] || { receita: 0, despesa: 0 };
            saldo += (md.receita || 0) - (md.despesa || 0);
            projItems.push({ m: B.MONTHS_FULL[i] || `M${i+1}`, saldo, entrada: md.receita || 0, saida: md.despesa || 0 });
          }
        }
        const series = [last.total, ...projItems.map(p => p.saldo)];
        const labels = ['Hoje', ...projItems.map(p => p.m.slice(0, 6))];
        const minProj = Math.min(...series);
        const maxProj = Math.max(...series);
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title-row">
              <h2 className="card-title">Saldo atual e projeção (caixa + recebíveis − pagáveis)</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="chip cyan">Saldo: {last.data.split('-').reverse().join('/')}</span>
                {usingCrCp && (
                  <span className="chip green">CR/CP: rotina 7093 · {crCp.totais.n_titulos_receber + crCp.totais.n_titulos_pagar} títulos</span>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
              {contas.map(([nome, v]) => (
                <div key={nome} className="indicator-card" style={{ padding: 12 }}>
                  <div className="kpi-label" style={{ fontSize: 10 }}>{nome}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(v)}</div>
                </div>
              ))}
              <div className="indicator-card" style={{ padding: 12, background: 'rgba(34,211,238,0.08)' }}>
                <div className="kpi-label" style={{ fontSize: 10 }}>Total</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: 'var(--cyan)' }}>{B.fmt(last.total)}</div>
              </div>
              {usingCrCp && (
                <>
                  <div className="indicator-card" style={{ padding: 12, background: 'rgba(34,197,94,0.08)' }}>
                    <div className="kpi-label" style={{ fontSize: 10 }}>(+) A receber total</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: 'var(--green)' }}>{B.fmt(aReceber)}</div>
                    {aReceberVencido > 0 && (<div style={{ fontSize: 10, color: 'var(--red)' }}>{B.fmt(aReceberVencido)} vencido</div>)}
                  </div>
                  <div className="indicator-card" style={{ padding: 12, background: 'rgba(239,68,68,0.08)' }}>
                    <div className="kpi-label" style={{ fontSize: 10 }}>(−) A pagar total</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: 'var(--red)' }}>{B.fmt(aPagar)}</div>
                    {aPagarVencido > 0 && (<div style={{ fontSize: 10, color: 'var(--red)' }}>{B.fmt(aPagarVencido)} vencido</div>)}
                  </div>
                  <div className="indicator-card" style={{ padding: 12, background: (aReceber - aPagar) >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)' }}>
                    <div className="kpi-label" style={{ fontSize: 10 }}>Saldo líquido projetado</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: (last.total + aReceber - aPagar) >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(last.total + aReceber - aPagar)}</div>
                  </div>
                </>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="kpi-label" style={{ marginBottom: 6 }}>
                Projeção 6 meses · saldo atual + recebíveis (por bucket de aging) − pagáveis (por bucket de aging)
              </div>
              <TrendChart values={series} labels={labels} color="var(--cyan)" height={isMobile ? 160 : 200} showPoints={true} showLabels={!isMobile} gradientId="ts-proj" />
              <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 11, color: 'var(--mute)', flexWrap: 'wrap' }}>
                <span>Mínima projetada: <b style={{ color: minProj >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(minProj)}</b></span>
                <span>Máxima projetada: <b style={{ color: 'var(--green)' }}>{B.fmt(maxProj)}</b></span>
                <span>Final do horizonte: <b style={{ color: series[series.length-1] >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(series[series.length-1])}</b></span>
              </div>
              {usingCrCp && (
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--mute)' }}>
                  <b>Fluxo mensal estimado:</b>
                  <div className="t-scroll" style={{ marginTop: 4 }}>
                    <table className="t" style={{ fontSize: 11 }}>
                      <thead>
                        <tr><th>Mês</th><th className="num">A receber</th><th className="num">A pagar</th><th className="num">Líquido</th><th className="num">Saldo acum.</th></tr>
                      </thead>
                      <tbody>
                        {projItems.map((p, i) => (
                          <tr key={i}>
                            <td>{p.m}</td>
                            <td className="num green">{B.fmt(p.entrada)}</td>
                            <td className="num red">{B.fmt(p.saida)}</td>
                            <td className="num" style={{ color: (p.entrada - p.saida) >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(p.entrada - p.saida)}</td>
                            <td className="num" style={{ color: p.saldo >= 0 ? 'var(--cyan)' : 'var(--red)', fontWeight: 600 }}>{B.fmt(p.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)" }}>
        <div className="card">
          <h2 className="card-title">Saldo acumulado por mês</h2>
          <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
            <div><div className="kpi-label">Saldo Máximo</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--green)" }}>{B.fmt(sMax)}</div></div>
            <div><div className="kpi-label">Saldo Mínimo</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--red)" }}>{B.fmt(sMin)}</div></div>
            <div><div className="kpi-label">Saldo Médio</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--cyan)" }}>{B.fmt(sMed)}</div></div>
            {SALDOS_REAIS && SALDOS_REAIS.last && (
              <div><div className="kpi-label">Saldo atual (planilha)</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--cyan)" }}>{B.fmt(SALDOS_REAIS.last.total)}</div></div>
            )}
          </div>
          <TrendChart values={saldosCum} labels={B.MONTHS} color="var(--cyan)" height={isMobile ? 160 : 200} showPoints={true} showLabels={!isMobile} gradientId="ts-saldo" />
          <div className="status-line" style={{ marginTop: 6 }}>
            Saldo cumulativo: parte de R$ {(B.fmt(saldoInicial) || "0").replace("R$ ", "")} no início do ano e acumula receitas − despesas mês a mês.
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Fluxo a vencer (saldo projetado dia a dia)</h2>
          <div className="status-line" style={{ marginBottom: 8 }}>
            {fluxoFuturoFull.length} lançamentos a partir de hoje
            {SALDOS_REAIS && SALDOS_REAIS.last && (
              <> · saldo inicial <b style={{ color: "var(--cyan)" }}>{B.fmt(SALDOS_REAIS.last.total)}</b></>
            )}
          </div>
          {/* Banner de risco de caixa */}
          {riscoAnalise && (
            <div className={`tesouraria-risco ${riscoAnalise.primeiroNegativo ? "risco-critico" : riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "risco-atencao" : "risco-ok"}`}>
              {riscoAnalise.primeiroNegativo ? (
                <>
                  <div className="risco-icon">⚠</div>
                  <div className="risco-body">
                    <div className="risco-titulo">SALDO ENTRA EM VERMELHO EM <b>{riscoAnalise.primeiroNegativo.data}</b> {riscoAnalise.diasAteCrise != null && <span className="risco-dias">(em {riscoAnalise.diasAteCrise} {riscoAnalise.diasAteCrise === 1 ? "dia" : "dias"})</span>}</div>
                    <div className="risco-detalhe">
                      Lançamento crítico: <b>{(riscoAnalise.primeiroNegativo.movimento || "").slice(0, 40)}</b> · {B.fmt(riscoAnalise.primeiroNegativo.valor)} · saldo cai pra <b style={{ color: "var(--red)" }}>{B.fmt(riscoAnalise.primeiroNegativo.saldo)}</b>
                    </div>
                    <div className="risco-min">
                      Mínimo projetado: <b style={{ color: "var(--red)" }}>{B.fmt(riscoAnalise.minSaldo)}</b> em {riscoAnalise.minSaldoData} · Saldo final no horizonte: <b style={{ color: riscoAnalise.saldoFinal >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(riscoAnalise.saldoFinal)}</b>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="risco-icon">{riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "⚠" : "✓"}</div>
                  <div className="risco-body">
                    <div className="risco-titulo">
                      {riscoAnalise.minSaldo < saldoBaseInicial * 0.3
                        ? "SALDO MÍNIMO PROJETADO ABAIXO DE 30% DO ATUAL"
                        : "CAIXA SAUDÁVEL NO HORIZONTE"}
                    </div>
                    <div className="risco-detalhe">
                      Mínimo: <b style={{ color: riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "var(--amber)" : "var(--green)" }}>{B.fmt(riscoAnalise.minSaldo)}</b> em {riscoAnalise.minSaldoData} · Final: <b style={{ color: "var(--green)" }}>{B.fmt(riscoAnalise.saldoFinal)}</b>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Mini chart de saldo dia-a-dia projetado */}
          {saldoDiario.length > 1 && (
            <div className="tesouraria-mini-chart">
              <SaldoProjetadoChart pontos={saldoDiario} saldoInicial={saldoBaseInicial} />
            </div>
          )}
          <div className="t-scroll" style={{ maxHeight: 380 }}>
            <table className="t">
              <thead>
                <tr><th>Vence</th><th>Cliente / Fornecedor</th><th className="num">Movimento</th><th className="num">Saldo</th></tr>
              </thead>
              <tbody>
                {fluxoFuturo.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: "center", color: "var(--fg-3)", padding: 20 }}>Sem lançamentos a vencer</td></tr>
                )}
                {fluxoFuturo.map((e, i) => {
                  const saldoCol = e[6];
                  const dataAtual = e[0];
                  const dataAnterior = i > 0 ? fluxoFuturo[i - 1][0] : null;
                  const novoBloco = dataAnterior !== dataAtual; // primeira linha de cada dia
                  // Linha "crítica" se este é o primeiro lançamento que torna o saldo negativo
                  const saldoAnterior = i > 0 ? fluxoFuturo[i - 1][6] : saldoBaseInicial;
                  const cruzouZero = saldoAnterior >= 0 && saldoCol < 0;
                  return (
                    <tr key={i} className={cruzouZero ? "tesouraria-row-critica" : ""} style={novoBloco && i > 0 ? { borderTop: "1px solid var(--border-2)" } : {}}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: novoBloco ? 700 : 400, color: novoBloco ? "var(--text)" : "var(--fg-3)" }}>{novoBloco ? dataAtual : ""}</td>
                      <td style={{ fontSize: 11 }}>{(e[3] || e[2] || "").slice(0, 32)}</td>
                      <td className={`num ${e[4] < 0 ? "red" : "green"}`} style={{ fontSize: 11 }}>{B.fmt(e[4])}</td>
                      <td className="num" style={{ fontSize: 11, fontWeight: 600, color: saldoCol < 0 ? "var(--red)" : saldoCol < saldoBaseInicial * 0.3 ? "var(--amber)" : "var(--cyan)" }}>{B.fmt(saldoCol)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {fluxoFuturoFull.length > 60 && (
            <div className="status-line" style={{ marginTop: 8, fontSize: 11, textAlign: "center" }}>
              Mostrando primeiros 60 de {fluxoFuturoFull.length} lançamentos · análise de risco usa todos
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Mini chart SVG do saldo projetado dia-a-dia, com marcador da data crítica
const SaldoProjetadoChart = ({ pontos, saldoInicial }) => {
  const W = 800, H = 160, padX = 40, padTop = 16, padBottom = 32;
  if (pontos.length < 2) return null;
  const valores = [saldoInicial, ...pontos.map(p => p.saldo)];
  const min = Math.min(0, ...valores);
  const max = Math.max(...valores);
  const range = (max - min) || 1;
  const stepX = (W - padX * 2) / (pontos.length - 0);
  const xOf = (i) => padX + i * stepX;
  const yOf = (v) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom);
  const zeroY = yOf(0);
  // Path da linha
  const points = pontos.map((p, i) => `${xOf(i + 1)},${yOf(p.saldo)}`).join(" ");
  const startPoint = `${xOf(0)},${yOf(saldoInicial)}`;
  // Área pra preenchimento
  const areaPath = `M ${startPoint} L ${points.replace(/ /g, " L ")} L ${xOf(pontos.length)},${yOf(min)} L ${xOf(0)},${yOf(min)} Z`;
  // Detecta primeira data com saldo negativo
  let critIdx = -1;
  for (let i = 0; i < pontos.length; i++) {
    if (pontos[i].saldo < 0) { critIdx = i; break; }
  }
  // Labels de data: a cada N pontos pra não amassar
  const labelStep = Math.max(1, Math.ceil(pontos.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, marginBottom: 12 }}>
      <defs>
        <linearGradient id="ts-proj-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* zero line */}
      {zeroY > padTop && zeroY < H - padBottom && (
        <line x1={padX} y1={zeroY} x2={W - 10} y2={zeroY} stroke="rgba(239, 68, 68, 0.4)" strokeDasharray="4 4" strokeWidth="1" />
      )}
      {zeroY > padTop && zeroY < H - padBottom && (
        <text x={W - 10} y={zeroY - 4} textAnchor="end" fontSize="10" fill="var(--red)" fontFamily="var(--font-mono)">R$ 0</text>
      )}
      {/* área */}
      <path d={areaPath} fill="url(#ts-proj-grad)" />
      {/* linha */}
      <polyline points={`${startPoint} ${points}`} fill="none" stroke="var(--cyan)" strokeWidth="2" />
      {/* marcador inicial */}
      <circle cx={xOf(0)} cy={yOf(saldoInicial)} r="4" fill="var(--cyan)" stroke="#0a141a" strokeWidth="2" />
      <text x={xOf(0)} y={yOf(saldoInicial) - 8} textAnchor="middle" fontSize="10" fill="var(--cyan)" fontFamily="var(--font-mono)">Hoje</text>
      {/* marcador crítico */}
      {critIdx >= 0 && (
        <g>
          <line x1={xOf(critIdx + 1)} y1={padTop} x2={xOf(critIdx + 1)} y2={H - padBottom} stroke="var(--red)" strokeDasharray="3 3" strokeWidth="1.2" />
          <circle cx={xOf(critIdx + 1)} cy={yOf(pontos[critIdx].saldo)} r="5" fill="var(--red)" stroke="#0a141a" strokeWidth="2" />
          <text x={xOf(critIdx + 1)} y={padTop - 2} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--red)">{pontos[critIdx].data}</text>
        </g>
      )}
      {/* labels de data no eixo x */}
      {pontos.map((p, i) => {
        if (i % labelStep !== 0 && i !== pontos.length - 1) return null;
        return (
          <text key={i} x={xOf(i + 1)} y={H - 12} textAnchor="middle" fontSize="9" fill="var(--mute)">{p.data.slice(0, 5)}</text>
        );
      })}
    </svg>
  );
};

// =============================================================================
// PageEndividamento — Endividamento bancario por instituicao (Itau, Sicredi,
// Bradesco, BB...) por empresa. Cliente pediu na secao 2.5 do Ajustes BI Global:
//   - Separar emprestimo banco vs fornecedor (estavam em CP misturados)
//   - Drill por banco
//   - Saldo, movimentacao do periodo, ultima data
//
// Fonte: data/endividamento.json gerado por parse-endividamento.py a partir
// das sintéticas 2.01.01 / 2.01.02 / 2.01.05 / 2.03.01 do Razao Solution.
// =============================================================================
const PageEndividamento = ({ empresa, year, month }) => {
  const ENDIV = (typeof window !== 'undefined' && window.ENDIVIDAMENTO) || null;
  const fmt = (window.BIT && window.BIT.fmt) || (n => 'R$ ' + Number(n || 0).toFixed(2));
  const fmtK = (window.BIT && window.BIT.fmtK) || (n => 'R$ ' + Number(n || 0).toFixed(0));
  const isMobile = useIsMobile();
  const [bancoSelected, setBancoSelected] = useState(null);

  // Sem dado: mostra mensagem de fallback
  if (!ENDIV || !ENDIV.por_banco_consolidado || ENDIV.por_banco_consolidado.length === 0) {
    return (
      <div className="page">
        <div className="page-title">
          <div>
            <h1>Endividamento Bancário</h1>
            <div className="status-line">Saldo de empréstimos por instituição financeira</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16, border: "1px solid rgba(251, 191, 36, 0.3)", background: "rgba(251, 191, 36, 0.05)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 24, lineHeight: 1 }}>⚠</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Dado indisponível</div>
              <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5 }}>
                Não foi possível extrair o saldo de empréstimos bancários do Razão atual.
                Para habilitar esta tela, rode <code>python parse-endividamento.py</code> com o
                Razão completo extraído (sintéticas 2.01.01 EMPRESTIMOS, 2.01.02 BENS FINANCIADOS,
                2.01.05 DUPLICATAS DESCONTADAS, 2.03.01 OBRIGAÇÕES A LONGO PRAZO).
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filtra por empresa (consolidado se '0')
  const isConsolidado = !empresa || empresa === '0';
  const bancos = (function() {
    if (isConsolidado) {
      return ENDIV.por_banco_consolidado.map(b => ({
        banco: b.banco,
        saldo_atual: b.saldo_atual,
        n_contratos: b.n_contratos,
        n_empresas: b.n_empresas,
        movimentacoes_periodo: b.movimentacoes_periodo,
        por_empresa: b.por_empresa || {},
      })).filter(b => b.saldo_atual > 0).sort((a, b) => b.saldo_atual - a.saldo_atual);
    }
    const e = ENDIV.por_empresa[empresa];
    if (!e) return [];
    return (e.instituicoes || []).filter(b => b.saldo_atual > 0);
  })();

  const totalDivida = bancos.reduce((s, b) => s + (b.saldo_atual || 0), 0);
  const totalCP = isConsolidado
    ? Object.values(ENDIV.por_empresa).reduce((s, e) => s + (e.total_cp || 0), 0)
    : (ENDIV.por_empresa[empresa] || {}).total_cp || 0;
  const totalLP = isConsolidado
    ? Object.values(ENDIV.por_empresa).reduce((s, e) => s + (e.total_lp || 0), 0)
    : (ENDIV.por_empresa[empresa] || {}).total_lp || 0;
  const totalIntercompany = isConsolidado
    ? Object.values(ENDIV.por_empresa).reduce((s, e) => s + (e.total_intercompany || 0), 0)
    : (ENDIV.por_empresa[empresa] || {}).total_intercompany || 0;
  const nContratos = isConsolidado
    ? Object.values(ENDIV.por_empresa).reduce((s, e) => s + (e.n_contratos || 0), 0)
    : (ENDIV.por_empresa[empresa] || {}).n_contratos || 0;

  // Cores por banco (parecido com paleta do BI)
  const BANK_COLORS = {
    'BRADESCO':         '#ef4444',
    'ITAU':             '#f59e0b',
    'BANCO DO BRASIL':  '#facc15',
    'SICREDI':          '#22c55e',
    'SICOOB':           '#16a34a',
    'SANTANDER':        '#dc2626',
    'CAIXA ECONOMICA':  '#2563eb',
    'BNDES':            '#8b5cf6',
    'FINAME':           '#a78bfa',
    'BANCO GM':         '#06b6d4',
    'DLL':              '#0891b2',
    'SECURITIZADORA':   '#64748b',
    'NBC BANK':         '#475569',
    'AMERICA TRADING':  '#94a3b8',
    'TERCEIROS':        '#6b7280',
    'OUTROS':           '#9ca3af',
    'NAO IDENTIFICADO': '#71717a',
  };
  const colorFor = (b) => BANK_COLORS[b] || '#6b7280';

  // Donut segments
  const donutSegs = bancos.slice(0, 10).map(b => ({
    name: b.banco,
    value: b.saldo_atual,
    color: colorFor(b.banco),
  }));

  const empresasList = (window.EMPRESAS || []);

  // Detalhe do banco selecionado: lista de contratos
  const contratosSelected = (function() {
    if (!bancoSelected) return [];
    if (isConsolidado) {
      const all = [];
      Object.values(ENDIV.por_empresa).forEach(e => {
        (e.contratos || []).forEach(c => {
          if (c.banco === bancoSelected) all.push({ ...c, empresa: e.empresa });
        });
      });
      return all.sort((a, b) => b.saldo_atual - a.saldo_atual);
    } else {
      const e = ENDIV.por_empresa[empresa];
      if (!e) return [];
      return (e.contratos || []).filter(c => c.banco === bancoSelected);
    }
  })();

  // Cronograma: movimentacao mensal (filtra banco selecionado se houver)
  const cronograma = (function() {
    const movs = ENDIV.movimentacao_mensal || [];
    let filtered = movs;
    if (bancoSelected) filtered = movs.filter(m => m.banco === bancoSelected);
    const map = new Map();
    for (const m of filtered) {
      if (!map.has(m.ano_mes)) map.set(m.ano_mes, 0);
      map.set(m.ano_mes, map.get(m.ano_mes) + (m.movimentacao || 0));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, val]) => ({ mes, val }));
  })();
  const cronoMax = Math.max(...cronograma.map(c => c.val), 0);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Endividamento Bancário</h1>
          <div className="status-line">
            <span className="live-dot" /> Saldo atual de empréstimos por instituição
            {' · '}
            {isConsolidado ? 'consolidado 3 empresas' : (ENDIV.por_empresa[empresa] || {}).empresa || ''}
          </div>
        </div>
      </div>

      <div className="row row-4">
        <KpiTile label="Dívida bancária total" value={(totalDivida / 1e6).toFixed(2).replace('.', ',')} unit="M" tone="red" nonMonetary />
        <KpiTile label="Curto Prazo (CP)"      value={(totalCP / 1e6).toFixed(2).replace('.', ',')}     unit="M" tone="amber" nonMonetary />
        <KpiTile label="Longo Prazo (LP)"      value={(totalLP / 1e6).toFixed(2).replace('.', ',')}     unit="M" tone="cyan" nonMonetary />
        <KpiTile label="Mútuo intercompany"    value={(totalIntercompany / 1e6).toFixed(2).replace('.', ',')} unit="M" tone="default" nonMonetary />
      </div>

      {bancoSelected && (
        <div className="card" style={{ marginBottom: 12, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(34, 211, 238, 0.05)', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
          <div>
            <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-2)' }}>filtro ativo: </span>
            <b style={{ color: colorFor(bancoSelected) }}>{bancoSelected}</b>
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--fg-2)' }}>({contratosSelected.length} contratos)</span>
          </div>
          <button onClick={() => setBancoSelected(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--fg)', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            Limpar
          </button>
        </div>
      )}

      <div className="row row-1-1">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Distribuição por banco</h2>
            <span className="chip">{bancos.length} instituições · {nContratos} contratos</span>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <Donut segments={donutSegs} size={isMobile ? 160 : 200} thickness={26} />
            <div style={{ flex: 1, minWidth: 220 }}>
              {bancos.slice(0, 10).map((b, i) => {
                const pct = totalDivida > 0 ? (b.saldo_atual / totalDivida) * 100 : 0;
                const isSel = bancoSelected === b.banco;
                return (
                  <div
                    key={b.banco}
                    onClick={() => setBancoSelected(isSel ? null : b.banco)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                      cursor: 'pointer', opacity: bancoSelected && !isSel ? 0.5 : 1,
                      borderRadius: 4, background: isSel ? 'rgba(255,255,255,0.04)' : 'transparent',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(b.banco) }} />
                    <div style={{ flex: 1, fontSize: 13 }}>{b.banco}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--fg-2)' }}>{pct.toFixed(1)}%</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, minWidth: 100, textAlign: 'right' }}>{fmt(b.saldo_atual)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Banco × Empresa{!isConsolidado ? ' (filtro empresa ativo)' : ''}</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Banco</th>
                  {isConsolidado && empresasList.map(e => (
                    <th key={e.codigo} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>{e.label}</th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Mov. Período</th>
                </tr>
              </thead>
              <tbody>
                {bancos.map(b => (
                  <tr
                    key={b.banco}
                    onClick={() => setBancoSelected(bancoSelected === b.banco ? null : b.banco)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', background: bancoSelected === b.banco ? 'rgba(34,211,238,0.06)' : 'transparent' }}
                  >
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: colorFor(b.banco), marginRight: 6, verticalAlign: 'middle' }} />
                      {b.banco}
                    </td>
                    {isConsolidado && empresasList.map(e => (
                      <td key={e.codigo} style={{ textAlign: 'right', padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', color: ((b.por_empresa || {})[e.codigo] || 0) > 0 ? 'var(--fg)' : 'var(--mute)' }}>
                        {((b.por_empresa || {})[e.codigo] || 0) > 0 ? fmtK(b.por_empresa[e.codigo]) : '—'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{fmt(b.saldo_atual)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg-2)', fontSize: 11 }}>{fmtK(b.movimentacoes_periodo || 0)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid rgba(255,255,255,0.15)', fontWeight: 700 }}>
                  <td style={{ padding: '8px' }}>TOTAL</td>
                  {isConsolidado && empresasList.map(e => {
                    const total = bancos.reduce((s, b) => s + ((b.por_empresa || {})[e.codigo] || 0), 0);
                    return <td key={e.codigo} style={{ textAlign: 'right', padding: '8px', fontFamily: 'JetBrains Mono, monospace' }}>{fmtK(total)}</td>;
                  })}
                  <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(totalDivida)}</td>
                  <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg-2)' }}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {cronograma.length > 0 && (
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">
              Movimentação mensal{bancoSelected ? ` — ${bancoSelected}` : ' (todos os bancos)'}
            </h2>
            <span className="chip" style={{ fontSize: 10 }}>
              soma de débitos+créditos no Razão · {cronograma.length} meses
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140, marginTop: 12, padding: '0 4px', overflowX: 'auto' }}>
            {cronograma.map(c => {
              const h = cronoMax > 0 ? (c.val / cronoMax) * 100 : 0;
              return (
                <div key={c.mes} style={{ flex: '1 1 30px', minWidth: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{fmtK(c.val)}</div>
                  <div style={{
                    width: '100%',
                    height: `${h}%`,
                    minHeight: 2,
                    background: bancoSelected ? colorFor(bancoSelected) : 'var(--cyan)',
                    borderRadius: '2px 2px 0 0',
                  }} title={`${c.mes}: ${fmt(c.val)}`} />
                  <div style={{ fontSize: 9, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{c.mes.slice(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bancoSelected && contratosSelected.length > 0 && (
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Contratos / contas — {bancoSelected}</h2>
            <span className="chip">{contratosSelected.length}</span>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Conta / Contrato</th>
                  {isConsolidado && (<th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Empresa</th>)}
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Prazo</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Saldo Atual</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Mov. Período</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--fg-2)', fontWeight: 500 }}>Última data</th>
                </tr>
              </thead>
              <tbody>
                {contratosSelected.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 8px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.conta_nome}>
                      {c.conta_nome}
                    </td>
                    {isConsolidado && (<td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{c.empresa}</td>)}
                    <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                      <span className="chip" style={{ fontSize: 10, padding: '2px 8px', background: c.prazo === 'LP' ? 'rgba(34,211,238,0.12)' : 'rgba(245,158,11,0.12)', color: c.prazo === 'LP' ? 'var(--cyan)' : '#fcd34d' }}>
                        {c.prazo}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{fmt(c.saldo_atual)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg-2)', fontSize: 11 }}>{fmtK(c.movimentacao_periodo)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg-2)', fontSize: 11 }}>{c.ultima_data || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          <b>Fonte:</b> {ENDIV.fonte}
          <br />
          <b>Atualizado:</b> {ENDIV.fetched_at ? new Date(ENDIV.fetched_at).toLocaleString('pt-BR') : '—'}
          {' · '}
          Saldo de cada conta = último saldo do Razão (em CP, último d_c). Mútuo intercompany
          (DC TRACTOR / GLOBALMAC / DC MAQUINAS) está separado do total bancário.
        </div>
      </div>
    </div>
  );
};

const PageComparativo = ({ statusFilter, drilldown, setDrilldown, year, month, empresa }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const refYear = window.REF_YEAR || new Date().getFullYear();
  const fmt = (B && B.fmt) || (n => `R$ ${n.toFixed(2)}`);
  const fmtPct = (B && B.fmtPct) || (n => `${n.toFixed(1)}%`);

  // Estado dos 2 periodos comparados — cada um eh { y, kind: 'mes'|'trim'|'ano', val }
  const [p1, setP1] = useState({ y: refYear, kind: "trim", val: 1 });
  const [p2, setP2] = useState({ y: refYear, kind: "trim", val: 2 });
  const [expanded, setExpanded] = useState({ Receita: true, Despesa: true });

  // Calcula bounds de mes do periodo
  const periodBounds = (p) => {
    if (p.kind === "ano") return { y: p.y, mIni: 1, mFim: 12 };
    if (p.kind === "trim") {
      const tStart = (p.val - 1) * 3 + 1;
      return { y: p.y, mIni: tStart, mFim: tStart + 2 };
    }
    return { y: p.y, mIni: p.val, mFim: p.val }; // mes
  };
  const periodLabel = (p) => {
    if (p.kind === "ano") return `${p.y} · Ano completo`;
    if (p.kind === "trim") {
      const lbl = ["jan-mar", "abr-jun", "jul-set", "out-dez"][p.val - 1];
      return `${p.y} · Trim ${p.val} (${lbl})`;
    }
    const mn = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][p.val - 1];
    return `${mn}/${p.y}`;
  };

  // Filtra ALL_TX por periodo + statusFilter; agrega receitas/despesas por categoria
  const aggregate = (p) => {
    const allTx = window.ALL_TX || [];
    const filterTx = window.filterTx;
    const sf = statusFilter || window.BIT_FILTER || "realizado";
    const txFiltered = filterTx ? filterTx(allTx, sf, null) : allTx;
    const { y, mIni, mFim } = periodBounds(p);
    const mIniStr = `${y}-${String(mIni).padStart(2, "0")}`;
    const mFimStr = `${y}-${String(mFim).padStart(2, "0")}`;
    let totalRec = 0, totalDesp = 0;
    const recCat = new Map(), despCat = new Map();
    for (const row of txFiltered) {
      const [kind, mes, , categoria, , valor] = row;
      if (!mes || mes < mIniStr || mes > mFimStr) continue;
      if (kind === "r") {
        totalRec += valor;
        recCat.set(categoria, (recCat.get(categoria) || 0) + valor);
      } else {
        totalDesp += valor;
        despCat.set(categoria, (despCat.get(categoria) || 0) + valor);
      }
    }
    return { totalRec, totalDesp, liq: totalRec - totalDesp, recCat, despCat };
  };

  const a1 = useMemo(() => aggregate(p1), [p1, statusFilter]);
  const a2 = useMemo(() => aggregate(p2), [p2, statusFilter]);

  const safePct = (a, b) => b !== 0 ? (a / b) * 100 : (a !== 0 ? 100 : 0);
  const diffReceita = a2.totalRec - a1.totalRec;
  const diffReceitaPct = safePct(diffReceita, a1.totalRec);
  const diffDespesa = a2.totalDesp - a1.totalDesp;
  const diffDespesaPct = safePct(diffDespesa, a1.totalDesp);
  const diffLiq = a2.liq - a1.liq;
  const diffLiqPct = safePct(diffLiq, Math.abs(a1.liq) || 1);

  // Top categorias unidas (union de p1 + p2)
  const allRecCats = new Set([...a1.recCat.keys(), ...a2.recCat.keys()]);
  const allDespCats = new Set([...a1.despCat.keys(), ...a2.despCat.keys()]);

  // Selector compacto: ano + tipo + valor
  const PeriodPicker = ({ value, onChange, label }) => {
    const yearsAvail = window.AVAILABLE_YEARS || [refYear];
    const monthOpts = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return (
      <div style={{ marginBottom: 12 }}>
        <div className="filter-mini-label">{label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          <select className="filter-select" value={value.y} onChange={e => onChange({ ...value, y: Number(e.target.value) })}>
            {yearsAvail.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="filter-select" value={value.kind} onChange={e => onChange({ ...value, kind: e.target.value, val: e.target.value === "mes" ? 1 : (e.target.value === "trim" ? 1 : 1) })}>
            <option value="mes">Mês</option>
            <option value="trim">Trimestre</option>
            <option value="ano">Ano completo</option>
          </select>
        </div>
        {value.kind === "mes" && (
          <select className="filter-select" style={{ width: "100%" }} value={value.val} onChange={e => onChange({ ...value, val: Number(e.target.value) })}>
            {monthOpts.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}
        {value.kind === "trim" && (
          <select className="filter-select" style={{ width: "100%" }} value={value.val} onChange={e => onChange({ ...value, val: Number(e.target.value) })}>
            <option value={1}>Trim 1 (jan-mar)</option>
            <option value={2}>Trim 2 (abr-jun)</option>
            <option value={3}>Trim 3 (jul-set)</option>
            <option value={4}>Trim 4 (out-dez)</option>
          </select>
        )}
        <div style={{ marginTop: 4, color: "var(--mute)", fontSize: 11, letterSpacing: "0.04em" }}>{periodLabel(value)}</div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Comparativo</h1>
          <div className="status-line">{periodLabel(p1)} vs {periodLabel(p2)}</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown && setDrilldown(null)} />

      <div className="row row-3-9">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <h2 className="card-title">Filtragem de datas</h2>
            <PeriodPicker value={p1} onChange={setP1} label="Data comparativa 1" />
            <PeriodPicker value={p2} onChange={setP2} label="Data comparativa 2" />
          </div>

          <div className="card">
            <h2 className="card-title">Indicadores principais</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div className={`indicator-card ${diffReceita >= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença na receita</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffReceita >= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffReceita)}</div>
                <div className={`kpi-delta ${diffReceita >= 0 ? "up" : "down"}`}>{fmtPct(diffReceitaPct)}</div>
              </div>
              <div className={`indicator-card ${diffDespesa <= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença nas despesas</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffDespesa <= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffDespesa)}</div>
                <div className={`kpi-delta ${diffDespesa <= 0 ? "up" : "down"}`}>{fmtPct(diffDespesaPct)}</div>
              </div>
              <div className={`indicator-card ${diffLiq >= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença do valor líquido</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffLiq >= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffLiq)}</div>
                <div className={`kpi-delta ${diffLiq >= 0 ? "up" : "down"}`}>{fmtPct(diffLiqPct)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Análise comparativa entre períodos</h2>
          </div>
          <div className="t-scroll" style={{ maxHeight: 540 }}>
            <table className="t">
              <thead>
                <tr>
                  <th>Receita / Despesa</th>
                  <th className="num">{periodLabel(p1)}</th>
                  <th className="num">{periodLabel(p2)}</th>
                  <th className="num">Δ Comparativo</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {/* Header Receita */}
                <tr className="section">
                  <td>
                    <button onClick={() => setExpanded(s => ({ ...s, Receita: !s.Receita }))} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontWeight: 700, fontFamily: "inherit", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="chev">{expanded.Receita ? "−" : "+"}</span>Receita
                    </button>
                  </td>
                  <td className="num bold green">{fmt(a1.totalRec)}</td>
                  <td className="num bold green">{fmt(a2.totalRec)}</td>
                  <td className={`num bold ${diffReceita >= 0 ? "green" : "red"}`}>{fmt(diffReceita)}</td>
                  <td className={`num bold ${diffReceita >= 0 ? "green" : "red"}`}>{fmtPct(diffReceitaPct)}</td>
                </tr>
                {expanded.Receita && [...allRecCats].sort((x, y) => (a2.recCat.get(y) || 0) + (a1.recCat.get(y) || 0) - ((a2.recCat.get(x) || 0) + (a1.recCat.get(x) || 0))).map((cat, i) => {
                  const v1 = a1.recCat.get(cat) || 0;
                  const v2 = a2.recCat.get(cat) || 0;
                  const diff = v2 - v1;
                  const pct = safePct(diff, v1);
                  return (
                    <tr key={`r${i}`}>
                      <td style={{ paddingLeft: 24 }}><span className="chev">+</span>{cat}</td>
                      <td className="num green">{v1 !== 0 ? fmt(v1) : "—"}</td>
                      <td className="num green">{v2 !== 0 ? fmt(v2) : "—"}</td>
                      <td className={`num ${diff >= 0 ? "green" : "red"}`}>{fmt(diff)}</td>
                      <td className={`num ${diff >= 0 ? "green" : "red"}`}>{fmtPct(pct)}</td>
                    </tr>
                  );
                })}
                {/* Header Despesa */}
                <tr className="section">
                  <td>
                    <button onClick={() => setExpanded(s => ({ ...s, Despesa: !s.Despesa }))} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontWeight: 700, fontFamily: "inherit", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="chev">{expanded.Despesa ? "−" : "+"}</span>Despesa
                    </button>
                  </td>
                  <td className="num bold red">{fmt(a1.totalDesp)}</td>
                  <td className="num bold red">{fmt(a2.totalDesp)}</td>
                  <td className={`num bold ${diffDespesa <= 0 ? "green" : "red"}`}>{fmt(diffDespesa)}</td>
                  <td className={`num bold ${diffDespesa <= 0 ? "green" : "red"}`}>{fmtPct(diffDespesaPct)}</td>
                </tr>
                {expanded.Despesa && [...allDespCats].sort((x, y) => (a2.despCat.get(y) || 0) + (a1.despCat.get(y) || 0) - ((a2.despCat.get(x) || 0) + (a1.despCat.get(x) || 0))).map((cat, i) => {
                  const v1 = a1.despCat.get(cat) || 0;
                  const v2 = a2.despCat.get(cat) || 0;
                  const diff = v2 - v1;
                  const pct = safePct(diff, v1);
                  return (
                    <tr key={`d${i}`}>
                      <td style={{ paddingLeft: 24 }}><span className="chev">+</span>{cat}</td>
                      <td className="num red">{v1 !== 0 ? fmt(v1) : "—"}</td>
                      <td className="num red">{v2 !== 0 ? fmt(v2) : "—"}</td>
                      <td className={`num ${diff <= 0 ? "green" : "red"}`}>{fmt(diff)}</td>
                      <td className={`num ${diff <= 0 ? "green" : "red"}`}>{fmtPct(pct)}</td>
                    </tr>
                  );
                })}
                <tr className="total">
                  <td>Total líquido</td>
                  <td className="num">{fmt(a1.liq)}</td>
                  <td className="num">{fmt(a2.liq)}</td>
                  <td className={`num ${diffLiq >= 0 ? "green" : "red"}`}>{fmt(diffLiq)}</td>
                  <td className={`num ${diffLiq >= 0 ? "green" : "red"}`}>{fmtPct(diffLiqPct)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== PageRelatorio =====
// Carrega report.json (gerado offline por generate-report.cjs) e renderiza
// um relatorio executivo imprimivel (Ctrl+P -> Save as PDF).
const PageRelatorio = ({ year, statusFilter, empresa }) => {
  const refYear = window.REF_YEAR || new Date().getFullYear();
  // Hooks de dados — DEVEM ficar antes de qualquer early return pra não violar
  // a ordem dos hooks. Os useMemo dependem de periodYear/periodMonth declarados abaixo
  // mas useMemo aceita refs do escopo via closure.
  // Estado do periodo a renderizar (defaults: ano corrente YTD)
  const [periodYear, setPeriodYear] = useState(() => {
    try { var p = JSON.parse(localStorage.getItem('bi.report.period') || 'null'); return (p && p.year) || (year || refYear); } catch (e) { return year || refYear; }
  });
  const [periodMonth, setPeriodMonth] = useState(() => {
    try { var p = JSON.parse(localStorage.getItem('bi.report.period') || 'null'); return (p && p.month) || 0; } catch (e) { return 0; } // 0 = ano completo
  });
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Cards reativos ao período (year + month) — antes usavam window.BIT global YTD
  // Mantidos no topo (regra dos hooks) — não chamar dentro de early returns
  const B = useMemo(
    () => window.getBit('realizado', null, periodYear, periodMonth, empresa),
    [periodYear, periodMonth, empresa]
  );
  const Bprev = useMemo(
    () => window.getBit('a_pagar_receber', null, periodYear, periodMonth, empresa),
    [periodYear, periodMonth, empresa]
  );

  // resolve o nome do arquivo conforme periodo
  const reportFileName = (y, m) => {
    if (m && m > 0) return `report-${y}-${String(m).padStart(2,'0')}.json`;
    if (y === refYear) return 'report.json'; // default mantem nome principal
    return `report-${y}.json`;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGenerating(false);
    setError(null);
    setReport(null);
    try { localStorage.setItem('bi.report.period', JSON.stringify({ year: periodYear, month: periodMonth })); } catch (e) {}
    const file = reportFileName(periodYear, periodMonth);

    // 1) tenta o JSON pre-gerado (estatico). Se 404, cai no fallback de geracao on-demand.
    fetch(file, { cache: 'no-store' })
      .then(r => {
        if (r.ok) return r.json();
        if (r.status === 404) return null; // sinaliza fallback
        throw new Error(`HTTP ${r.status} (arquivo ${file})`);
      })
      .then(data => {
        if (cancelled) return;
        if (data) {
          // tinha relatorio pre-gerado
          setReport(data);
          setLoading(false);
          return null;
        }
        // 2) Fallback: chama a API publica de geracao on-demand
        const apiUrl = window.BI_REPORT_API;
        if (!apiUrl) {
          throw new Error('API de geracao nao configurada');
        }
        setLoading(false);
        setGenerating(true);
        return fetch(`${apiUrl}/generate-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: periodYear,
            month: periodMonth > 0 ? periodMonth : null,
          }),
        }).then(async (resp) => {
          if (cancelled) return;
          if (resp.status === 429) {
            const retry = resp.headers.get('Retry-After') || '3600';
            throw new Error(`Limite de geracao atingido. Tente novamente em ~${Math.ceil(Number(retry) / 60)} minutos.`);
          }
          if (!resp.ok) {
            const t = await resp.text().catch(() => '');
            throw new Error(`Falha ao gerar (HTTP ${resp.status}). Verifique conexao com Anthropic. ${t.slice(0,200)}`);
          }
          const generated = await resp.json();
          if (cancelled) return;
          setReport(generated);
          setGenerating(false);
        });
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
        setGenerating(false);
      });
    return () => { cancelled = true; };
  }, [periodYear, periodMonth]);

  const MONTH_OPTIONS = [
    { v: 0, label: "Ano completo" },
    { v: 1, label: "Janeiro" }, { v: 2, label: "Fevereiro" }, { v: 3, label: "Março" },
    { v: 4, label: "Abril" }, { v: 5, label: "Maio" }, { v: 6, label: "Junho" },
    { v: 7, label: "Julho" }, { v: 8, label: "Agosto" }, { v: 9, label: "Setembro" },
    { v: 10, label: "Outubro" }, { v: 11, label: "Novembro" }, { v: 12, label: "Dezembro" },
  ];
  const availableYears = [2026];

  const PeriodToolbar = (
    <div className="report-period-toolbar" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Período:</span>
      <select className="header-year" value={periodYear} onChange={e => setPeriodYear(Number(e.target.value))}>
        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select className="header-year" value={periodMonth} onChange={e => setPeriodMonth(Number(e.target.value))}>
        {MONTH_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <div className="page-title">
          <div><h1>Relatório IA</h1><div className="status-line">Carregando…</div></div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="page">
        <div className="page-title">
          <div>
            <h1>Relatório IA</h1>
            <div className="status-line">Gerando relatório com IA…</div>
          </div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <h2 className="card-title" style={{ textAlign: 'center' }}>Gerando análise…</h2>
          <p style={{ color: 'var(--fg-2)', lineHeight: 1.6, marginTop: 12 }}>
            Estamos disparando 7 chamadas à IA da Anthropic em paralelo para construir o relatório executivo deste período.
          </p>
          <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 8 }}>
            Geralmente leva ~30 segundos. Não feche esta página.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out 0.2s infinite' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out 0.4s infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    const monthLabel = periodMonth > 0 ? MONTH_OPTIONS[periodMonth].label + ' de ' : '';
    const cmd = periodMonth > 0
      ? `node generate-report.cjs --force --year=${periodYear} --month=${periodMonth}`
      : (periodYear === refYear ? `node generate-report.cjs --force` : `node generate-report.cjs --force --year=${periodYear}`);
    return (
      <div className="page">
        <div className="page-title">
          <div>
            <h1>Relatório IA</h1>
            <div className="status-line">Relatório de {monthLabel}{periodYear} ainda não foi gerado</div>
          </div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
        <div className="card">
          <h2 className="card-title">Gerar agora</h2>
          <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 12 }}>
            Abra o terminal na pasta <code style={{ background: "var(--surface-2)", padding: "2px 6px", borderRadius: 4 }}>{'<cliente>-bi-web'}</code> e rode:
          </p>
          <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, marginTop: 12, fontSize: 13, color: "var(--cyan)" }}>
            {cmd}
          </pre>
          <p style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 12 }}>
            ~30s + 1 chamada Anthropic. Depois de pronto, recarregue esta página (mantém o período selecionado).
          </p>
          {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>Detalhe: {error}</p>}
        </div>
      </div>
    );
  }

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const k = B.KPIS || B;
  const recebido = k.TOTAL_RECEITA || 0;
  const pago = k.TOTAL_DESPESA || 0;
  const liquido = k.VALOR_LIQUIDO != null ? k.VALOR_LIQUIDO : (recebido - pago);
  const margem = k.MARGEM_LIQUIDA != null ? k.MARGEM_LIQUIDA : (recebido > 0 ? (liquido / recebido) * 100 : 0);
  const aReceber = (Bprev.KPIS && Bprev.KPIS.TOTAL_RECEITA) || 0;
  const aPagar = (Bprev.KPIS && Bprev.KPIS.TOTAL_DESPESA) || 0;

  const sec = (id) => (report.secoes && report.secoes[id]) || { title: id, analysis: '' };

  const renderAnalysis = (text) => {
    if (!text) return <p className="report-analysis muted">(análise indisponível — verifique se a chamada à API foi bem-sucedida)</p>;
    return text.split(/\n\s*\n/).map((p, i) => (
      <p key={i} className="report-analysis">{p.trim()}</p>
    ));
  };

  return (
    <div className="page">
      {/* Toolbar — escondida no print */}
      <div className="report-toolbar no-print">
        <div>
          <h1 style={{ margin: 0 }}>Relatório IA</h1>
          <div className="status-line">Gerado em {fmtDate(report.generated_at)} · {report.periodo}</div>
        </div>
        <div className="actions" style={{ gap: 12, alignItems: 'center' }}>
          {PeriodToolbar}
          <button className="btn-primary" onClick={() => window.print()}>
            <Icon name="download" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Modal de ajuda */}
      {showHelp && (
        <div className="drawer-overlay no-print" onClick={() => setShowHelp(false)}>
          <div className="card" style={{ maxWidth: 520, margin: "auto", padding: 24 }} onClick={e => e.stopPropagation()}>
            <h2 className="card-title">Como regenerar o relatório</h2>
            <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 8 }}>
              O relatório é gerado offline por um script Node que chama a API da Anthropic.
              Não pode ser disparado pelo browser (a chave da API ficaria exposta).
            </p>
            <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 12 }}>No terminal, dentro da pasta do projeto:</p>
            <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, marginTop: 8, fontSize: 13, color: "var(--cyan)" }}>
node generate-report.cjs --force
            </pre>
            <p style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 12 }}>
              Depois recarregue esta página. Sem <code>--force</code>, o script pula se o relatório foi gerado há menos de 1h.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn-primary" onClick={() => setShowHelp(false)}>Entendi</button>
            </div>
          </div>
        </div>
      )}

      {/* Relatorio imprimivel */}
      <article className="report">
        <header className="report-cover">
          <img src="assets/bgp-logo-white.png" alt="BGP" className="report-logo" />
          <h1 className="report-title">BGP GO BI — Relatório Executivo</h1>
          <p className="report-subtitle">{report.empresa}</p>
          <p className="report-meta">Período: {report.periodo} — Realizado</p>
          <p className="report-meta">Gerado em {fmtDate(report.generated_at)}</p>
        </header>

        <section className="report-section">
          <h2>1. Visão Geral</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita realizada</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa realizada</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Resultado líquido</span><span className="val" style={{ color: liquido >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(liquido)}</span></div>
            <div className="report-kpi"><span className="lbl">Margem líquida</span><span className="val">{B.fmtPct ? B.fmtPct(margem) : margem.toFixed(2) + "%"}</span></div>
          </div>
          {renderAnalysis(sec('visao_geral').analysis)}
        </section>

        <section className="report-section">
          <h2>2. Receita</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita recebida</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Receita a receber</span><span className="val">{B.fmt(aReceber)}</span></div>
          </div>
          <h3 className="report-sub">Top 5 categorias</h3>
          <ul className="report-list">
            {(B.RECEITA_CATEGORIAS || []).slice(0, 5).map((c, i) => (
              <li key={i}><span>{c.name}</span><b>{B.fmt(c.value)}</b></li>
            ))}
          </ul>
          {renderAnalysis(sec('receita').analysis)}
        </section>

        <section className="report-section">
          <h2>3. Despesa</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Despesa paga</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa a pagar</span><span className="val">{B.fmt(aPagar)}</span></div>
          </div>
          <h3 className="report-sub">Top 5 categorias</h3>
          <ul className="report-list">
            {(B.DESPESA_CATEGORIAS || []).slice(0, 5).map((c, i) => (
              <li key={i}><span>{c.name}</span><b>{B.fmt(c.value)}</b></li>
            ))}
          </ul>
          {renderAnalysis(sec('despesa').analysis)}
        </section>

        <section className="report-section">
          <h2>4. Fluxo de Caixa</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita total</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa total</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Líquido</span><span className="val" style={{ color: liquido >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(liquido)}</span></div>
          </div>
          <h3 className="report-sub">Líquido mês a mês</h3>
          <ul className="report-list">
            {(B.MONTH_DATA || []).map((m, i) => {
              const v = m.receita - m.despesa;
              return <li key={i}><span style={{ textTransform: "capitalize" }}>{m.m}</span><b style={{ color: v >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(v)}</b></li>;
            })}
          </ul>
          {renderAnalysis(sec('fluxo_caixa').analysis)}
        </section>

        <section className="report-section">
          <h2>5. Tesouraria</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Recebido</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">A receber</span><span className="val">{B.fmt(aReceber)}</span></div>
            <div className="report-kpi"><span className="lbl">Pago</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">A pagar</span><span className="val">{B.fmt(aPagar)}</span></div>
          </div>
          {renderAnalysis(sec('tesouraria').analysis)}
        </section>

        <section className="report-section">
          <h2>6. Comparativo</h2>
          {renderAnalysis(sec('comparativo').analysis)}
        </section>

        <section className="report-section report-conclusion">
          <h2>Conclusão e Recomendações</h2>
          {renderAnalysis(sec('conclusao').analysis)}
        </section>

        <footer className="report-footer">
          BGP GO BI · {report.empresa} · {report.periodo} · Gerado em {fmtDate(report.generated_at)}
        </footer>
      </article>
    </div>
  );
};

Object.assign(window, { PageFluxo, PageTesouraria, PageEndividamento, PageComparativo, PageRelatorio });
