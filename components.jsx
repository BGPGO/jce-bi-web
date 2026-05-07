/* BIT/BGP Finance — shared components v2 */
const { useState, useEffect, useMemo, useRef } = React;

const Icon = ({ name, ...props }) => {
  const paths = {
    home: <><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2V10z"/></>,
    chart: <><path d="M3 21h18M6 17V9m6 8V5m6 12v-7"/></>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1.1.9-2 2-2h2.5a2 2 0 010 4H11a2 2 0 000 4h2.5a2 2 0 002-2M12 6v12"/></>,
    expense: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    flow: <><path d="M3 12h7l3-7 3 14 3-7h2"/></>,
    treasury: <><path d="M5 21V8l7-4 7 4v13M9 21v-7h6v7M3 21h18"/></>,
    compare: <><path d="M7 4v16M17 4v16M4 8h6M14 16h6"/></>,
    diary: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 7h16M9 3v18"/></>,
    report: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h4"/></>,
    fileText: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6M8 9h2"/></>,
    invest: <><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v6h-6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    menu: <><path d="M4 6h16M4 12h10M4 18h16"/></>,
    chevronRight: <><path d="M9 6l6 6-6 6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
    bell: <><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 004 0"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>,
    download: <><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></>,
    sliders: <><path d="M4 6h11M4 12h7M4 18h13"/><circle cx="18" cy="6" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="20" cy="18" r="2"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrowUp: <><path d="M7 14l5-5 5 5"/></>,
    arrowDown: <><path d="M7 10l5 5 5-5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
    cash: <><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></>,
    accrual: <><path d="M4 4h12l4 4v12H4z"/><path d="M4 12h16M12 4v16"/></>,
    filter: <><path d="M3 5h18l-7 9v6l-4-2v-4z"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name]}
    </svg>
  );
};

const Sidebar = ({ active, onSelect, open }) => {
  const ALL_GENERAL = [
    { id: "overview", icon: "home", label: "Visão Geral" },
    { id: "receita", icon: "money", label: "Receita" },
    { id: "receita_linha", icon: "chart", label: "Receita por Linha" },
    { id: "despesa", icon: "expense", label: "Despesa" },
    { id: "fluxo", icon: "flow", label: "Fluxo de Caixa" },
    { id: "tesouraria", icon: "treasury", label: "Tesouraria" },
    { id: "endividamento", icon: "report", label: "Endividamento" },
    { id: "comparativo", icon: "compare", label: "Comparativo" },
    { id: "relatorio", icon: "fileText", label: "Relatório IA" },
    { id: "valuation", icon: "invest", label: "Valuation" },
    { id: "indicadores_contabeis", icon: "report", label: "Indicadores Contábeis" },
  ];
  const ALL_OTHERS = [
    { id: "indicators", icon: "chart", label: "Indicadores" },
    { id: "estoque", icon: "report", label: "Estoque & Capital de Giro" },
    { id: "ponto_equilibrio", icon: "chart", label: "Pontos de Equilíbrio" },
    { id: "rentabilidade", icon: "invest", label: "Rentabilidade" },
    { id: "benchmarks", icon: "compare", label: "Benchmarks" },
    { id: "faturamento_produto", icon: "money", label: "Faturamento" },
    { id: "curva_abc", icon: "chart", label: "Curva ABC" },
    { id: "marketing", icon: "invest", label: "Marketing ADS" },
    { id: "hierarquia", icon: "chart", label: "Hierarquia ADS" },
    { id: "detalhado", icon: "report", label: "Detalhado" },
    { id: "profunda_cliente", icon: "user", label: "Profunda Cliente" },
    { id: "crm", icon: "money", label: "CRM" },
  ];
  // Filtra pela lista de pages ativas (window.BIT_PAGES, vinda do bi.config.js
  // via build-data). Se não definido, mostra tudo (compat com radke-bi).
  const cfg = (typeof window !== 'undefined' && window.BIT_PAGES) || null;
  const inGeneral = cfg ? new Set(cfg.geral || []) : null;
  const inOthers  = cfg ? new Set(cfg.outros || []) : null;
  const general = (inGeneral ? ALL_GENERAL.filter(it => inGeneral.has(it.id)) : ALL_GENERAL).concat(
    [{ id: "diary", icon: "diary", label: "Diário", badge: "EM BREVE" }]
  );
  const others = (inOthers ? ALL_OTHERS.filter(it => inOthers.has(it.id)) : ALL_OTHERS).concat(
    [{ id: "settings", icon: "settings", label: "Configurações", badge: "EM BREVE" }]
  );
  const renderItem = (it) => (
    <button
      key={it.id}
      className={`sb-item ${active === it.id ? "active" : ""}`}
      onClick={() => !it.badge && onSelect(it.id)}
      disabled={!!it.badge}
      style={it.badge ? { opacity: 0.55, cursor: "default" } : {}}
    >
      <Icon name={it.icon} />
      <span className="label">{it.label}</span>
      {it.badge && <span className="badge">{it.badge}</span>}
    </button>
  );
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sb-brand">
        <img src="assets/bgp-logo-white.png" alt="BGP" className="sb-logo-img" />
      </div>
      <div className="sb-section">Geral</div>
      {general.map(renderItem)}
      <div className="sb-section">Outros</div>
      {others.map(renderItem)}
      <div className="sb-spacer" />
      <div className="sb-user">
        <div className="avatar">RK</div>
        <div className="who">
          <b>{(window.BIT_META && window.BIT_META.empresa && window.BIT_META.empresa.nome_fantasia) || "Cliente"}</b>
          <span>{(window.BIT_META && window.BIT_META.empresa && window.BIT_META.empresa.cidade) || "Cliente · BGP GO"}</span>
        </div>
      </div>
    </aside>
  );
};

const PAGE_TITLES = {
  overview: "Visão Geral",
  indicadores_contabeis: "Indicadores Contábeis",
  indicators: "Indicadores",
  receita: "Receita",
  receita_linha: "Receita por Linha de Negócio",
  despesa: "Despesa",
  fluxo: "Fluxo de Caixa",
  tesouraria: "Tesouraria",
  endividamento: "Endividamento Bancário",
  comparativo: "Comparativo",
  relatorio: "Relatório IA",
  faturamento_produto: "Faturamento por Produto",
  curva_abc: "Curva ABC de Produtos",
  marketing: "Marketing ADS",
  valuation: "Valuation",
  hierarquia: "Hierarquia ADS",
  detalhado: "Detalhado",
  profunda_cliente: "Profunda Cliente",
  crm: "CRM",
  estoque: "Estoque & Capital de Giro",
  ponto_equilibrio: "Pontos de Equilíbrio & Alavancagem",
  rentabilidade: "Retorno & Rentabilidade",
  benchmarks: "Benchmarks vs Cliente",
};

const DATE_RANGES = [
  { id: "hoje",   label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes",    label: "Mês" },
  { id: "ano",    label: "Ano" },
];

const DateRangeSeg = ({ value, onChange }) => (
  <div className="seg date-range-seg">
    {DATE_RANGES.map(r => (
      <button key={r.id} className={value === r.id ? "active" : ""} onClick={() => onChange(r.id)}>{r.label}</button>
    ))}
  </div>
);

const STATUS_FILTERS = [
  { id: "realizado", label: "Realizado" },
  { id: "a_pagar_receber", label: "A pagar/receber" },
  { id: "tudo", label: "Tudo" },
];

const StatusFilterSeg = ({ value, onChange }) => (
  <div className="seg status-filter-seg" title="Filtro de status do lançamento">
    {STATUS_FILTERS.map(s => (
      <button key={s.id} className={value === s.id ? "active" : ""} onClick={() => onChange(s.id)}>{s.label}</button>
    ))}
  </div>
);

const YearSelect = ({ value, onChange, available }) => {
  const years = available && available.length ? available : [value];
  return (
    <select
      className="header-year"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      title="Ano de referência (0 = todos os anos)"
    >
      <option value={0}>Todos os anos</option>
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );
};

const MONTH_OPTS = [
  { v: 0, label: "Ano completo" },
  { v: 1, label: "Janeiro" }, { v: 2, label: "Fevereiro" }, { v: 3, label: "Março" },
  { v: 4, label: "Abril" }, { v: 5, label: "Maio" }, { v: 6, label: "Junho" },
  { v: 7, label: "Julho" }, { v: 8, label: "Agosto" }, { v: 9, label: "Setembro" },
  { v: 10, label: "Outubro" }, { v: 11, label: "Novembro" }, { v: 12, label: "Dezembro" },
];

const MonthSelect = ({ value, onChange }) => (
  <select
    className="header-year"
    value={value || 0}
    onChange={e => onChange(Number(e.target.value))}
    title="Mês de referência (Ano completo = todos)"
  >
    {MONTH_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
  </select>
);

// EmpresaSelect: filtro multi-tenant cascateando em todos os getBit() das Pages.
// '0' = Consolidado (todas). Demais = uma empresa.
// Só aparece se window.EMPRESAS tiver mais de uma (mono-empresa não precisa).
const EmpresaSelect = ({ value, onChange }) => {
  const list = (typeof window !== 'undefined' && window.EMPRESAS) || [];
  if (!list || list.length < 2) return null;
  return (
    <select
      className="header-year"
      value={value || '0'}
      onChange={e => onChange(e.target.value)}
      title="Filtrar por empresa (cascade global)"
    >
      <option value="0">Consolidado</option>
      {list.map(e => <option key={e.codigo} value={e.codigo}>{e.label}</option>)}
    </select>
  );
};

// BiExportButton: modal com checkboxes pra exportar telas selecionadas como PDF
const BI_EXPORT_PAGES = [
  { id: "overview", label: "01 Visão Geral" },
  { id: "receita", label: "02 Receita" },
  { id: "receita_linha", label: "02b Receita por Linha de Negócio" },
  { id: "despesa", label: "03 Despesa" },
  { id: "fluxo", label: "04 Fluxo de Caixa" },
  { id: "tesouraria", label: "05 Tesouraria" },
  { id: "endividamento", label: "06 Endividamento Bancário" },
  { id: "comparativo", label: "07 Comparativo" },
  { id: "relatorio", label: "07 Relatório IA" },
  { id: "valuation", label: "08 Valuation" },
  { id: "indicators", label: "09 Indicadores" },
  { id: "faturamento_produto", label: "10 Faturamento por Produto" },
  { id: "curva_abc", label: "11 Curva ABC" },
  { id: "marketing", label: "12 Marketing ADS" },
  { id: "hierarquia", label: "13 Hierarquia ADS" },
  { id: "detalhado", label: "14 Detalhado" },
  { id: "profunda_cliente", label: "15 Profunda Cliente" },
  { id: "crm", label: "16 CRM" },
];

const BiExportButton = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set(BI_EXPORT_PAGES.map(p => p.id)));
  const toggle = (id) => {
    setSelected(s => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  };
  const submit = () => {
    if (selected.size === 0) return;
    const ordered = BI_EXPORT_PAGES.filter(p => selected.has(p.id)).map(p => p.id);
    if (window.startBiExport) window.startBiExport(ordered);
    setOpen(false);
  };
  return (
    <>
      <button className="btn-ghost hd-export-bi" onClick={() => setOpen(true)} title="Exportar BI inteiro como PDF">
        <Icon name="download" /> <span>Exportar BI</span>
      </button>
      {open && (
        <div className="drawer-overlay no-print" onClick={() => setOpen(false)}>
          <div className="card bi-export-modal" onClick={e => e.stopPropagation()}>
            <h2 className="card-title">Exportar BI como PDF</h2>
            <p style={{ color: "var(--fg-2)", marginTop: 8, fontSize: 13 }}>
              Selecione as telas para incluir no PDF. Cada tela vira uma página A4 com o tema escuro mantido.
            </p>
            <div className="bi-export-grid">
              {BI_EXPORT_PAGES.map(p => (
                <label key={p.id} className="bi-export-row">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
            <div className="bi-export-actions">
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => setSelected(new Set(BI_EXPORT_PAGES.map(p => p.id)))}>Todas</button>
                <button className="btn-ghost" onClick={() => setSelected(new Set())}>Nenhuma</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
                <button className="btn-primary" onClick={submit} disabled={selected.size === 0}>
                  Exportar ({selected.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Header: breadcrumb + EmpresaSelect + YearSelect + MonthSelect + StatusFilter
const Header = ({ page, onToggleSidebar, statusFilter, setStatusFilter, year, setYear, month, setMonth, empresa, setEmpresa }) => {
  const clienteNome = (window.BIT_META && window.BIT_META.empresa && window.BIT_META.empresa.nome_fantasia) || "Cliente";
  return (
    <header className="header">
      <button className="hd-icon-btn hd-menu-btn" title="Menu" onClick={onToggleSidebar}><Icon name="menu" /></button>
      <div className="breadcrumb">
        <span>{clienteNome}</span>
        <Icon name="chevronRight" />
        <span>Caixa &amp; Eficiência Operacional</span>
        <Icon name="chevronRight" />
        <b>{PAGE_TITLES[page] || "Visão Geral"}</b>
      </div>
      <div style={{ flex: 1 }} />
      {setEmpresa && <EmpresaSelect value={empresa} onChange={setEmpresa} />}
      {setYear && <YearSelect value={year} onChange={setYear} available={window.AVAILABLE_YEARS} />}
      {setMonth && <MonthSelect value={month} onChange={setMonth} />}
      {setStatusFilter && <StatusFilterSeg value={statusFilter} onChange={setStatusFilter} />}
      <BiExportButton />
    </header>
  );
};

// =============================================================================
// CHARTS — JCE v1.5 (Squad 1 UX recommendations)
// Hand-coded SVG. Sem libs externas. Todos respondem a tema escuro cyan-tech.
// =============================================================================

// Waterfall — caixa inicial → entradas (verde) → saídas (vermelho) → caixa final.
//   data: [{ label, value, kind: 'start'|'in'|'out'|'end' }]
// viewBox em unidades reais (W=900) com preserveAspectRatio padrão pra não esticar.
const Waterfall = ({ data, height = 300, formatFn }) => {
  const fmt = formatFn || (typeof window !== "undefined" && window.BIT && window.BIT.fmtK) || (n => String(Math.round(n)));
  const W = 900;
  const padding = { top: 40, right: 20, bottom: 50, left: 80 };
  const steps = [];
  let acc = 0;
  for (const d of data) {
    if (d.kind === 'start' || d.kind === 'end') {
      steps.push({ ...d, top: d.value, bottom: 0, delta: 0 });
      acc = d.value;
    } else {
      const bottom = acc;
      acc = d.kind === 'in' ? acc + d.value : acc - d.value;
      const top = acc;
      steps.push({ ...d, top: Math.max(top, bottom), bottom: Math.min(top, bottom), delta: top - bottom });
    }
  }
  const max = Math.max(...steps.map(s => s.top), 0);
  const min = Math.min(...steps.map(s => s.bottom), 0);
  const range = (max - min) || 1;
  const innerW = W - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const colW = innerW / steps.length;
  const yScale = (v) => padding.top + ((max - v) / range) * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const v = max - p * range;
        const y = padding.top + p * innerH;
        return (
          <g key={i}>
            <line x1={padding.left} x2={W - padding.right} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={padding.left - 6} y={y + 3} fill="rgba(255,255,255,0.4)" fontSize="11"
                  fontFamily="JetBrains Mono, monospace" textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        );
      })}
      {min < 0 && (
        <line x1={padding.left} x2={W - padding.right} y1={yScale(0)} y2={yScale(0)}
              stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="4 3" />
      )}
      {steps.map((s, i) => {
        const x = padding.left + i * colW + colW * 0.15;
        const w = colW * 0.7;
        const yTop = yScale(s.top);
        const h = Math.max(yScale(s.bottom) - yTop, 2);
        const fill = s.kind === 'start' || s.kind === 'end'
          ? '#22d3ee'
          : (s.kind === 'in' ? '#10b981' : '#ef4444');
        const valShown = s.kind === 'start' || s.kind === 'end' ? s.value : (s.kind === 'in' ? s.delta : -s.delta);
        return (
          <g key={i}>
            <rect x={x} y={yTop} width={w} height={h} fill={fill} opacity="0.85" rx="3">
              <title>{s.label}: {fmt(valShown)}</title>
            </rect>
            <text x={x + w / 2} y={yTop - 6} fill="rgba(255,255,255,0.92)"
                  fontSize="11.5" fontFamily="JetBrains Mono, monospace" textAnchor="middle"
                  style={{ fontWeight: 600 }}>
              {fmt(valShown)}
            </text>
            {i < steps.length - 1 && (
              <line
                x1={x + w}
                y1={s.kind === 'in' || s.kind === 'start' ? yTop : yTop + h}
                x2={padding.left + (i + 1) * colW + colW * 0.15}
                y2={(steps[i + 1].kind === 'out') ? yScale(steps[i + 1].top) : yScale(steps[i + 1].bottom)}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
            )}
            <text x={x + w / 2} y={height - padding.bottom + 18} fill="rgba(255,255,255,0.75)"
                  fontSize="11" textAnchor="middle">
              {s.label.length > 14 ? s.label.substring(0, 14) + '…' : s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Treemap — squarified, hand-coded. Tile area = value.
//   data: [{ name, value, color? }]
//   onClick: (item) => void
const Treemap = ({ data, height = 320, onClick }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total || data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-2)" }}>Sem dados</div>;
  }
  // Squarified algorithm simplificado: ordena desc, layout linha-por-linha.
  const items = [...data].sort((a, b) => b.value - a.value);
  const W = 100, H = 100;
  // converte valores em áreas (proporcional ao % do total)
  const tiles = items.map(it => ({ ...it, area: (it.value / total) * (W * H) }));
  // greedy: fila acumula até razão de aspecto degradar
  const placed = [];
  let x = 0, y = 0;
  let availW = W, availH = H;
  let queue = [];
  let queueArea = 0;

  const aspectWorst = (queue, length) => {
    if (queue.length === 0) return Infinity;
    const sum = queue.reduce((s, q) => s + q.area, 0);
    let worst = 0;
    for (const q of queue) {
      const a = (length * length * q.area) / (sum * sum);
      const r = Math.max(a, 1 / a);
      if (r > worst) worst = r;
    }
    return worst;
  };

  const placeQueue = (queue, x, y, availW, availH, dir) => {
    const sum = queue.reduce((s, q) => s + q.area, 0);
    if (dir === 'h') {
      const rowH = sum / availW;
      let cx = x;
      const out = queue.map(q => {
        const w = q.area / rowH;
        const rect = { ...q, x: cx, y, w, h: rowH };
        cx += w;
        return rect;
      });
      return { tiles: out, nx: x, ny: y + rowH, nW: availW, nH: availH - rowH };
    } else {
      const colW = sum / availH;
      let cy = y;
      const out = queue.map(q => {
        const h = q.area / colW;
        const rect = { ...q, x, y: cy, w: colW, h };
        cy += h;
        return rect;
      });
      return { tiles: out, nx: x + colW, ny: y, nW: availW - colW, nH: availH };
    }
  };

  let cursor = { x: 0, y: 0, w: W, h: H };
  let i = 0;
  while (i < tiles.length) {
    const dir = cursor.w >= cursor.h ? 'v' : 'h';
    const length = Math.min(cursor.w, cursor.h);
    queue = [];
    while (i < tiles.length) {
      const next = [...queue, tiles[i]];
      if (queue.length > 0 && aspectWorst(next, length) > aspectWorst(queue, length)) break;
      queue.push(tiles[i]);
      i++;
    }
    const result = placeQueue(queue, cursor.x, cursor.y, cursor.w, cursor.h, dir);
    placed.push(...result.tiles);
    cursor = { x: result.nx, y: result.ny, w: result.nW, h: result.nH };
    if (cursor.w <= 0 || cursor.h <= 0) break;
  }

  const palette = ['#22d3ee', '#10b981', '#a78bfa', '#fbbf24', '#ef4444', '#34d399', '#f472b6', '#60a5fa', '#fb923c', '#c084fc'];
  const fmt = (typeof window !== "undefined" && window.BIT && window.BIT.fmtK) || (n => String(Math.round(n)));
  const fmtPct = (n) => `${n.toFixed(1)}%`;
  // viewBox em escala 1000 pra ter resolução suficiente nas labels.
  // Mantém preserveAspectRatio="none" porque o treemap deve ocupar TODA a área disponível
  // (área = valor — esse é o ponto da visualização).
  const SCALE = 10;
  return (
    <svg viewBox={`0 0 ${W * SCALE} ${H * SCALE}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      {placed.map((t, idx) => {
        const pct = (t.value / total) * 100;
        const color = t.color || palette[idx % palette.length];
        const x = t.x * SCALE;
        const y = t.y * SCALE;
        const w = t.w * SCALE;
        const h = t.h * SCALE;
        const showLabel = w > 80 && h > 40;
        const fontMain = Math.min(w / 12, h / 6, 16);
        const fontSub = Math.min(w / 16, h / 9, 11);
        return (
          <g key={idx} onClick={onClick ? () => onClick(t) : undefined} style={{ cursor: onClick ? "pointer" : "default" }}>
            <rect x={x + 2} y={y + 2} width={Math.max(w - 4, 0)} height={Math.max(h - 4, 0)}
                  fill={color} opacity="0.72" rx="3" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5">
              <title>{t.name}: {fmt(t.value)} ({fmtPct(pct)})</title>
            </rect>
            {showLabel && (
              <>
                <text x={x + 8} y={y + fontMain + 4} fill="white" fontSize={fontMain}
                      style={{ fontWeight: 700, pointerEvents: "none" }}>
                  {t.name.length > Math.floor(w / fontMain * 1.2) ? t.name.substring(0, Math.floor(w / fontMain * 1.2)) + '…' : t.name}
                </text>
                <text x={x + 8} y={y + fontMain * 2 + 6} fill="white" fontSize={fontSub} opacity="0.92"
                      fontFamily="JetBrains Mono, monospace" style={{ pointerEvents: "none" }}>
                  {fmtPct(pct)} · {fmt(t.value)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// Pareto — barra (desc) + linha cumulativa (%). Mostra concentração 80/20.
const Pareto = ({ data, height = 280, formatFn, threshold = 80 }) => {
  if (!data || data.length === 0) return null;
  const fmt = formatFn || (typeof window !== "undefined" && window.BIT && window.BIT.fmtK) || (n => String(Math.round(n)));
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const items = sorted.map(d => {
    acc += d.value;
    return { ...d, cum: total > 0 ? (acc / total) * 100 : 0 };
  });
  const maxV = items[0].value || 1;
  const W = 700;
  const padding = { top: 30, right: 40, bottom: 40, left: 50 };
  const innerW = W - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const colW = innerW / items.length;
  const thresholdIdx = items.findIndex(it => it.cum >= threshold);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* eixo Y esquerdo (R$) */}
      {[0, 0.5, 1].map((p, i) => {
        const v = maxV * (1 - p);
        const y = padding.top + p * innerH;
        return (
          <g key={i}>
            <line x1={padding.left} x2={W - padding.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padding.left - 6} y={y + 4} fill="rgba(255,255,255,0.4)" fontSize="10"
                  fontFamily="JetBrains Mono, monospace" textAnchor="end">{fmt(v)}</text>
          </g>
        );
      })}
      {/* bars */}
      {items.map((it, i) => {
        const x = padding.left + i * colW + colW * 0.15;
        const w = colW * 0.7;
        const h = (it.value / maxV) * innerH;
        const y = padding.top + innerH - h;
        const isTop20 = i < thresholdIdx || (i === thresholdIdx && it.cum >= threshold);
        const fill = isTop20 ? '#ef4444' : '#475569';
        return (
          <rect key={i} x={x} y={y} width={Math.max(w, 1)} height={h} fill={fill} opacity="0.82" rx="2">
            <title>{it.name}: {fmt(it.value)} (acumulado {it.cum.toFixed(1)}%)</title>
          </rect>
        );
      })}
      {/* linha cumulativa */}
      <polyline
        points={items.map((it, i) => {
          const x = padding.left + i * colW + colW * 0.5;
          const y = padding.top + (1 - it.cum / 100) * innerH;
          return `${x},${y}`;
        }).join(' ')}
        fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinejoin="round"
      />
      {/* dots na linha */}
      {items.map((it, i) => {
        const x = padding.left + i * colW + colW * 0.5;
        const y = padding.top + (1 - it.cum / 100) * innerH;
        return <circle key={i} cx={x} cy={y} r="2.5" fill="#22d3ee" />;
      })}
      {/* threshold line (80%) */}
      <line x1={padding.left} x2={W - padding.right}
            y1={padding.top + (1 - threshold / 100) * innerH}
            y2={padding.top + (1 - threshold / 100) * innerH}
            stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="5 3" />
      <text x={W - padding.right + 4} y={padding.top + (1 - threshold / 100) * innerH + 4}
            fill="#fbbf24" fontSize="11" fontFamily="JetBrains Mono, monospace">{threshold}%</text>
      {/* eixo Y direito (% acumulado) */}
      {[0, 50, 100].map((pct, i) => {
        const y = padding.top + (1 - pct / 100) * innerH;
        return (
          <text key={i} x={W - padding.right + 8} y={y + 4} fill="rgba(34, 211, 238, 0.55)"
                fontSize="10" fontFamily="JetBrains Mono, monospace">{pct}%</text>
        );
      })}
    </svg>
  );
};

// Sparkline minimalista (para embutir em KPI tiles)
const Sparkline = ({ values, width = 80, height = 24, color = "#22d3ee", showZeroLine = true }) => {
  if (!values || values.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = (max - min) || 1;
  const stepX = width / (values.length - 1);
  const yOf = (v) => height - ((v - min) / range) * height;
  const points = values.map((v, i) => `${i * stepX},${yOf(v)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {showZeroLine && min < 0 && (
        <line x1="0" x2={width} y1={yOf(0)} y2={yOf(0)} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="2 2" />
      )}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * stepX} cy={yOf(values[values.length - 1])} r="2" fill={color} />
    </svg>
  );
};

// Heatmap (empresa × mês) — célula colorida por intensidade
//   rows: [{ label, values: [12 numbers] }]
//   months: ['jan','fev',...] (opcional, pra header)
const Heatmap = ({ rows, height = 200, formatFn, months }) => {
  const fmt = formatFn || (typeof window !== "undefined" && window.BIT && window.BIT.fmtK) || (n => String(Math.round(n)));
  if (!rows || rows.length === 0) return null;
  const allVals = rows.flatMap(r => r.values);
  const max = Math.max(...allVals.map(Math.abs)) || 1;
  const W = 900;
  const labelW = 110;
  const headerH = months ? 24 : 0;
  const cellW = (W - labelW) / 12;
  const cellH = (height - headerH) / rows.length;
  const colorOf = (v) => {
    const intensity = Math.min(Math.abs(v) / max, 1);
    if (v >= 0) return `rgba(16, 185, 129, ${intensity * 0.85 + 0.06})`;
    return `rgba(239, 68, 68, ${intensity * 0.85 + 0.06})`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {months && months.map((m, j) => (
        <text key={j} x={labelW + j * cellW + cellW / 2} y={16} textAnchor="middle"
              fill="rgba(255,255,255,0.55)" fontSize="11" textTransform="uppercase">{m}</text>
      ))}
      {rows.map((r, i) => (
        <g key={i}>
          <text x={6} y={headerH + i * cellH + cellH * 0.62} fontSize="13"
                fill="rgba(255,255,255,0.92)" style={{ fontWeight: 600 }}>
            {r.label.length > 14 ? r.label.substring(0, 14) + '…' : r.label}
          </text>
          {r.values.map((v, j) => {
            const x = labelW + j * cellW;
            const y = headerH + i * cellH;
            return (
              <g key={j}>
                <rect x={x + 1.5} y={y + 1.5} width={cellW - 3} height={cellH - 3}
                      fill={colorOf(v)} rx="3">
                  <title>{r.label} · mês {j + 1}: {fmt(v)}</title>
                </rect>
                {Math.abs(v) > max * 0.05 && cellH > 30 && (
                  <text x={x + cellW / 2} y={y + cellH / 2 + 4} textAnchor="middle"
                        fontSize={Math.min(cellH * 0.28, 11)} fill="rgba(255,255,255,0.95)"
                        fontFamily="JetBrains Mono, monospace">
                    {fmt(v)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
};

// Gauge — mostra valor vs benchmark (banda colorida) — usado em KPIs com referência setorial
//   value: número
//   min/max: range
//   bands: [{ from, to, color }] - bandas de referência (vermelho/amarelo/verde)
const Gauge = ({ value, min = 0, max = 100, bands, height = 80, suffix = "%" }) => {
  const W = 200, padding = 20, innerW = W - padding * 2;
  const range = max - min || 1;
  const valuePct = Math.max(0, Math.min(1, (value - min) / range));
  const valueX = padding + valuePct * innerW;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", maxWidth: W, height: "auto", display: "block" }}>
      {/* bands (zonas de referência) */}
      {bands && bands.map((b, i) => {
        const x1 = padding + ((b.from - min) / range) * innerW;
        const x2 = padding + ((b.to - min) / range) * innerW;
        return <rect key={i} x={x1} y={height / 2 - 4} width={x2 - x1} height={8} fill={b.color} opacity="0.4" rx="2" />;
      })}
      {/* baseline */}
      <line x1={padding} x2={W - padding} y1={height / 2} y2={height / 2} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* marker */}
      <line x1={valueX} x2={valueX} y1={height / 2 - 12} y2={height / 2 + 12} stroke="white" strokeWidth="2" />
      <circle cx={valueX} cy={height / 2} r="5" fill="#22d3ee" />
      {/* labels min / max */}
      <text x={padding} y={height - 4} fontSize="9" fill="rgba(255,255,255,0.5)">{min}{suffix}</text>
      <text x={W - padding} y={height - 4} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="end">{max}{suffix}</text>
      {/* value */}
      <text x={valueX} y={height / 2 - 16} fontSize="14" fill="white" textAnchor="middle"
            fontFamily="JetBrains Mono, monospace" style={{ fontWeight: 700 }}>
        {value.toFixed(1)}{suffix}
      </text>
    </svg>
  );
};

// =============================================================================
// FIM CHARTS — JCE v1.5
// =============================================================================

// vertical bars (kept)
// Click handlers: onBarClick(monthData, idx). activeIdx adds .active class; outros ficam .dimmed
const MonthlyBars = ({ data, height = 230, type = "both", showLabels = true, onBarClick, activeIdx }) => {
  const rawMax = Math.max(...data.map(d => Math.max(d.receita || 0, d.despesa || 0)), 0);
  // Guard: dataset zerado (ex.: filtro 'a_pagar_receber' c/ Razão de Caixa) → max=0 quebraria
  // (v/0)*100 = NaN, CSS height:NaN% renderiza bar com altura do conteúdo (chip de valor)
  // — daí o bug "barra alta com escala antiga". Forçamos max=1 e bars colapsam pra 0%.
  const max = rawMax > 0 ? rawMax : 1;
  const grids = [0, 0.25, 0.5, 0.75, 1].map(p => p * max);
  const hasActive = activeIdx != null && activeIdx >= 0;
  return (
    <div style={{ position: "relative" }}>
      <div className="vbar-axis" style={{ height: height - 24 }}>
        {grids.map((g, i) => (<div key={i} className="grid" style={{ bottom: `${(g / max) * 100}%` }} />))}
        {grids.map((g, i) => (<div key={"l"+i} className="glabel" style={{ bottom: `${(g / max) * 100}%` }}>{window.BIT.fmtK(g)}</div>))}
      </div>
      <div className="vbar-chart" style={{ height }}>
        {data.map((d, i) => {
          const rH = rawMax > 0 ? ((d.receita || 0) / max) * 100 : 0;
          const dH = rawMax > 0 ? ((d.despesa || 0) / max) * 100 : 0;
          const cls = "vbar-col" + (onBarClick ? " clickable" : "") +
            (hasActive && i === activeIdx ? " active" : "") +
            (hasActive && i !== activeIdx ? " dimmed" : "");
          return (
            <div key={i} className={cls}
              onClick={onBarClick ? () => onBarClick(d, i) : undefined}
              style={onBarClick ? { cursor: "pointer" } : undefined}
            >
              <div className="stack">
                {(type === "both" || type === "receita") && (
                  <div className="bar" style={{ height: `${rH}%` }} title={`Receita: ${window.BIT.fmt(d.receita)}`}>
                    {showLabels && <span className="v">{window.BIT.fmtK(d.receita)}</span>}
                  </div>
                )}
                {(type === "both" || type === "despesa") && (
                  <div className="bar red" style={{ height: `${dH}%` }} title={`Despesa: ${window.BIT.fmt(d.despesa)}`}>
                    {showLabels && type === "despesa" && <span className="v">{window.BIT.fmtK(d.despesa)}</span>}
                  </div>
                )}
              </div>
              <span className="x">{d.m.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SingleBars = ({ values, labels, color = "green", height = 200, onBarClick, activeIdx }) => {
  const rawMax = Math.max(...values, 0);
  const max = rawMax > 0 ? rawMax : 1; // guard: dataset zerado → bars colapsam pra 0% (não NaN)
  const hasActive = activeIdx != null && activeIdx >= 0;
  return (
    <div className="vbar-chart" style={{ height }}>
      {values.map((v, i) => {
        const h = rawMax > 0 ? (v / max) * 100 : 0;
        const cls = "vbar-col" + (onBarClick ? " clickable" : "") +
          (hasActive && i === activeIdx ? " active" : "") +
          (hasActive && i !== activeIdx ? " dimmed" : "");
        return (
          <div key={i} className={cls}
            onClick={onBarClick ? () => onBarClick(v, i, labels[i]) : undefined}
            style={onBarClick ? { cursor: "pointer" } : undefined}
          >
            <div className="stack">
              <div className={`bar ${color === "red" ? "red" : ""}`} style={{ height: `${h}%`, width: 22, background: color === "cyan" ? "var(--cyan)" : (color === "red" ? "var(--red)" : "var(--green)") }} title={window.BIT.fmt(v)}>
                <span className="v">{window.BIT.fmtK(v)}</span>
              </div>
            </div>
            <span className="x">{labels[i].slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
};

const DailyBars = ({ values, color = "green", onBarClick, activeIdx }) => {
  const rawMax = Math.max(...values, 0);
  const max = rawMax > 0 ? rawMax : 1; // guard p/ dataset zerado
  const subPeaks = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, 3).map(o => o.i);
  const hasActive = activeIdx != null && activeIdx >= 0;
  return (
    <div className="daily">
      <div className="daily-bars">
        {values.map((v, i) => {
          const h = rawMax > 0 ? (v / max) * 100 : 0;
          const cls = `b ${color === "red" ? "red" : ""} ${subPeaks.includes(i) ? "peak" : ""}` +
            (hasActive && i === activeIdx ? " active" : "") +
            (hasActive && i !== activeIdx ? " dimmed" : "");
          return (
            <div key={i} className={cls}
              style={{ height: `${Math.max(h, 1)}%`, cursor: onBarClick ? "pointer" : undefined }}
              data-v={window.BIT.fmtK(v)}
              title={`Dia ${i + 1}: ${window.BIT.fmt(v)}`}
              onClick={onBarClick ? () => onBarClick(i, v) : undefined}
            />
          );
        })}
      </div>
      <div className="daily-x">
        <span>1</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>31</span>
      </div>
    </div>
  );
};

// Stacked area chart — receita (verde) sobre despesa (vermelho)
const StackedArea = ({ data, height = 320, showAxis = true }) => {
  const w = 1000, h = height;
  const padX = 50, padTop = 16, padBottom = 30;
  const all = data.flatMap(d => [d.receita, d.despesa]);
  const min = 0;
  const rawMax = Math.max(...all, 0) * 1.1;
  const max = rawMax > 0 ? rawMax : 1; // guard: dataset zerado → range=0 quebra divisão
  const range = max - min || 1;
  const stepX = (w - padX * 2) / (data.length - 1);

  const pts = (key) => data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padTop + (1 - (d[key] - min) / range) * (h - padTop - padBottom);
    return [x, y];
  });
  const curve = (points) => {
    if (points.length < 2) return "";
    let p = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const cx = (x0 + x1) / 2;
      p += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return p;
  };

  const ptsR = pts("receita");
  const ptsD = pts("despesa");
  const baseY = padTop + (h - padTop - padBottom);

  const areaR = curve(ptsR) + ` L ${ptsR[ptsR.length - 1][0]} ${baseY} L ${ptsR[0][0]} ${baseY} Z`;
  const areaD = curve(ptsD) + ` L ${ptsD[ptsD.length - 1][0]} ${baseY} L ${ptsD[0][0]} ${baseY} Z`;

  // y axis ticks
  const ticks = 5;
  const tickVals = Array.from({ length: ticks }, (_, i) => (max / (ticks - 1)) * i);

  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id="ga-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.03"/>
        </linearGradient>
        <linearGradient id="ga-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.03"/>
        </linearGradient>
      </defs>
      {showAxis && tickVals.map((tv, i) => {
        const y = padTop + (1 - tv / max) * (h - padTop - padBottom);
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={w - 10} y2={y} stroke="oklch(1 0 0 / 0.04)" strokeDasharray="3 4"/>
            <text x={padX - 8} y={y + 3} textAnchor="end" className="axis-text">R$ {(tv/1e6).toFixed(1).replace(".",",")}M</text>
          </g>
        );
      })}
      <path d={areaR} fill="url(#ga-green)" />
      <path d={areaD} fill="url(#ga-red)" />
      <path d={curve(ptsR)} fill="none" stroke="#22c55e" strokeWidth="2"/>
      <path d={curve(ptsD)} fill="none" stroke="#ef4444" strokeWidth="2"/>
      {showAxis && data.map((d, i) => {
        const x = padX + i * stepX;
        return <text key={i} x={x} y={h - 10} textAnchor="middle" className="axis-text" style={{ textTransform: "capitalize" }}>{d.m.slice(0,3)}</text>;
      })}
    </svg>
  );
};

// Trend (line + area)
const TrendChart = ({ values, labels, height = 160, color = "var(--cyan)", showPoints = true, showLabels = true, gradientId = "tg" }) => {
  const w = 1000, h = height;
  const padX = 40, padY = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - padX * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (v - min) / range) * (h - padY * 2);
    return [x, y];
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = path + ` L ${points[points.length - 1][0]} ${h - padY} L ${points[0][0]} ${h - padY} Z`;
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map(i => {
        const y = padY + (i / 3) * (h - padY * 2);
        return <line key={i} className="grid" x1={padX} y1={y} x2={w - padX} y2={y} />;
      })}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {showPoints && points.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3" fill={color}/>
          {showLabels && (
            <text className="point-label" x={p[0]} y={p[1] - 8} textAnchor="middle">{window.BIT.fmtK(values[i])}</text>
          )}
        </g>
      ))}
      {labels && labels.map((l, i) => (
        <text key={"x"+i} className="axis-text" x={padX + i * stepX} y={h - 6} textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
};

const MultiLine = ({ series, labels, height = 180 }) => {
  const w = 1000, h = height;
  const padX = 30, padY = 24;
  const all = series.flatMap(s => s.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const stepX = (w - padX * 2) / (series[0].values.length - 1);
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      {[0, 1, 2, 3].map(i => {
        const y = padY + (i / 3) * (h - padY * 2);
        return <line key={i} className="grid" x1={padX} y1={y} x2={w - padX} y2={y} />;
      })}
      {series.map((s, si) => {
        const points = s.values.map((v, i) => {
          const x = padX + i * stepX;
          const y = padY + (1 - (v - min) / range) * (h - padY * 2);
          return [x, y];
        });
        const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            {points.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={s.color}/>)}
          </g>
        );
      })}
      {labels && labels.map((l, i) => (
        <text key={"x"+i} className="axis-text" x={padX + i * stepX} y={h - 6} textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
};

// Sparkline (used in KPI tile)
const Spark = ({ values, color = "var(--cyan)", filled = true, height = 38 }) => {
  const w = 100, h = height;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, (1 - (v - min) / range) * (h - 6) + 3]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const id = `sp-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {filled && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
        </>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// Composition donut
const Donut = ({ segments, size = 180, thickness = 22 }) => {
  const totalRaw = segments.reduce((s, x) => s + x.value, 0);
  const total = totalRaw > 0 ? totalRaw : 1; // guard: dataset zerado → divisão por zero
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="oklch(0.20 0.012 240)" strokeWidth={thickness}/>
      {segments.map((seg, i) => {
        const len = totalRaw > 0 ? (seg.value / total) * c : 0;
        const off = c - acc;
        acc += len;
        return (
          <circle
            key={i}
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={off}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
};

// Horizontal bar list (with thin track) — used for bank balances/category
// onItemClick(item, idx) torna a linha clicavel; activeName destaca a linha ativa.
const BarListLine = ({ items, color = "cyan", onItemClick, activeName }) => {
  const rawMax = Math.max(...items.map(it => it.value), 0);
  const max = rawMax > 0 ? rawMax : 1; // guard p/ items vazios ou todos zero
  const hasActive = activeName != null;
  return (
    <div className="bar-list with-bars">
      {items.map((it, i) => {
        const w = rawMax > 0 ? (it.value / max) * 100 : 0;
        const isActive = hasActive && it.name === activeName;
        const cls = "bar-row" + (onItemClick ? " clickable" : "") +
          (isActive ? " active" : "") +
          (hasActive && !isActive ? " dimmed" : "");
        return (
          <div key={i} className={cls}
            onClick={onItemClick ? () => onItemClick(it, i) : undefined}
            style={onItemClick ? { cursor: "pointer" } : undefined}
          >
            <div className="row-meta">
              <span className="label">{it.name}</span>
              <span className="val">{window.BIT.fmt(it.value)}</span>
            </div>
            <div className="track"><div className={`fill ${color}`} style={{ width: `${w}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
};

const BarListLegend = ({ items, total }) => {
  return (
    <div className="bar-list">
      {items.map((it, i) => {
        const pct = total > 0 ? (it.value / total) * 100 : 0;
        return (
          <div key={i} className="bar-row">
            <div className="top">
              <span className="dot" style={{ background: it.color }} />
              <span className="label">{it.name}</span>
            </div>
            <div>
              <span className="val">{window.BIT.fmt(it.value)}</span>
              <span className="pct">{pct.toFixed(2).replace(".",",")}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const BarList = ({ items, color = "green", valueKey = "value", labelKey = "name", onItemClick, activeName }) => {
  const mapped = items.map(it => ({ name: it[labelKey], value: it[valueKey] }));
  // se vier onItemClick, propaga o item ORIGINAL (nao o mapeado) pra page poder usar campos extras
  const handler = onItemClick
    ? (mappedIt, idx) => onItemClick(items[idx], idx)
    : undefined;
  return <BarListLine items={mapped} color={color} onItemClick={handler} activeName={activeName} />;
};

const DivergingBars = ({ values, labels }) => {
  const rawMaxAbs = Math.max(...values.map(v => Math.abs(v)), 0);
  const maxAbs = rawMaxAbs > 0 ? rawMaxAbs : 1; // guard p/ todos-zero
  return (
    <div className="bar-list">
      {values.map((v, i) => {
        const w = rawMaxAbs > 0 ? (Math.abs(v) / maxAbs) * 50 : 0;
        const positive = v >= 0;
        return (
          <div key={i} className="div-row">
            <div className="label">{labels[i]}</div>
            <div style={{ display: "flex", height: 12, position: "relative" }}>
              <div style={{ flex: 1, position: "relative", borderRight: "1px solid oklch(1 0 0 / 0.08)" }}>
                {!positive && (<div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${w * 2}%`, background: "var(--red)", borderRadius: "3px 0 0 3px" }} />)}
              </div>
              <div style={{ flex: 1, position: "relative" }}>
                {positive && (<div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${w * 2}%`, background: "var(--green)", borderRadius: "0 3px 3px 0" }} />)}
              </div>
            </div>
            <div className="val" style={{ color: positive ? "var(--green)" : "var(--red)" }}>{window.BIT.fmtK(v)}</div>
          </div>
        );
      })}
    </div>
  );
};

// KPI Tile (big numbers + sparkline). `tone` selects gradient: green / red / cyan / amber.
// `nonMonetary` hides the R$ prefix (for counts: clients, suppliers, etc).
const KpiTile = ({ label, value, unit, deltaPct, deltaDir, sparkValues, sparkColor, tone, nonMonetary }) => {
  return (
    <div className={`kpi-tile ${tone || ""}`}>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">
          {!nonMonetary && <span className="currency">R$</span>}
          {value}
          {unit && <span className="unit">{unit}</span>}
        </div>
        {deltaPct != null && (
          <div className={`kpi-delta ${deltaDir}`}>
            <Icon name={deltaDir === "up" ? "arrowUp" : "arrowDown"} style={{ width: 12, height: 12 }} />
            {Math.abs(deltaPct).toFixed(1).replace(".", ",")}%
          </div>
        )}
      </div>
      {sparkValues && (
        <div className="spark-wrap">
          <Spark values={sparkValues} color={sparkColor || "var(--cyan)"} />
        </div>
      )}
    </div>
  );
};

// Default filter state — used for active-count + clear-all
const DEFAULT_FILTERS = {
  regime: "caixa",
  status: "Todos status",
  categoria: "Todas categorias",
  cc: "Todos centros de custo",
  dateFrom: "",
  dateTo: "",
};

const countActiveFilters = (f) => {
  let n = 0;
  if (f.regime !== DEFAULT_FILTERS.regime) n++;
  if (f.status !== DEFAULT_FILTERS.status) n++;
  if (f.categoria !== DEFAULT_FILTERS.categoria) n++;
  if (f.cc !== DEFAULT_FILTERS.cc) n++;
  if (f.dateFrom || f.dateTo) n++;
  return n;
};

// Toolbar de filtros inline (substitui o modal removido).
// Lê categorias únicas de window.ALL_TX e seta drilldown global.
const InlineFilterBar = ({ kindHint, drilldown, setDrilldown }) => {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [grupo, setGrupo] = React.useState(() => {
    if (kindHint === "r") return "Receita";
    if (kindHint === "d") return "Despesa";
    return drilldown && drilldown.type === "kind"
      ? (drilldown.value === "r" ? "Receita" : "Despesa")
      : "Todos";
  });
  React.useEffect(() => {
    if (kindHint === "r") setGrupo("Receita");
    else if (kindHint === "d") setGrupo("Despesa");
  }, [kindHint]);

  // Lê categorias únicas filtradas pelo grupo
  const categorias = React.useMemo(() => {
    const all = window.ALL_TX || [];
    const set = new Set();
    for (const row of all) {
      const [kind, , , categoria] = row;
      if (!categoria) continue;
      if (grupo === "Receita" && kind !== "r") continue;
      if (grupo === "Despesa" && kind !== "d") continue;
      set.add(categoria);
    }
    return [...set].sort();
  }, [grupo]);

  const filtered = React.useMemo(() => {
    if (!searchTerm) return categorias.slice(0, 50);
    const q = searchTerm.toLowerCase();
    return categorias.filter(c => c.toLowerCase().includes(q)).slice(0, 50);
  }, [categorias, searchTerm]);

  const activeCategoria = drilldown && drilldown.type === "categoria" ? drilldown.value : null;

  const setGrupoAndClearCat = (v) => {
    setGrupo(v);
    if (drilldown && drilldown.type === "categoria") setDrilldown(null);
  };
  const handleCatSelect = (c) => {
    setDrilldown({ type: "categoria", value: c, label: c });
    setSearchOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="inline-filterbar">
      {!kindHint && (
        <label className="ifb-item">
          <span>Grupo</span>
          <select className="filter-select" value={grupo} onChange={e => setGrupoAndClearCat(e.target.value)}>
            <option>Todos</option>
            <option>Receita</option>
            <option>Despesa</option>
          </select>
        </label>
      )}
      <label className="ifb-item ifb-search-wrap">
        <span>Categoria</span>
        <div className="ifb-search-trigger" onClick={() => setSearchOpen(o => !o)}>
          <span style={{ flex: 1 }}>
            {activeCategoria
              ? <span style={{ color: "var(--cyan)", fontWeight: 600 }}>{activeCategoria.length > 28 ? activeCategoria.slice(0, 28) + "…" : activeCategoria}</span>
              : <span style={{ color: "var(--mute)" }}>Todas categorias</span>}
          </span>
          <Icon name="chevronRight" />
        </div>
        {searchOpen && (
          <div className="ifb-popover">
            <input
              autoFocus
              type="text"
              placeholder={`Pesquisar (${categorias.length} categorias)`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ifb-search-input"
            />
            <div className="ifb-popover-list">
              <div className="ifb-popover-item" onClick={() => { setDrilldown(null); setSearchOpen(false); setSearchTerm(""); }}>
                <i>Todas categorias</i>
              </div>
              {filtered.map(c => (
                <div key={c}
                  className={`ifb-popover-item ${activeCategoria === c ? "active" : ""}`}
                  onClick={() => handleCatSelect(c)}>
                  {c}
                </div>
              ))}
              {filtered.length === 0 && <div className="ifb-popover-item" style={{ color: "var(--mute)" }}>Nada encontrado</div>}
            </div>
          </div>
        )}
      </label>
      {(activeCategoria || (drilldown && drilldown.type !== "categoria")) && (
        <button className="btn-ghost" onClick={() => setDrilldown(null)} title="Limpar filtros">
          Limpar
        </button>
      )}
    </div>
  );
};

// Compact button that opens the side drawer
const Filters = ({ filters, onOpen, page }) => {
  if (page === "comparativo") return null;
  const active = countActiveFilters(filters);
  return (
    <button className="btn-ghost filters-btn" onClick={onOpen}>
      <Icon name="sliders" /> Filtros
      {active > 0 && <span className="filters-badge">{active}</span>}
    </button>
  );
};

// Export current view (window.print → Save as PDF)
const ExportButton = () => (
  <button className="btn-ghost" onClick={() => window.print()}>
    <Icon name="download" /> Exportar
  </button>
);

const FiltersDrawer = ({ open, onClose, filters, setFilters }) => {
  if (!open) return null;
  const update = (patch) => setFilters({ ...filters, ...patch });
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-header">
          <h2>Filtros</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-group">
            <label>Regime</label>
            <div className="seg full">
              <button className={filters.regime === "caixa" ? "active" : ""} onClick={() => update({ regime: "caixa" })}>
                <Icon name="cash" /> Caixa
              </button>
              <button className={filters.regime === "competencia" ? "active" : ""} onClick={() => update({ regime: "competencia" })}>
                <Icon name="accrual" /> Competência
              </button>
            </div>
          </div>
          <div className="drawer-group">
            <label>Status</label>
            <select className="filter-select" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
              <option>Todos status</option><option>Pago</option><option>A pagar</option><option>Atrasado</option>
            </select>
          </div>
          <div className="drawer-group">
            <label>Categoria</label>
            <select className="filter-select" value={filters.categoria} onChange={(e) => update({ categoria: e.target.value })}>
              <option>Todas categorias</option><option>Folha</option><option>Marketing</option><option>Impostos</option>
              <option>Infra & Cloud</option><option>Software & SaaS</option><option>Comissões</option>
            </select>
          </div>
          <div className="drawer-group">
            <label>Centro de custo</label>
            <select className="filter-select" value={filters.cc} onChange={(e) => update({ cc: e.target.value })}>
              <option>Todos centros de custo</option><option>Comercial</option><option>Operações</option><option>Financeiro</option>
            </select>
          </div>
          <div className="drawer-group">
            <label>Período personalizado</label>
            <div className="date-range-pair">
              <input type="date" className="filter-select" value={filters.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
              <span className="date-range-sep">→</span>
              <input type="date" className="filter-select" value={filters.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
            </div>
          </div>
        </div>
        <footer className="drawer-footer">
          <button className="btn-ghost" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Limpar</button>
          <button className="btn-primary" onClick={onClose}>Aplicar</button>
        </footer>
      </aside>
    </div>
  );
};

// Chip que indica que o usuario filtrou um pedaco da tela clicando num grafico.
// drilldown shape: { type: 'mes'|'categoria'|'cliente'|'fornecedor'|'dia', value, label }
const DrilldownBadge = ({ drilldown, onClear }) => {
  if (!drilldown) return null;
  return (
    <div className="drilldown-badge">
      <span className="dd-label">Filtrando: <b>{drilldown.label}</b></span>
      <button className="dd-clear" onClick={onClear} aria-label="Limpar filtro">× Limpar</button>
    </div>
  );
};

// Helpers usados nas Pages para filtrar o EXTRATO conforme o drilldown ativo.
// EXTRATO row layout: [data DD/MM/YYYY, ccusto, categoria, cliente/fornecedor, valor, status]
function extratoMonthKey(dateStr) {
  // "04/05/2026" -> "2026-05"
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1]}`;
}
function applyDrilldown(extrato, dd) {
  if (!dd || !Array.isArray(extrato)) return extrato;
  if (dd.type === "mes") {
    return extrato.filter(e => extratoMonthKey(e[0]) === dd.value);
  }
  if (dd.type === "categoria") {
    return extrato.filter(e => e[2] === dd.value);
  }
  if (dd.type === "cliente" || dd.type === "fornecedor") {
    return extrato.filter(e => e[3] === dd.value);
  }
  return extrato;
}

// =====================================================================
// CrCpBlock — bloco reutilizável de "A receber" / "A pagar" (rotina 7093)
// Renderiza KPIs (total / vencido / a vencer), aging buckets e top 10.
// kind = 'receber' | 'pagar' (controla cor e labels)
// data = window.getCrCp(empresa)
// =====================================================================
const CrCpBlock = ({ data, kind, B, fmt }) => {
  if (!data || !data.totais) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--mute)' }}>
        Sem dados de {kind === 'receber' ? 'a receber' : 'a pagar'} disponíveis.
        <div style={{ fontSize: 11, marginTop: 6 }}>Rode <code>80_consulta_titulos_multi_empresa.py</code> + <code>81_parse_cr_cp.py</code></div>
      </div>
    );
  }
  const isRec = kind === 'receber';
  const totais = data.totais;
  const aging = isRec ? data.aging_receber : data.aging_pagar;
  const tops = isRec ? data.top_clientes : data.top_fornecedores;
  const total = isRec ? totais.a_receber_total : totais.a_pagar_total;
  const vencido = isRec ? totais.a_receber_vencido : totais.a_pagar_vencido;
  const aVencer = isRec ? totais.a_receber_a_vencer : totais.a_pagar_a_vencer;
  const nTit = isRec ? totais.n_titulos_receber : totais.n_titulos_pagar;
  const pctVencido = total > 0 ? (vencido / total) * 100 : 0;
  const corOk = isRec ? 'var(--green)' : 'var(--amber)';
  const corVencido = 'var(--red)';
  const titulo = isRec ? 'A receber' : 'A pagar';
  const subt = isRec ? 'Títulos pendentes de recebimento' : 'Títulos pendentes de pagamento';
  const fetchedAt = data.fetched_at ? new Date(data.fetched_at).toLocaleDateString('pt-BR') : '—';

  const fm = fmt || ((n) => `R$ ${n.toFixed(2)}`);
  const buckets = [
    { key: 'a_vencer', label: 'A vencer', color: corOk, n: aging['n_a_vencer'] || 0 },
    { key: '0-30', label: 'Vencido 0-30 d', color: '#f59e0b', n: aging['n_0-30'] || 0 },
    { key: '31-60', label: 'Vencido 31-60 d', color: '#fb923c', n: aging['n_31-60'] || 0 },
    { key: '61-90', label: 'Vencido 61-90 d', color: '#ef4444', n: aging['n_61-90'] || 0 },
    { key: '90+', label: 'Vencido 90+ d', color: '#b91c1c', n: aging['n_90+'] || 0 },
  ];
  const maxBucket = Math.max(...buckets.map(b => aging[b.key] || 0), 1);

  return (
    <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--fg-2)' }}>
          {titulo} · {subt}
        </div>
        <div style={{ fontSize: 11, color: 'var(--mute)' }}>
          Fonte: ERP rotina 7093 · {nTit} títulos · escopo {data.escopo === 'consolidado' ? '3 empresas' : data.label || 'empresa'} · atualizado {fetchedAt}
        </div>
      </div>

      <div className="row row-4" style={{ marginBottom: 14 }}>
        <div className="indicator-card" style={{ padding: 14 }}>
          <div className="kpi-label">Total {titulo.toLowerCase()}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, color: corOk }}>{fm(total)}</div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>{nTit} títulos em aberto</div>
        </div>
        <div className="indicator-card" style={{ padding: 14 }}>
          <div className="kpi-label">Vencido</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, color: corVencido }}>{fm(vencido)}</div>
          <div style={{ fontSize: 11, color: corVencido, marginTop: 4 }}>{pctVencido.toFixed(1)}% do total</div>
        </div>
        <div className="indicator-card" style={{ padding: 14 }}>
          <div className="kpi-label">A vencer</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, color: corOk }}>{fm(aVencer)}</div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>{(100 - pctVencido).toFixed(1)}% do total</div>
        </div>
        <div className="indicator-card" style={{ padding: 14 }}>
          <div className="kpi-label">Ticket médio</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, color: 'var(--cyan)' }}>{nTit > 0 ? fm(total / nTit) : '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>por título</div>
        </div>
      </div>

      <div className="row" style={{ gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)' }}>
        <div className="card">
          <h2 className="card-title">Aging · {titulo}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {buckets.map(b => {
              const v = aging[b.key] || 0;
              const w = (v / maxBucket) * 100;
              return (
                <div key={b.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: b.color }}>{b.label} <span style={{ color: 'var(--mute)' }}>({b.n})</span></span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fm(v)}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${w}%`, background: b.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Top 10 {isRec ? 'clientes' : 'fornecedores'} em aberto</h2>
          <div className="t-scroll" style={{ maxHeight: 320 }}>
            <table className="t">
              <thead>
                <tr>
                  <th>{isRec ? 'Cliente' : 'Fornecedor'}</th>
                  <th className="num">Saldo</th>
                  <th className="num">Vencido</th>
                  <th className="num">A vencer</th>
                  <th className="num">Atraso máx</th>
                </tr>
              </thead>
              <tbody>
                {tops.slice(0, 10).map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11 }}>{(t.nome || '').slice(0, 36)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{fm(t.valor)}</td>
                    <td className="num" style={{ color: t.vencido > 0 ? 'var(--red)' : 'var(--mute)' }}>{t.vencido > 0 ? fm(t.vencido) : '—'}</td>
                    <td className="num" style={{ color: t.a_vencer > 0 ? corOk : 'var(--mute)' }}>{t.a_vencer > 0 ? fm(t.a_vencer) : '—'}</td>
                    <td className="num" style={{ fontSize: 11, color: t.max_atraso > 90 ? 'var(--red)' : t.max_atraso > 30 ? 'var(--amber)' : 'var(--mute)' }}>
                      {t.max_atraso > 0 ? `${t.max_atraso}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  Icon, Sidebar, Header, Filters, FiltersDrawer, InlineFilterBar, ExportButton, DEFAULT_FILTERS,
  MonthlyBars, SingleBars, DailyBars, StackedArea, TrendChart, MultiLine,
  BarList, BarListLine, BarListLegend, DivergingBars, Donut, Spark, KpiTile,
  PAGE_TITLES, StatusFilterSeg, STATUS_FILTERS,
  DrilldownBadge, applyDrilldown, extratoMonthKey,
  CrCpBlock,
});
