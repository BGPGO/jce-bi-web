/* BIT/BGP Finance — Pages 1: Overview, Indicators, Receita, Despesa */
const { useState, useEffect } = React;

// Hook responsivo: detecta viewport mobile (<= 600px). Usado para ajustar SVGs com
// preserveAspectRatio="none" cujas coords sao plotadas em px absolutos.
const useIsMobile = (breakpoint = 600) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
};

const RangePills = ({ value, onChange }) => {
  const opts = ["7D", "30D", "90D", "YTD", "12M"];
  return (
    <div className="range-pills">
      {opts.map(o => (
        <button key={o} className={value === o ? "active" : ""} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
};

// Section heading — kept as a thin alias so all card titles share the standardized style
const SectionHeading = ({ strong, soft }) => (
  <h2 className="card-title">{[strong, soft].filter(Boolean).join(" ")}</h2>
);

// Side-by-side monthly bars (Receita green / Despesa red) with floating value chips
const OverviewBars = ({ data, height = 220, year = "2026", onBarClick, activeIdx }) => {
  const B = window.BIT || {};
  const fmt = (B.fmt) || ((v) => 'R$ ' + Math.round(v));
  // rawMax detecta dataset zerado pra ajustar a escala (eixo) quando filtro 'a_pagar_receber'
  // zera tudo. Sem isso o eixo continuava preso em R$200K mostrando barras 0% (visual ok mas
  // confuso). Com rawMax=0 o eixo colapsa pra um único tick em R$0.
  const rawMax = Math.max(...data.map(d => Math.max(d.receita || 0, d.despesa || 0)), 0);
  const max = Math.max(rawMax, 1);
  const niceMax = rawMax > 0 ? Math.max(Math.ceil(max / 200000) * 200000, 200000) : 1;
  const ticks = [];
  for (let v = 0; v <= niceMax; v += 200000) ticks.push(v);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1, 3);
  const hasActive = activeIdx != null && activeIdx >= 0;

  return (
    <div className="ov-bars">
      <div className="ov-bars-plot" style={{ height }}>
        <div className="ov-bars-axis">
          {ticks.map((t, i) => (
            <div key={i} className="ov-bars-tick" style={{ bottom: `${(t / niceMax) * 100}%` }}>
              <span>R${(t / 1000).toFixed(0)} K</span>
            </div>
          ))}
        </div>
        <div className="ov-bars-cols">
          {data.map((d, i) => {
            const rH = rawMax > 0 ? ((d.receita || 0) / niceMax) * 100 : 0;
            const dH = rawMax > 0 ? ((d.despesa || 0) / niceMax) * 100 : 0;
            const cls = "ov-bar-col" + (onBarClick ? " clickable" : "") +
              (hasActive && i === activeIdx ? " active" : "") +
              (hasActive && i !== activeIdx ? " dimmed" : "");
            return (
              <div key={i} className={cls}
                onClick={onBarClick ? () => onBarClick(d, i) : undefined}
                style={onBarClick ? { cursor: "pointer" } : undefined}
              >
                <div className="ov-bar-stack">
                  <div className="ov-bar green" style={{ height: `${rH}%` }} title={`Receita: ${fmt(d.receita)}`}>
                    <span className="ov-bar-chip">R${Math.round((d.receita || 0) / 1000)} K</span>
                  </div>
                  <div className="ov-bar red" style={{ height: `${dH}%` }} title={`Despesa: ${fmt(d.despesa)}`}>
                    <span className="ov-bar-chip">R${Math.round((d.despesa || 0) / 1000)} K</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ov-bars-x">
        {data.map((d, i) => <span key={i}>{cap(d.m)}</span>)}
      </div>
      <div className="ov-bars-year"><span>{year}</span></div>
    </div>
  );
};

// Diverging line chart — line + zero baseline + value labels above/below points
const IndicatorLine = ({ values, labels, height = 240, color = "var(--cyan)", format }) => {
  // No mobile reduzimos o viewBox horizontal (1100 -> 600) e a altura (240 -> 180).
  // Como preserveAspectRatio="none" estica o conteudo pra preencher a largura do container,
  // um viewBox mais estreito faz os pontos plotados em px absolutos ficarem espacados
  // de forma proporcional ao espaco disponivel no mobile (~326px), evitando o achatamento.
  const isMobile = useIsMobile();
  const w = isMobile ? 600 : 1100;
  const h = isMobile ? 180 : height;
  const padX = isMobile ? 28 : 50;
  const padTop = isMobile ? 28 : 36;
  const padBottom = isMobile ? 28 : 36;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const stepX = (w - padX * 2) / (values.length - 1);
  const xOf = (i) => padX + i * stepX;
  const yOf = (v) => padTop + (1 - (v - min) / range) * (h - padTop - padBottom);

  const pts = values.map((v, i) => [xOf(i), yOf(v)]);
  const curve = (p) => {
    let d = `M ${p[0][0]} ${p[0][1]}`;
    for (let i = 1; i < p.length; i++) {
      const [x0, y0] = p[i - 1];
      const [x1, y1] = p[i];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  };
  const path = curve(pts);
  const zeroY = yOf(0);
  const fmt = format || ((v) => window.BIT.fmt(v));

  // Em mobile, mostramos label de valor Y apenas nos pontos extremos
  // (primeiro, ultimo, max, min) pra evitar amassamento sobre a curva.
  const labelIdxSet = (() => {
    if (!isMobile || values.length <= 4) return null;
    let maxI = 0, minI = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[maxI]) maxI = i;
      if (values[i] < values[minI]) minI = i;
    }
    return new Set([0, values.length - 1, maxI, minI]);
  })();

  return (
    <svg className="ind-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h }}>
      <defs>
        <linearGradient id="ind-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <line x1={padX} y1={zeroY} x2={w - padX} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeDasharray="6 5" strokeWidth="1"/>
      <path d={`${path} L ${pts[pts.length - 1][0]} ${zeroY} L ${pts[0][0]} ${zeroY} Z`} fill="url(#ind-grad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map((p, i) => {
        const v = values[i];
        const above = v >= 0;
        const showLabel = labelIdxSet ? labelIdxSet.has(i) : true;
        return (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={isMobile ? 3.5 : 4.5} fill={color} stroke="#0a141a" strokeWidth="2.5"/>
            {showLabel && (
              <text x={p[0]} y={above ? p[1] - 12 : p[1] + 22} textAnchor="middle" fill={v >= 0 ? "#e8f6f9" : "#fca5a5"} fontFamily="var(--font-mono)" fontSize={isMobile ? "10" : "11.5"} fontWeight="600">
                {fmt(v)}
              </text>
            )}
          </g>
        );
      })}
      {labels.map((l, i) => (
        i % 2 === 0 ? (
          <text key={i} x={xOf(i)} y={h - 10} textAnchor="middle" fill="var(--mute)" fontSize="11" fontFamily="var(--font-ui)">{l}</text>
        ) : null
      ))}
    </svg>
  );
};

// PageOverview — restaurado do template + extras como seções no final.
const PageOverview = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month, empresa }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const [indicator, setIndicator] = useState("Valor líquido");
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const SUR = (typeof window !== "undefined" && window.SURROGATES) || {};
  const SAL = (typeof window !== "undefined" && window.SALDOS) || { totais_por_empresa: {} };

  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? B.MONTHS_FULL.findIndex(mn => {
        const mm = String(parseInt(drilldown.value.slice(5, 7), 10)).padStart(2, "0");
        const idx = parseInt(mm, 10) - 1;
        return B.MONTHS_FULL.indexOf(mn) === idx;
      })
    : -1;
  const handleBarMes = (d, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const lbl = `${d.m.charAt(0).toUpperCase() + d.m.slice(1, 3)}/${refYear}`;
    setDrilldown({ type: "mes", value: ym, label: lbl });
  };

  const margemSeries = B.MONTH_DATA.map(m => m.receita > 0 ? ((m.receita - m.despesa) / m.receita) * 100 : 0);
  const indicatorSeries = {
    "Valor líquido":          { values: B.VALOR_LIQ_SERIES, color: "var(--cyan)", fmt: (v) => B.fmt(v) },
    "Receita":                { values: B.MONTH_DATA.map(m => m.receita), color: "var(--green)", fmt: (v) => B.fmt(v) },
    "Despesa":                { values: B.MONTH_DATA.map(m => -m.despesa), color: "var(--red)", fmt: (v) => B.fmt(v) },
    "Margem Líquida":         { values: margemSeries, color: "var(--cyan)", fmt: (v) => `${v.toFixed(2).replace(".", ",")}%` },
  };
  const current = indicatorSeries[indicator];
  const monthLabels = B.MONTHS_FULL.map(m => `${m.charAt(0).toUpperCase() + m.slice(1, 3)} ${refYear}`);

  const indicadores = [
    { value: B.TOTAL_RECEITA, label: "Soma de receita",     kind: "receita" },
    { value: B.TOTAL_DESPESA, label: "Soma de despesa",     kind: "despesa" },
    { value: B.VALOR_LIQUIDO, label: "Valor líquido",       kind: B.VALOR_LIQUIDO >= 0 ? "receita" : "despesa" },
  ];

  const empresaLabel = (!empresa || empresa === '0') ? "Consolidado" :
    (window.EMPRESAS && window.EMPRESAS.find(e => e.codigo === empresa) || {}).label || empresa;
  const statusLabel = statusFilter === "realizado" ? "realizado (PAGO)" :
                      statusFilter === "a_pagar_receber" ? "pendente (A vencer/receber)" : "tudo (pago + pendente)";

  // ===== EXTRAS (Razão Caixa) =====
  // Saldo total caixa+banco (consolidado ou da empresa selecionada)
  const saldoTotal = useMemo(() => {
    const tots = SAL.totais_por_empresa || {};
    if (!empresa || empresa === '0') {
      return Object.values(tots).reduce((s, t) => s + (t.saldo_total_atual || 0), 0);
    }
    return (tots[empresa] && tots[empresa].saldo_total_atual) || 0;
  }, [empresa]);

  const concentracaoCP = SUR.CONCENTRACAO_TOP5_FORNECEDOR || 0;
  const concentracaoCR = SUR.CONCENTRACAO_TOP5_CLIENTE || 0;

  // Heatmap empresa × mês (saldo caixa por empresa por mês).
  // Aceita refYear=0 (Todos os anos) somando todos meses jan-dez de qualquer ano.
  const heatmapRows = useMemo(() => {
    const ALL_TX = (typeof window !== "undefined" && window.ALL_TX) || [];
    const EMP = (typeof window !== "undefined" && window.EMPRESAS) || [];
    const filterYear = year && year > 0 ? Number(year) : null;
    const rows = [];
    for (const e of EMP) {
      const values = Array(12).fill(0);
      for (const t of ALL_TX) {
        if (t[9] !== e.codigo) continue;
        if (!t[1]) continue;
        if (filterYear && Number(t[1].slice(0, 4)) !== filterYear) continue;
        const mIdx = parseInt(t[1].slice(5, 7), 10) - 1;
        if (mIdx < 0 || mIdx > 11) continue;
        values[mIdx] += (t[0] === 'r' ? t[5] : -t[5]);
      }
      rows.push({ label: e.label, values });
    }
    return rows;
  }, [year]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Visão Geral</h1>
          <div className="status-line">{empresaLabel} · ano {refYear} · status <b>{statusLabel}</b></div>
        </div>
        <div className="actions"></div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      {/* === LAYOUT PADRÃO DO BI (template radke-bi) === */}
      <div className="row" style={{ gridTemplateColumns: "minmax(280px, 3fr) minmax(0, 9fr)" }}>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="card">
            <SectionHeading strong="INDICADORES" soft="PRINCIPAIS" />
            <div className="kpi-stack">
              {indicadores.map((it, i) => (
                <div key={i} className={`kpi-stack-item ${it.kind}`}>
                  <div className="kpi-stack-value">{B.fmt(it.value)}</div>
                  <div className="kpi-stack-label">{it.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card resultado-card">
            <SectionHeading strong="RESULTADO" soft="GERAL" />
            <div className="kpi-stack-value resultado-val">{B.fmt(B.VALOR_LIQUIDO)}</div>
            <div className="kpi-stack-label">Valor líquido</div>
            <div className="kpi-stack-pct">{B.MARGEM_LIQUIDA.toFixed(2).replace(".", ",")}%</div>
            <div className="kpi-stack-label">Margem Líquida</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-title-row" style={{ marginBottom: 10 }}>
              <h2 className="card-title">Receitas e despesas</h2>
            </div>
            <div className="legend-pills">
              <span className="legend-pill green">
                <span className="dot" />
                <span className="lbl">Soma de receita</span>
                <span className="val">{B.fmtK(B.TOTAL_RECEITA)}</span>
              </span>
              <span className="legend-pill red">
                <span className="dot" />
                <span className="lbl">Soma de despesas</span>
                <span className="val">{B.fmtK(B.TOTAL_DESPESA)}</span>
              </span>
            </div>
            <OverviewBars data={B.MONTH_DATA} height={220} year={String(refYear)} onBarClick={handleBarMes} activeIdx={activeMonthIdx} />
          </div>

          <div className="card">
            <div className="card-title-row" style={{ marginBottom: 12 }}>
              <h2 className="card-title">Visualização indicadores</h2>
              <div className="ind-pills">
                {Object.keys(indicatorSeries).map(k => (
                  <button key={k} className={`ind-pill ${indicator === k ? "active" : ""}`} onClick={() => setIndicator(k)}>{k}</button>
                ))}
              </div>
            </div>
            <div className="legend-pills">
              <span className="legend-pill cyan">
                <span className="dot" />
                <span className="lbl">{indicator}</span>
                <span className="val">{indicator === "Margem Líquida"
                  ? `${(current.values.reduce((s, v) => s + v, 0) / current.values.length).toFixed(2).replace(".", ",")}%`
                  : B.fmtK(current.values.reduce((s, v) => s + v, 0))}</span>
              </span>
            </div>
            <IndicatorLine values={current.values} labels={monthLabels} height={240} color={current.color} format={current.fmt} />
          </div>
        </div>
      </div>

      {/* === EXTRAS DA RAZÃO CAIXA === */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px dashed rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 14 }}>
          Análise extra · Caixa &amp; concentração
        </div>

        {/* 4 KPIs de caixa */}
        <div className="row" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
          <div className="card">
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-2)", textTransform: "uppercase", marginBottom: 6 }}>Saldo em caixa+banco</div>
            <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono, monospace)", color: saldoTotal >= 0 ? "var(--cyan)" : "var(--red)" }}>{B.fmtK(saldoTotal)}</div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>{empresaLabel === "Consolidado" ? "soma das 3 empresas" : empresaLabel}</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-2)", textTransform: "uppercase", marginBottom: 6 }}>EBITDA caixa · {refYear}</div>
            <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono, monospace)", color: B.VALOR_LIQUIDO >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmtK(B.VALOR_LIQUIDO)}</div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>margem: <b>{B.MARGEM_LIQUIDA.toFixed(1).replace(".", ",")}%</b> · setor: 3,5%</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-2)", textTransform: "uppercase", marginBottom: 6 }}>Concentração top 5 fornecedores</div>
            <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono, monospace)", color: concentracaoCP > 85 ? "var(--red)" : concentracaoCP > 70 ? "#fbbf24" : "var(--green)" }}>{concentracaoCP.toFixed(0)}%</div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>≤70% saudável · ≥85% risco</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--fg-2)", textTransform: "uppercase", marginBottom: 6 }}>Concentração top 5 clientes</div>
            <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono, monospace)", color: "var(--cyan)" }}>{concentracaoCR.toFixed(0)}%</div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>% da receita realizada</div>
          </div>
        </div>

      </div>
    </div>
  );
};

const PageIndicators = ({ statusFilter, drilldown, setDrilldown, year, month, empresa }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const totalReceita = B.TOTAL_RECEITA;
  const totalDespesa = B.TOTAL_DESPESA;
  const valorLiq = B.VALOR_LIQUIDO;
  const margemLiq = B.MARGEM_LIQUIDA;
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  // sem segregacao de impostos no Omie sem mapeamento de categorias, deixamos 0 e mostramos "—" se nao houver dado
  const margemSeries = B.MONTH_DATA.map(m => m.receita > 0 ? ((m.receita - m.despesa) / m.receita) * 100 : 0);

  const handleBarMes = (d, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const lbl = `${(d.m || "").charAt(0).toUpperCase() + (d.m || "").slice(1, 3)}/${refYear}`;
    setDrilldown({ type: "mes", value: ym, label: lbl });
  };
  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? parseInt(drilldown.value.slice(5, 7), 10) - 1 : -1;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Indicadores</h1>
          <div className="status-line">Receita, despesa, valor líquido e margem · {statusFilter === "realizado" ? "realizado" : statusFilter === "tudo" ? "tudo" : "pendente"}</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="metric-strip">
        <div className="metric">
          <div className="m-label">Receita total</div>
          <div className="m-value">{B.fmt(totalReceita)}</div>
          <div className="m-pct">100%</div>
          <div className="m-bar"><div style={{ width: `100%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Despesa total</div>
          <div className="m-value">{B.fmt(totalDespesa)}</div>
          <div className="m-pct">{totalReceita > 0 ? `${((totalDespesa / totalReceita) * 100).toFixed(2).replace(".",",")}%` : "—"}</div>
          <div className="m-bar red"><div style={{ width: `${totalReceita > 0 ? Math.min(100, (totalDespesa / totalReceita) * 100) : 0}%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Valor líquido</div>
          <div className="m-value" style={{ color: valorLiq >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(valorLiq)}</div>
          <div className="m-pct">{margemLiq.toFixed(2).replace(".",",")}%</div>
          <div className="m-bar cyan"><div style={{ width: `${Math.min(100, Math.max(0, margemLiq))}%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Margem líquida</div>
          <div className="m-value">{margemLiq.toFixed(2).replace(".",",")}%</div>
          <div className="m-pct">média do período</div>
          <div className="m-bar"><div style={{ width: `${Math.min(100, Math.max(0, margemLiq))}%` }} /></div>
        </div>
      </div>

      <div className="row row-1-1">
        <div className="card">
          <h2 className="card-title">Margem líquida por mês</h2>
          <TrendChart
            values={margemSeries}
            labels={B.MONTHS}
            color="var(--cyan)"
            height={220}
            gradientId="ml-cyan"
          />
        </div>
        <div className="card">
          <h2 className="card-title">Receita vs Despesa por mês</h2>
          <MonthlyBars data={B.MONTH_DATA} height={240} onBarClick={handleBarMes} activeIdx={activeMonthIdx} />
        </div>
      </div>
    </div>
  );
};

const PageReceita = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month, empresa }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const mediaMes = B.TOTAL_RECEITA / 12;
  const numClientes = B.RECEITA_CLIENTES.length;
  const ticket = numClientes > 0 ? B.TOTAL_RECEITA / numClientes : 0;
  const [range, setRange] = useState("12M");
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();

  // Drilldown handlers
  const handleBarMes = (v, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const mn = B.MONTHS_FULL[i] || "";
    setDrilldown({ type: "mes", value: ym, label: `${mn.charAt(0).toUpperCase() + mn.slice(1, 3)}/${refYear}` });
  };
  const handleCategoria = (it) => setDrilldown({ type: "categoria", value: it.name, label: it.name });
  const handleCliente = (it) => setDrilldown({ type: "cliente", value: it.name, label: it.name });

  // Indices ativos para destaque
  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? parseInt(drilldown.value.slice(5, 7), 10) - 1 : -1;
  const activeCategoria = (drilldown && drilldown.type === "categoria") ? drilldown.value : null;
  const activeCliente = (drilldown && drilldown.type === "cliente") ? drilldown.value : null;

  // Extrato filtrado de receitas (usa EXTRATO_RECEITAS pre-separado pelo build,
  // fallback pro filtro inline pra compat com BIT base)
  const extratoReceitas = B.EXTRATO_RECEITAS || B.EXTRATO.filter(e => e[4] > 0);
  const extratoFiltrado = window.applyDrilldown(extratoReceitas, drilldown);
  const totalFiltrado = drilldown
    ? extratoFiltrado.reduce((s, e) => s + e[4], 0)
    : B.TOTAL_RECEITA;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Receita</h1>
          <div className="status-line">Composição por categoria, cliente e mês</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="row row-4">
        <KpiTile label="Receita total" value={(B.TOTAL_RECEITA / 1e6).toFixed(2).replace(".", ",")} unit="M" sparkValues={B.MONTH_DATA.map(m => m.receita)} sparkColor="var(--green)" tone="green" />
        <KpiTile label="Média por mês" value={(mediaMes / 1e3).toFixed(0)} unit="K" sparkValues={B.MONTH_DATA.map(m => m.receita)} sparkColor="var(--cyan)" tone="cyan" />
        <KpiTile label="Clientes" value={String(numClientes)} sparkValues={B.MONTH_DATA.map(m => m.receita > 0 ? 1 : 0)} sparkColor="var(--cyan)" tone="cyan" nonMonetary />
        <KpiTile label="Ticket médio" value={ticket > 0 ? (ticket / 1e3).toFixed(2).replace(".", ",") : "0,00"} unit="K" sparkValues={B.MONTH_DATA.map(m => m.receita / 30)} sparkColor="var(--green)" tone="green" />
      </div>

      <div className="card">
        <h2 className="card-title">Receita por mês</h2>
        <SingleBars values={B.MONTH_DATA.map(m => m.receita)} labels={B.MONTHS_FULL} color="green" height={240}
          onBarClick={handleBarMes} activeIdx={activeMonthIdx} />
      </div>

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 4fr) minmax(0, 5fr) minmax(0, 4fr)" }}>
        <div className="card">
          <h2 className="card-title">Receita por categoria</h2>
          <BarList items={B.RECEITA_CATEGORIAS} color="green" onItemClick={handleCategoria} activeName={activeCategoria} />
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Extrato de receitas {drilldown ? `· ${drilldown.label}` : ""}</h2>
          </div>
          <div className="t-scroll">
            <table className="t">
              <thead>
                <tr><th>Data</th><th>Categoria</th><th>Cliente</th><th className="num">Receita</th></tr>
              </thead>
              <tbody>
                {extratoFiltrado.slice(0, 30).map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{e[0]}</td>
                    <td>{e[2]}</td>
                    <td>{e[3]}</td>
                    <td className="num green">{B.fmt(Math.abs(e[4]))}</td>
                  </tr>
                ))}
                {extratoFiltrado.length === 0 && (
                  <tr><td colSpan="4" style={{ color: "var(--mute)", textAlign: "center", padding: 18 }}>Sem receitas no filtro selecionado</td></tr>
                )}
                <tr className="total">
                  <td colSpan="3">Total{drilldown ? " (filtrado)" : ""}</td>
                  <td className="num green">{B.fmt(totalFiltrado)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Receita por cliente</h2>
          <BarList items={B.RECEITA_CLIENTES} color="green" onItemClick={handleCliente} activeName={activeCliente} />
        </div>
      </div>

      {/* Bloco "A receber" — saldos abertos da rotina 7093 (CR pendente) */}
      <CrCpBlock data={window.getCrCp ? window.getCrCp(empresa) : null} kind="receber" B={B} fmt={B.fmt} />
    </div>
  );
};

const PageDespesa = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month, empresa }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const totalDespesa = B.TOTAL_DESPESA;
  const mediaMes = totalDespesa / 12;
  const numFornec = B.DESPESA_FORNECEDORES.length;
  const mediaDesp = numFornec > 0 ? totalDespesa / numFornec : 0;
  const [range, setRange] = useState("12M");
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();

  const handleBarMes = (v, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const mn = B.MONTHS_FULL[i] || "";
    setDrilldown({ type: "mes", value: ym, label: `${mn.charAt(0).toUpperCase() + mn.slice(1, 3)}/${refYear}` });
  };
  const handleCategoria = (it) => setDrilldown({ type: "categoria", value: it.name, label: it.name });
  const handleFornecedor = (it) => setDrilldown({ type: "fornecedor", value: it.name, label: it.name });

  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? parseInt(drilldown.value.slice(5, 7), 10) - 1 : -1;
  const activeCategoria = (drilldown && drilldown.type === "categoria") ? drilldown.value : null;
  const activeFornecedor = (drilldown && drilldown.type === "fornecedor") ? drilldown.value : null;

  // Extrato filtrado de despesas (usa EXTRATO_DESPESAS pre-separado, fallback inline)
  const extratoDespesas = B.EXTRATO_DESPESAS || B.EXTRATO.filter(e => e[4] < 0);
  const extratoFiltrado = window.applyDrilldown(extratoDespesas, drilldown);
  const totalFiltrado = drilldown
    ? Math.abs(extratoFiltrado.reduce((s, e) => s + e[4], 0))
    : totalDespesa;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Despesa</h1>
          <div className="status-line">Composição por categoria, fornecedor e mês</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="row row-4">
        <KpiTile label="Despesas totais" value={(totalDespesa / 1e6).toFixed(2).replace(".", ",")} unit="M" sparkValues={B.MONTH_DATA.map(m => m.despesa)} sparkColor="var(--red)" tone="red" />
        <KpiTile label="Média por mês" value={(mediaMes / 1e3).toFixed(0)} unit="K" sparkValues={B.MONTH_DATA.map(m => m.despesa)} sparkColor="var(--red)" tone="red" />
        <KpiTile label="Fornecedores" value={String(numFornec)} sparkValues={B.MONTH_DATA.map(m => m.despesa > 0 ? 1 : 0)} sparkColor="var(--cyan)" tone="cyan" nonMonetary />
        <KpiTile label="Média de despesa" value={mediaDesp > 0 ? (mediaDesp / 1e3).toFixed(2).replace(".", ",") : "0,00"} unit="K" sparkValues={B.MONTH_DATA.map(m => m.despesa / 30)} sparkColor="var(--red)" tone="red" />
      </div>

      {/* === LAYOUT PADRÃO RESTAURADO === */}
      <div className="card">
        <h2 className="card-title">Despesa por mês</h2>
        <SingleBars values={B.MONTH_DATA.map(m => m.despesa)} labels={B.MONTHS_FULL} color="red" height={240}
          onBarClick={handleBarMes} activeIdx={activeMonthIdx} />
      </div>

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 4fr) minmax(0, 5fr) minmax(0, 4fr)" }}>
        <div className="card">
          <h2 className="card-title">Despesas por categoria</h2>
          <BarList items={B.DESPESA_CATEGORIAS} color="red" onItemClick={handleCategoria} activeName={activeCategoria} />
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Extrato de despesas {drilldown ? `· ${drilldown.label}` : ""}</h2>
          </div>
          <div className="t-scroll">
            <table className="t">
              <thead>
                <tr><th>Data</th><th>Categoria</th><th>Fornecedor</th><th className="num">Despesa</th></tr>
              </thead>
              <tbody>
                {extratoFiltrado.slice(0, 30).map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{e[0]}</td>
                    <td>{e[2]}</td>
                    <td>{e[3]}</td>
                    <td className="num red">{B.fmt(Math.abs(e[4]))}</td>
                  </tr>
                ))}
                {extratoFiltrado.length === 0 && (
                  <tr><td colSpan="4" style={{ color: "var(--mute)", textAlign: "center", padding: 18 }}>Sem despesas no filtro selecionado</td></tr>
                )}
                <tr className="total">
                  <td colSpan="3">Total{drilldown ? " (filtrado)" : ""}</td>
                  <td className="num red">{B.fmt(totalFiltrado)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Despesas por fornecedor</h2>
          <BarList items={B.DESPESA_FORNECEDORES} color="red" onItemClick={handleFornecedor} activeName={activeFornecedor} />
        </div>
      </div>

      {/* === EXTRAS: Treemap + Pareto === */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px dashed rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 14 }}>
          Análise extra · concentração de fornecedores
        </div>

        <div className="row" style={{ gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)" }}>
          <div className="card">
            <div className="card-title-row" style={{ marginBottom: 10 }}>
              <h2 className="card-title">Mapa de fornecedores (treemap)</h2>
              <div style={{ fontSize: 11, color: "var(--fg-2)" }}>área = R$ pago · clique pra filtrar</div>
            </div>
            <Treemap
              data={(window.SURROGATES && window.SURROGATES.TOP_FORNECEDORES || B.DESPESA_FORNECEDORES).map(f => ({
                name: f.nome || f.name, value: f.valor || f.value
              }))}
              height={320}
              onClick={(t) => setDrilldown({ type: "fornecedor", value: t.name, label: t.name })}
            />
          </div>

          <div className="card">
            <div className="card-title-row" style={{ marginBottom: 10 }}>
              <h2 className="card-title">Pareto 80/20</h2>
              <div style={{ fontSize: 11, color: "var(--fg-2)" }}>vermelho = 80% do gasto</div>
            </div>
            <Pareto
              data={(window.SURROGATES && window.SURROGATES.TOP_FORNECEDORES || B.DESPESA_FORNECEDORES).slice(0, 20).map(f => ({
                name: f.nome || f.name, value: f.valor || f.value
              }))}
              height={300}
              formatFn={(v) => B.fmtK(v)}
            />
          </div>
        </div>
      </div>

      {/* Bloco "A pagar" — saldos abertos da rotina 7093 (CP pendente) */}
      <CrCpBlock data={window.getCrCp ? window.getCrCp(empresa) : null} kind="pagar" B={B} fmt={B.fmt} />
    </div>
  );
};

// =============================================================================
// PageIndicadoresContabeis — KPIs do Balanço Patrimonial e DRE oficiais
// (Balancete jan-fev 2026 do contador). Para empresas SEM balancete oficial
// (ex: DC COMERCIO), os cards continuam "DADO INDISPONÍVEL".
// Lucro / Receita / EBITDA são ANUALIZADOS (× 6) a partir do periodo conhecido.
// =============================================================================

// fmtBR — formata números BR (sem prefixo)
const fmtBR = (n, dec = 2) => {
  if (n == null || !isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const parts = abs.toFixed(dec).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${parts.join(",")}`;
};
const fmtPctNum = (n, dec = 1) => (n == null || !isFinite(n)) ? "—" : `${fmtBR(n, dec)}%`;
const fmtRatio  = (n, dec = 2) => (n == null || !isFinite(n)) ? "—" : fmtBR(n, dec);
const fmtMoneyK = (n) => {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}R$ ${fmtBR(abs/1e6, 2)} M`;
  if (abs >= 1e3) return `${sign}R$ ${fmtBR(abs/1e3, 1)} K`;
  return `${sign}R$ ${fmtBR(abs, 0)}`;
};

// Avalia status de um KPI vs threshold.
//   thresholds: { good: <op>, mid: <op> }   onde op = (v) => bool
// Retorna 'good' | 'mid' | 'bad' | 'neutral'
const evalStatus = (v, good, mid) => {
  if (v == null || !isFinite(v)) return "neutral";
  if (good(v)) return "good";
  if (mid && mid(v)) return "mid";
  return "bad";
};
const STATUS_STYLE = {
  good:    { color: "var(--green, #34d399)",  bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.32)", label: "OK" },
  mid:     { color: "var(--yellow, #fbbf24)", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.32)", label: "ATENÇÃO" },
  bad:     { color: "var(--red, #f87171)",    bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.32)", label: "RUIM" },
  neutral: { color: "var(--fg-2)",            bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.10)", label: "—" },
};

// Card de KPI calculado
const KpiContabilCard = ({ name, valueDisplay, statusKey, benchmark, formula, raw }) => {
  const st = STATUS_STYLE[statusKey || "neutral"];
  return (
    <div style={{
      background: st.bg,
      border: `1px solid ${st.border}`,
      borderRadius: 8,
      padding: 14,
      position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{name}</div>
        <span style={{
          fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
          color: st.color, padding: "2px 6px", borderRadius: 4,
          border: `1px solid ${st.border}`,
        }}>{st.label}</span>
      </div>
      <div style={{
        marginTop: 8, fontSize: 24, fontWeight: 300, color: st.color,
        fontFamily: "JetBrains Mono, monospace", letterSpacing: "-0.02em",
      }}>{valueDisplay}</div>
      {benchmark && (
        <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>
          referência: <span style={{ color: "var(--cyan, #22d3ee)" }}>{benchmark}</span>
        </div>
      )}
      {formula && (
        <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 6, fontFamily: "JetBrains Mono, monospace", opacity: 0.75 }}>
          {formula}
        </div>
      )}
      {raw && (
        <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 4, opacity: 0.75 }}>
          {raw}
        </div>
      )}
    </div>
  );
};

// Card "DADO INDISPONÍVEL" (fallback para empresas sem balancete)
const KpiIndisponivelCard = ({ name, benchmark, formula, motivo }) => (
  <div style={{
    background: "rgba(255,255,255,0.02)",
    border: "1px dashed rgba(255,255,255,0.1)",
    borderRadius: 8, padding: 14, opacity: 0.85,
  }}>
    <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(251, 191, 36, 0.85)", marginBottom: 6, fontWeight: 600 }}>
      Dado indisponível
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{name}</div>
    <div style={{ fontSize: 11, color: "var(--fg-2)", marginBottom: 6, fontFamily: "JetBrains Mono, monospace" }}>
      {formula}
    </div>
    {benchmark && (
      <div style={{ fontSize: 11, color: "var(--cyan, #22d3ee)" }}>
        referência: {benchmark}
      </div>
    )}
    {motivo && (
      <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 4 }}>{motivo}</div>
    )}
  </div>
);

const PageIndicadoresContabeis = ({ empresa }) => {
  const SUR   = (typeof window !== "undefined" && window.SURROGATES) || {};
  const BENCH = SUR.BENCHMARKS || {};
  const ICALL = (typeof window !== "undefined" && window.INDICADORES_CONTABEIS) || {};
  const EMP   = (typeof window !== "undefined" && window.EMPRESAS) || [];

  // Resolve indicadores pra empresa selecionada (codigo: '0'=consolidado, '1'/'2'/'4')
  const empCode = empresa || "0";
  const ind = ICALL[empCode] || (empCode === "0" ? ICALL["0"] : null);
  const empresaLabel = (!empresa || empresa === "0")
    ? "Consolidado"
    : ((EMP.find(e => e.codigo === empresa) || {}).label || empresa);
  const balanceteAvailable = !!ind;
  const cobertura = ICALL._cobertura || "";

  const periodo = ind ? ind.periodo : "JAN-FEV 2026 (contador)";
  const div_ebitda_bench = BENCH.DIVIDA_EBITDA_SETOR || 3.9;

  // Status helpers
  const statusOf = balanceteAvailable
    ? {
        liq_corrente: evalStatus(ind.liquidez.corrente, v => v >= 1.5, v => v >= 1.0),
        liq_geral:    evalStatus(ind.liquidez.geral,    v => v >= 1.2, v => v >= 1.0),
        liq_imediata: evalStatus(ind.liquidez.imediata, v => v >= 0.3, v => v >= 0.15),
        liq_seca:     evalStatus(ind.liquidez.seca,     v => v >= 1.0, v => v >= 0.7),
        cap_proprio:  evalStatus(ind.estrutura.capital_proprio_pct,   v => v >= 50, v => v >= 30),
        cap_terc:     evalStatus(ind.estrutura.capital_terceiros_pct, v => v <= 50, v => v <= 70),
        roe:          evalStatus(ind.rentabilidade.roe_pct, v => v >= 15, v => v >= 8),
        roa:          evalStatus(ind.rentabilidade.roa_pct, v => v >= 5,  v => v >= 2),
        ros:          evalStatus(ind.rentabilidade.ros_pct, v => v >= 5,  v => v >= 2),
        div_ebitda:   evalStatus(ind.endividamento.divida_ebitda, v => v <= div_ebitda_bench, v => v <= div_ebitda_bench * 1.5),
        endiv_oneroso: evalStatus(ind.endividamento.endividamento_oneroso_pct, v => v <= 40, v => v <= 60),
        ciclo_fin:    evalStatus(ind.ciclo.ciclo_financeiro, v => v <= 60, v => v <= 120),
      }
    : {};

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Indicadores Contábeis</h1>
          <div className="status-line">
            {empresaLabel} · {periodo} · fonte: Razão Contábil oficial do contador
            {cobertura && balanceteAvailable && empCode === "0" && (
              <span style={{ marginLeft: 6, color: "var(--fg-2)" }}>· cobertura: {cobertura}</span>
            )}
          </div>
        </div>
      </div>

      {!balanceteAvailable && (
        <div className="card" style={{ marginBottom: 16, border: "1px solid rgba(251, 191, 36, 0.3)", background: "rgba(251, 191, 36, 0.05)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 24, lineHeight: 1 }}>⚠</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Balancete não disponível para {empresaLabel}</div>
              <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5 }}>
                O contador entregou o balancete oficial e DRE analítica jan-fev 2026 apenas
                para <b>GLOBALMAC</b> e <b>DC TRACTOR</b>. Para esta empresa, os indicadores
                que dependem do Balanço Patrimonial estão indisponíveis até receber o fechamento.
              </div>
            </div>
          </div>
        </div>
      )}

      {balanceteAvailable && (
        <div className="card" style={{ marginBottom: 16, border: "1px solid rgba(34, 211, 238, 0.25)", background: "rgba(34,211,238,0.04)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 22, lineHeight: 1, color: "var(--cyan, #22d3ee)" }}>ⓘ</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.55 }}>
              <b style={{ color: "var(--fg-1)" }}>Metodologia.</b> Balanço usa saldo final
              fev/2026. Lucro, Receita, EBITDA e CMV são <b>anualizados</b> a partir do
              período jan-fev (×6). PMR, PMP e PME usam dias do período (59 dias).
              EBITDA é proxy = Lucro Bruto − Despesas Operacionais (não inclui add-back de
              depreciação por falta da nota do contador). Status: <span style={{ color: STATUS_STYLE.good.color }}>verde</span> = bom,
              {" "}<span style={{ color: STATUS_STYLE.mid.color }}>amarelo</span> = atenção,
              {" "}<span style={{ color: STATUS_STYLE.bad.color }}>vermelho</span> = ruim.
            </div>
          </div>
        </div>
      )}

      {/* ===== Liquidez ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Liquidez</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          {balanceteAvailable ? (
            <>
              <KpiContabilCard
                name="Liquidez Corrente"
                valueDisplay={fmtRatio(ind.liquidez.corrente)}
                statusKey={statusOf.liq_corrente}
                benchmark="≥ 1,50"
                formula="AC ÷ PC"
                raw={`AC ${fmtMoneyK(ind.raw.ativo_circulante)} / PC ${fmtMoneyK(ind.raw.passivo_circulante)}`}
              />
              <KpiContabilCard
                name="Liquidez Geral"
                valueDisplay={fmtRatio(ind.liquidez.geral)}
                statusKey={statusOf.liq_geral}
                benchmark="≥ 1,20"
                formula="(AC + ARLP) ÷ (PC + PNC)"
                raw={`(${fmtMoneyK(ind.raw.ativo_circulante)}) / (${fmtMoneyK(ind.raw.passivo_circulante + ind.raw.passivo_nao_circulante)})`}
              />
              <KpiContabilCard
                name="Liquidez Imediata"
                valueDisplay={fmtRatio(ind.liquidez.imediata)}
                statusKey={statusOf.liq_imediata}
                benchmark="≥ 0,30"
                formula="Disponível ÷ PC"
                raw={`${fmtMoneyK(ind.raw.disponivel)} / ${fmtMoneyK(ind.raw.passivo_circulante)}`}
              />
              <KpiContabilCard
                name="Liquidez Seca"
                valueDisplay={fmtRatio(ind.liquidez.seca)}
                statusKey={statusOf.liq_seca}
                benchmark="≥ 1,00"
                formula="(AC − Estoques) ÷ PC"
                raw={`Estoques: ${fmtMoneyK(ind.raw.estoques)}`}
              />
            </>
          ) : (
            <>
              <KpiIndisponivelCard name="Liquidez Corrente" benchmark="≥ 1,50" formula="AC ÷ PC" />
              <KpiIndisponivelCard name="Liquidez Geral"    benchmark="≥ 1,20" formula="(AC + ARLP) ÷ (PC + PNC)" />
              <KpiIndisponivelCard name="Liquidez Imediata" benchmark="≥ 0,30" formula="Disponível ÷ PC" />
              <KpiIndisponivelCard name="Liquidez Seca"     benchmark="≥ 1,00" formula="(AC − Estoques) ÷ PC" />
            </>
          )}
        </div>
      </div>

      {/* ===== Estrutura de Capital ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Estrutura de Capital</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          {balanceteAvailable ? (
            <>
              <KpiContabilCard
                name="Capital Próprio (% do Ativo)"
                valueDisplay={fmtPctNum(ind.estrutura.capital_proprio_pct)}
                statusKey={statusOf.cap_proprio}
                benchmark="≥ 50%"
                formula="PL ÷ Ativo Total"
                raw={`PL ${fmtMoneyK(ind.raw.patrimonio_liquido)} / At ${fmtMoneyK(ind.raw.ativo_total)}`}
              />
              <KpiContabilCard
                name="Capital de Terceiros (% do Ativo)"
                valueDisplay={fmtPctNum(ind.estrutura.capital_terceiros_pct)}
                statusKey={statusOf.cap_terc}
                benchmark="≤ 50%"
                formula="(PC + PNC) ÷ Ativo Total"
                raw={`PC+PNC ${fmtMoneyK(ind.raw.passivo_circulante + ind.raw.passivo_nao_circulante)}`}
              />
              <KpiContabilCard
                name="Imobilizado / Ativo"
                valueDisplay={fmtPctNum(ind.estrutura.imobilizado_ativo_pct)}
                statusKey="neutral"
                benchmark="varia"
                formula="Imobilizado Líquido ÷ Ativo Total"
                raw={`Imob ${fmtMoneyK(ind.raw.imobilizado)}`}
              />
            </>
          ) : (
            <>
              <KpiIndisponivelCard name="Capital Próprio (% do Ativo)" benchmark="≥ 50%" formula="PL ÷ Ativo Total" />
              <KpiIndisponivelCard name="Capital de Terceiros (% do Ativo)" benchmark="≤ 50%" formula="(PC + PNC) ÷ Ativo Total" />
              <KpiIndisponivelCard name="Imobilizado / Ativo" benchmark="varia" formula="Imobilizado ÷ Ativo Total" />
            </>
          )}
        </div>
      </div>

      {/* ===== Endividamento ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Endividamento</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          {balanceteAvailable ? (
            <>
              <KpiContabilCard
                name="Dívida Líquida ÷ EBITDA"
                valueDisplay={ind.endividamento.divida_ebitda != null ? `${fmtBR(ind.endividamento.divida_ebitda, 1)}x` : "—"}
                statusKey={statusOf.div_ebitda}
                benchmark={`≤ ${div_ebitda_bench}x (setor)`}
                formula="(Empréstimos − Disponível) ÷ EBITDA anual"
                raw={`Dív Líq ${fmtMoneyK(ind.raw.divida_liquida)} / EBITDA anual ${fmtMoneyK(ind.raw.ebitda_anual_estimado)}`}
              />
              <KpiContabilCard
                name="Endividamento Oneroso"
                valueDisplay={fmtPctNum(ind.endividamento.endividamento_oneroso_pct)}
                statusKey={statusOf.endiv_oneroso}
                benchmark="≤ 40%"
                formula="Empréstimos ÷ (Empréstimos + PL)"
                raw={`Empréstimos PC+PNC ${fmtMoneyK(ind.raw.divida_total)}`}
              />
              <KpiContabilCard
                name="Empréstimos PC"
                valueDisplay={fmtMoneyK(ind.raw.emprestimos_pc)}
                statusKey="neutral"
                formula="2.01.01 + 2.01.02 (curto prazo)"
              />
              <KpiContabilCard
                name="Empréstimos PNC"
                valueDisplay={fmtMoneyK(ind.raw.emprestimos_pnc)}
                statusKey="neutral"
                formula="2.03 (longo prazo)"
              />
            </>
          ) : (
            <>
              <KpiIndisponivelCard name="Dívida Líquida ÷ EBITDA" benchmark={`≤ ${div_ebitda_bench}x`} formula="(Empréstimos − Caixa) ÷ EBITDA" />
              <KpiIndisponivelCard name="Endividamento Oneroso" benchmark="≤ 40%" formula="Empréstimos ÷ (Empréstimos + PL)" />
              <KpiIndisponivelCard name="Empréstimos PC" formula="2.01.01 + 2.01.02" />
              <KpiIndisponivelCard name="Empréstimos PNC" formula="2.03" />
            </>
          )}
        </div>
      </div>

      {/* ===== Rentabilidade ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Rentabilidade <span style={{ fontSize: 11, color: "var(--fg-2)", fontWeight: 400 }}>(anualizado a partir de jan-fev/2026)</span></h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          {balanceteAvailable ? (
            <>
              <KpiContabilCard
                name="ROE — Retorno sobre PL"
                valueDisplay={fmtPctNum(ind.rentabilidade.roe_pct)}
                statusKey={statusOf.roe}
                benchmark="≥ 15%"
                formula="Lucro Líquido anual ÷ PL"
                raw={`Lucro anual ${fmtMoneyK(ind.raw.lucro_anual_estimado)} / PL ${fmtMoneyK(ind.raw.patrimonio_liquido)}`}
              />
              <KpiContabilCard
                name="ROA — Retorno sobre o Ativo"
                valueDisplay={fmtPctNum(ind.rentabilidade.roa_pct)}
                statusKey={statusOf.roa}
                benchmark="≥ 5%"
                formula="Lucro Líquido anual ÷ Ativo Total"
              />
              <KpiContabilCard
                name="ROS — Margem Líquida"
                valueDisplay={fmtPctNum(ind.rentabilidade.ros_pct)}
                statusKey={statusOf.ros}
                benchmark="≥ 5% (setor)"
                formula="Lucro Líquido ÷ Receita Líquida"
              />
              <KpiContabilCard
                name="Giro do Ativo"
                valueDisplay={ind.rentabilidade.giro_ativo != null ? `${fmtBR(ind.rentabilidade.giro_ativo, 2)}x` : "—"}
                statusKey="neutral"
                benchmark="varia"
                formula="Receita Líquida anual ÷ Ativo Total"
                raw={`Rec anual ${fmtMoneyK(ind.raw.receita_anual_estimada)}`}
              />
            </>
          ) : (
            <>
              <KpiIndisponivelCard name="ROE — Retorno sobre PL" benchmark="≥ 15%" formula="Lucro Líquido ÷ PL" />
              <KpiIndisponivelCard name="ROA — Retorno sobre o Ativo" benchmark="≥ 5%" formula="Lucro Líquido ÷ Ativo Total" />
              <KpiIndisponivelCard name="ROS — Margem Líquida" benchmark="≥ 5%" formula="Lucro Líquido ÷ Receita Líquida" />
              <KpiIndisponivelCard name="Giro do Ativo" benchmark="varia" formula="Receita ÷ Ativo Total" />
            </>
          )}
        </div>
      </div>

      {/* ===== Capital de Giro & Ciclo ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Capital de Giro & Ciclo Financeiro</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          {balanceteAvailable ? (
            <>
              <KpiContabilCard
                name="PMR — Prazo Médio de Recebimento"
                valueDisplay={ind.ciclo.pmr_dias != null ? `${fmtBR(ind.ciclo.pmr_dias, 0)} dias` : "—"}
                statusKey="neutral"
                formula="(Clientes ÷ Receita Bruta) × 59"
                raw={`Clientes ${fmtMoneyK(ind.raw.clientes)}`}
              />
              <KpiContabilCard
                name="PMP — Prazo Médio de Pagamento"
                valueDisplay={ind.ciclo.pmp_dias != null ? `${fmtBR(ind.ciclo.pmp_dias, 0)} dias` : "—"}
                statusKey="neutral"
                formula="(Fornecedores ÷ CMV) × 59 — proxy"
                raw={`Fornec ${fmtMoneyK(ind.raw.fornecedores)}`}
              />
              <KpiContabilCard
                name="PME — Prazo Médio de Estoque"
                valueDisplay={ind.ciclo.pme_dias != null ? `${fmtBR(ind.ciclo.pme_dias, 0)} dias` : "—"}
                statusKey="neutral"
                formula="(Estoques ÷ CMV) × 59"
                raw={`Estoques ${fmtMoneyK(ind.raw.estoques)}`}
              />
              <KpiContabilCard
                name="Ciclo Financeiro"
                valueDisplay={ind.ciclo.ciclo_financeiro != null ? `${fmtBR(ind.ciclo.ciclo_financeiro, 0)} dias` : "—"}
                statusKey={statusOf.ciclo_fin}
                benchmark="≤ 60 dias"
                formula="PMR + PME − PMP"
              />
              <KpiContabilCard
                name="NCG — Necessidade de Capital de Giro"
                valueDisplay={fmtMoneyK(ind.ciclo.ncg)}
                statusKey="neutral"
                formula="ACO − PCO (operacional)"
                raw="AC − Disponível − (Empréstimos PC + Dup. Descontadas)"
              />
              <KpiContabilCard
                name="Giro do Estoque"
                valueDisplay={ind.ciclo.giro_estoque != null ? `${fmtBR(ind.ciclo.giro_estoque, 2)}x/ano` : "—"}
                statusKey="neutral"
                formula="CMV anual ÷ Estoques"
              />
            </>
          ) : (
            <>
              <KpiIndisponivelCard name="PMR — Prazo Médio de Recebimento" formula="(Clientes ÷ Receita) × dias" />
              <KpiIndisponivelCard name="PMP — Prazo Médio de Pagamento" formula="(Fornec ÷ CMV) × dias" />
              <KpiIndisponivelCard name="PME — Prazo Médio de Estoque" formula="(Estoques ÷ CMV) × dias" />
              <KpiIndisponivelCard name="Ciclo Financeiro" benchmark="≤ 60 dias" formula="PMR + PME − PMP" />
              <KpiIndisponivelCard name="NCG — Necessidade de Capital de Giro" formula="ACO − PCO" />
              <KpiIndisponivelCard name="Giro do Estoque" formula="CMV ÷ Estoques" />
            </>
          )}
        </div>
      </div>

      {/* ===== Resumo do Balanço (apenas quando temos balancete) ===== */}
      {balanceteAvailable && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="card-title">Resumo do Balanço — fev/2026</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 8, fontWeight: 600 }}>Ativo</div>
              <BalanceLine label="Disponível" v={ind.raw.disponivel} />
              <BalanceLine label="Clientes"   v={ind.raw.clientes} />
              <BalanceLine label="Estoques"   v={ind.raw.estoques} />
              <BalanceLine label="Outros AC"  v={ind.raw.ativo_circulante - ind.raw.disponivel - ind.raw.clientes - ind.raw.estoques} />
              <BalanceLine label="Ativo Circulante" v={ind.raw.ativo_circulante} bold />
              <BalanceLine label="Imobilizado Líquido" v={ind.raw.imobilizado} />
              <BalanceLine label="Outros ANC" v={ind.raw.ativo_nao_circulante - ind.raw.imobilizado} />
              <BalanceLine label="Ativo Não Circulante" v={ind.raw.ativo_nao_circulante} bold />
              <BalanceLine label="ATIVO TOTAL" v={ind.raw.ativo_total} bold highlight />
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 8, fontWeight: 600 }}>Passivo + PL</div>
              <BalanceLine label="Empréstimos PC"  v={ind.raw.emprestimos_pc} />
              <BalanceLine label="Fornecedores"    v={ind.raw.fornecedores} />
              <BalanceLine label="Outros PC"       v={ind.raw.passivo_circulante - ind.raw.emprestimos_pc - ind.raw.fornecedores} />
              <BalanceLine label="Passivo Circulante" v={ind.raw.passivo_circulante} bold />
              <BalanceLine label="Empréstimos PNC" v={ind.raw.emprestimos_pnc} />
              <BalanceLine label="Passivo Não Circ." v={ind.raw.passivo_nao_circulante} bold />
              <BalanceLine label="Patrimônio Líquido" v={ind.raw.patrimonio_liquido} bold />
              <BalanceLine label="PASSIVO + PL"   v={ind.raw.passivo_circulante + ind.raw.passivo_nao_circulante + ind.raw.patrimonio_liquido} bold highlight />
            </div>
          </div>
        </div>
      )}

      {BENCH.EBITDA_MARGIN_SETOR && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="card-title">Benchmarks setoriais (referência)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
            <BenchmarkTile label="Margem EBITDA setor" value={`${BENCH.EBITDA_MARGIN_SETOR}%`} fonte="The AgriBiz / Vamos S.A. 2024" />
            <BenchmarkTile label="Dívida Líq. / EBITDA" value={`${BENCH.DIVIDA_EBITDA_SETOR}x`} fonte="AgFeed (covenant SLC = 4,0x) · 2025" />
            <BenchmarkTile label="Absorção (concessionária EUA)" value={`${BENCH.ABSORCAO_PCT_IDEAL}%`} fonte="Farm Equipment Magazine · WEDA" />
            <BenchmarkTile label="Inadimplência agro 2T2025" value={`${BENCH.INADIMPLENCIA_AGRO}%`} fonte="Serasa via Gazeta do Povo · 2025" />
          </div>
        </div>
      )}
    </div>
  );
};

const BalanceLine = ({ label, v, bold, highlight }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", padding: "4px 0",
    borderBottom: highlight ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
    fontSize: 12,
    color: highlight ? "var(--cyan, #22d3ee)" : (bold ? "var(--fg-1)" : "var(--fg-2)"),
    fontWeight: bold ? 600 : 400,
  }}>
    <span>{label}</span>
    <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{fmtMoneyK(v)}</span>
  </div>
);

const BenchmarkTile = ({ label, value, fonte }) => (
  <div style={{ background: "rgba(34, 211, 238, 0.06)", border: "1px solid rgba(34, 211, 238, 0.2)", borderRadius: 8, padding: 14 }}>
    <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 300, fontFamily: "JetBrains Mono, monospace", color: "var(--cyan, #22d3ee)" }}>
      {value}
    </div>
    <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 6 }}>
      {fonte}
    </div>
  </div>
);

// =============================================================================
// PageReceitaLinha — receita por linha de negocio (tratores novos/usados,
// implementos novos/usados, pecas, servicos) com drill-down por marca em
// tratores_novos e implementos_novos.
//
// Fonte: window.RECEITA_LINHA, gerado por parse-receita-linha.py + build-data.cjs.
// Cubo principal: por_empresa_mes [{empresa, ano_mes, linha, valor, pct}].
// =============================================================================

// Stacked bar chart por mes — 6 linhas de negocio empilhadas. Cada coluna mostra
// o total do mes; passar mouse mostra breakdown via title.
const StackedMonthBars = ({ months, series, height = 280, onBarClick, activeMonth }) => {
  const B = window.BIT;
  const totals = months.map(m => series.reduce((s, sr) => s + (sr.values[months.indexOf(m)] || 0), 0));
  const max = Math.max(...totals, 1);
  const niceMax = Math.ceil(max / 1e6) * 1e6;
  const ticks = [];
  for (let v = 0; v <= niceMax; v += niceMax / 5) ticks.push(v);
  const hasActive = activeMonth != null;
  return (
    <div className="ov-bars">
      <div className="ov-bars-plot" style={{ height }}>
        <div className="ov-bars-axis">
          {ticks.map((t, i) => (
            <div key={i} className="ov-bars-tick" style={{ bottom: `${(t / niceMax) * 100}%` }}>
              <span>R${(t / 1e6).toFixed(1)}M</span>
            </div>
          ))}
        </div>
        <div className="ov-bars-cols">
          {months.map((m, i) => {
            const total = totals[i];
            const isActive = hasActive && m === activeMonth;
            const cls = "ov-bar-col" + (onBarClick ? " clickable" : "") +
              (isActive ? " active" : "") + (hasActive && !isActive ? " dimmed" : "");
            return (
              <div key={i} className={cls}
                onClick={onBarClick ? () => onBarClick(m, i) : undefined}
                style={{ cursor: onBarClick ? "pointer" : undefined, display: "flex", flexDirection: "column-reverse", height: "100%" }}
                title={`${m}: ${B.fmtK(total)}`}
              >
                {series.map((sr, sIdx) => {
                  const v = sr.values[i] || 0;
                  if (v <= 0) return null;
                  const pct = (v / niceMax) * 100;
                  return (
                    <div key={sIdx} style={{ width: 22, height: `${pct}%`, background: sr.color, alignSelf: "center" }}
                      title={`${sr.label} ${m}: ${B.fmt(v)}`} />
                  );
                })}
                <span className="ov-bar-chip" style={{ position: "absolute", bottom: -22, fontSize: 10 }}>
                  {B.fmtK(total)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ov-bars-x">
        {months.map((m, i) => <span key={i}>{m.slice(5, 7)}/{m.slice(2, 4)}</span>)}
      </div>
    </div>
  );
};

const LINHA_COLORS = {
  tratores_novos:     "#22c55e",  // verde
  tratores_usados:    "#16a34a",  // verde escuro
  implementos_novos:  "#22d3ee",  // cyan
  implementos_usados: "#0891b2",  // cyan escuro
  pecas:              "#a78bfa",  // roxo
  servicos:           "#f59e0b",  // amarelo
};

const PageReceitaLinha = ({ statusFilter, drilldown, setDrilldown, year, month, empresa }) => {
  const RL = (typeof window !== "undefined") ? window.RECEITA_LINHA : null;
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);

  if (!RL) {
    return (
      <div className="page">
        <div className="page-title"><div><h1>Receita por Linha de Negócio</h1>
          <div className="status-line">Dado indisponível — rode <code>python parse-receita-linha.py</code></div>
        </div></div>
      </div>
    );
  }

  const linhas = RL.meta.linhas; // ordem fixa
  const labelOf = (l) => RL.linhas_def[l] || l;
  const empresaLabel = (empresa && empresa !== "0")
    ? (window.EMPRESAS.find(e => String(e.codigo) === String(empresa)) || {}).label || null
    : null;

  // Filtra cubo por empresa/year/month conforme filtros globais
  const cube = useMemo(() => {
    let rows = RL.por_empresa_mes;
    if (empresaLabel) rows = rows.filter(r => r.empresa === empresaLabel);
    if (year && year > 0) rows = rows.filter(r => r.ano_mes.startsWith(String(year)));
    if (month && month >= 1 && month <= 12) {
      const mm = String(month).padStart(2, "0");
      rows = rows.filter(r => r.ano_mes.endsWith("-" + mm));
    }
    return rows;
  }, [RL, empresaLabel, year, month]);

  // Agrega por linha (totais filtrados)
  const totaisLinha = useMemo(() => {
    const acc = Object.fromEntries(linhas.map(l => [l, 0]));
    for (const r of cube) acc[r.linha] = (acc[r.linha] || 0) + r.valor;
    return acc;
  }, [cube, linhas]);
  const totalReceita = linhas.reduce((s, l) => s + (totaisLinha[l] || 0), 0);

  // Lista de meses presentes (ordenada)
  const months = useMemo(() => {
    const set = new Set(cube.map(r => r.ano_mes));
    return Array.from(set).sort();
  }, [cube]);

  // Series para stacked bar (uma serie por linha)
  const series = useMemo(() => linhas.map(l => ({
    id: l,
    label: labelOf(l),
    color: LINHA_COLORS[l] || "#6b7686",
    values: months.map(m => {
      let v = 0;
      for (const r of cube) {
        if (r.ano_mes === m && r.linha === l) v += r.valor;
      }
      return v;
    }),
  })), [cube, months, linhas]);

  // KPI tiles: 6 cards (1 por linha) com valor + pct
  const linhaKpis = linhas.map(l => ({
    id: l,
    label: labelOf(l),
    valor: totaisLinha[l] || 0,
    pct: totalReceita > 0 ? ((totaisLinha[l] || 0) / totalReceita) * 100 : 0,
    color: LINHA_COLORS[l],
    spark: months.map(m => {
      let v = 0;
      for (const r of cube) if (r.ano_mes === m && r.linha === l) v += r.valor;
      return v;
    }),
  }));

  // Drilldown local para linha selecionada (mostra marcas se aplicavel)
  const [linhaSel, setLinhaSel] = useState(null);
  const linhaParaMarcas = (linhaSel === "tratores_novos") ? RL.marcas_tratores_novos
    : (linhaSel === "implementos_novos") ? RL.marcas_implementos_novos : null;

  // Filtra marcas pela empresa selecionada (usa por_empresa do JSON)
  const marcasGlobalFiltradas = useMemo(() => {
    if (!linhaParaMarcas) return [];
    if (!empresaLabel) return linhaParaMarcas.global;
    const pe = linhaParaMarcas.por_empresa[empresaLabel] || {};
    const totalEmp = Object.values(pe).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(pe)
      .map(([marca, valor]) => ({ marca, valor, pct: (valor / totalEmp) * 100 }))
      .sort((a, b) => b.valor - a.valor);
  }, [linhaParaMarcas, empresaLabel]);

  // Tabela mes x linha
  const tabela = months.map(m => {
    const row = { ano_mes: m, total: 0 };
    for (const l of linhas) {
      let v = 0;
      for (const r of cube) if (r.ano_mes === m && r.linha === l) v += r.valor;
      row[l] = v;
      row.total += v;
    }
    return row;
  });

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Receita por Linha de Negócio</h1>
          <div className="status-line">
            {empresaLabel || "Consolidado"} ·
            {year && year > 0 ? ` ${year}` : " todos os anos"}
            {month && month >= 1 ? ` · mês ${String(month).padStart(2, "0")}` : ""} ·
            {" "}{cube.length.toLocaleString("pt-BR")} linhas filtradas
          </div>
        </div>
      </div>

      <div className="row" style={{ gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {linhaKpis.map(k => (
          <div key={k.id} className="card" style={{ padding: 12, cursor: "pointer", borderLeft: `3px solid ${k.color}`, opacity: linhaSel && linhaSel !== k.id ? 0.55 : 1 }}
            onClick={() => setLinhaSel(linhaSel === k.id ? null : k.id)}>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 6 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 300, fontFamily: "JetBrains Mono, monospace", color: k.color }}>
              {B.fmtK(k.valor)}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>
              {k.pct.toFixed(2).replace(".", ",")}% do total
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="card-title">Receita mensal por linha de negócio (stacked)</h2>
          <div style={{ fontSize: 12, color: "var(--fg-2)" }}>
            Total filtrado: <b>{B.fmt(totalReceita)}</b>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, fontSize: 11 }}>
          {linhas.map(l => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, background: LINHA_COLORS[l], borderRadius: 2 }} />
              <span>{labelOf(l)}</span>
            </div>
          ))}
        </div>
        <div style={{ paddingBottom: 28 }}>
          <StackedMonthBars months={months} series={series} height={280} />
        </div>
      </div>

      {linhaParaMarcas && (
        <div className="card" style={{ marginTop: 14, borderLeft: `3px solid ${LINHA_COLORS[linhaSel]}` }}>
          <div className="card-title-row">
            <h2 className="card-title">
              Drill-down por marca · {labelOf(linhaSel)}
              {empresaLabel ? ` (${empresaLabel})` : ""}
            </h2>
          </div>
          <div className="row" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <BarList
                items={marcasGlobalFiltradas.map(m => ({ name: m.marca, value: m.valor }))}
                color={linhaSel === "tratores_novos" ? "green" : "cyan"}
              />
            </div>
            <div className="t-scroll" style={{ maxHeight: 320 }}>
              <table className="t">
                <thead>
                  <tr><th>Marca</th><th className="num">Receita</th><th className="num">% do total</th></tr>
                </thead>
                <tbody>
                  {marcasGlobalFiltradas.map((m, i) => (
                    <tr key={i}>
                      <td>{m.marca}</td>
                      <td className="num">{B.fmt(m.valor)}</td>
                      <td className="num">{m.pct.toFixed(2).replace(".", ",")}%</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total</td>
                    <td className="num">{B.fmt(marcasGlobalFiltradas.reduce((s, m) => s + m.valor, 0))}</td>
                    <td className="num">100,00%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {(linhaSel === "tratores_usados" || linhaSel === "implementos_usados" || linhaSel === "pecas" || linhaSel === "servicos") && (
        <div className="card" style={{ marginTop: 14, padding: 14, color: "var(--fg-2)", fontSize: 12 }}>
          {labelOf(linhaSel)}: drill-down por marca não disponível para esta linha
          (plano de contas não segrega marca aqui). Total: <b>{B.fmt(totaisLinha[linhaSel] || 0)}</b>.
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="card-title">Detalhamento mensal</h2>
        <div className="t-scroll">
          <table className="t">
            <thead>
              <tr>
                <th>Mês</th>
                {linhas.map(l => <th key={l} className="num" style={{ color: LINHA_COLORS[l] }}>{labelOf(l)}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {tabela.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{row.ano_mes}</td>
                  {linhas.map(l => (
                    <td key={l} className="num">{row[l] > 0 ? B.fmtK(row[l]) : "—"}</td>
                  ))}
                  <td className="num"><b>{B.fmtK(row.total)}</b></td>
                </tr>
              ))}
              <tr className="total">
                <td>Total {months.length} meses</td>
                {linhas.map(l => (
                  <td key={l} className="num">{B.fmt(totaisLinha[l] || 0)}</td>
                ))}
                <td className="num"><b>{B.fmt(totalReceita)}</b></td>
              </tr>
              <tr style={{ color: "var(--fg-2)", fontSize: 11 }}>
                <td>% do total</td>
                {linhas.map(l => {
                  const p = totalReceita > 0 ? ((totaisLinha[l] || 0) / totalReceita) * 100 : 0;
                  return <td key={l} className="num">{p.toFixed(2).replace(".", ",")}%</td>;
                })}
                <td className="num">100,00%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { PageOverview, PageIndicators, PageReceita, PageReceitaLinha, PageDespesa, PageIndicadoresContabeis, RangePills });
