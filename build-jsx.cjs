#!/usr/bin/env node
/**
 * Pre-compila JSX → JS minificado em UM unico bundle.
 * Antes: 3 .jsx files transformados em runtime pelo Babel-standalone (~5MB CDN
 * + parse + transform a cada page load → muito lento).
 * Agora: 1 app.bundle.js minificado (~50-100KB), zero runtime.
 *
 * Os .jsx originais usam variaveis globais cross-file (Icon, DATE_RANGES,
 * Sidebar, etc) — nao sao modulos. Estrategia: concatena ordem importa
 * (components.jsx → pages-1.jsx → pages-2.jsx → app.jsx do index.html)
 * e roda esbuild --transform pra resolver tudo em escopo unico.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const ROOT = __dirname;

// Lê bi.config.js pra decidir quais .jsx de pages incluir.
// Pages a fontes:
//   pages-1.jsx → overview, indicators, receita, despesa
//   pages-2.jsx → fluxo, tesouraria, comparativo, relatorio
//   pages-3.jsx → faturamento_produto, curva_abc, marketing, valuation
//   pages-4.jsx → hierarquia, detalhado, profunda_cliente, crm
const PAGES_BY_FILE = {
  'pages-1.jsx': ['overview', 'indicators', 'receita', 'receita_linha', 'despesa', 'indicadores_contabeis'],
  'pages-2.jsx': ['fluxo', 'tesouraria', 'endividamento', 'comparativo', 'relatorio'],
  'pages-3.jsx': ['faturamento_produto', 'curva_abc', 'marketing', 'valuation'],
  'pages-4.jsx': ['hierarquia', 'detalhado', 'profunda_cliente', 'crm'],
  'pages-extras-jce.jsx': ['estoque', 'ponto_equilibrio', 'rentabilidade', 'benchmarks'],
};
let activePages = ['overview', 'receita', 'despesa', 'fluxo', 'comparativo'];
try {
  const cfg = require(path.join(ROOT, 'bi.config.js'));
  activePages = [...(cfg.pages.geral || []), ...(cfg.pages.outros || [])];
  console.log(`  pages ativas: ${activePages.join(', ')}`);
} catch (e) {
  console.warn('  bi.config.js não encontrado, usando pages default');
}
// Inclui um arquivo de pages só se ao menos uma das páginas dele estiver ativa.
const SOURCES = ['components.jsx'].concat(
  Object.entries(PAGES_BY_FILE)
    .filter(([file, ids]) => ids.some(id => activePages.includes(id)))
    .map(([file]) => file)
);
console.log(`  bundling: ${SOURCES.join(', ')}`);

(async () => {
  // Cada .jsx redeclara `const { useState } = React;` no topo (era pra Babel-
  // standalone funcionar com escopo isolado por <script>). Concatenado vira
  // duplicate declaration. Strip e re-injeta uma vez no inicio do bundle.
  const HOIST_HEADER = `\nvar { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, Fragment } = React;\n`;
  const stripReactHooks = (src) => src.replace(/^\s*const\s*\{[^}]*\}\s*=\s*React\s*;?\s*$/gm, '');

  const concat = HOIST_HEADER + SOURCES.map((f) => {
    const body = stripReactHooks(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    return `\n/* ===== ${f} ===== */\n${body}`;
  }).join('\n');

  // O App.jsx original esta inline no index.html. Movemos pra ca pra ficar
  // bundlado tambem. SE o operador editar index.html, manter a IIFE de boot.
  const APP_BODY = `
/* ===== App (raiz) ===== */
(function () {
  var useState = React.useState;
  var useEffect = React.useEffect;
  var PAGE_LABELS = {
    overview: '01 Visão geral',
    indicators: '02 Indicadores',
    receita: '03 Receita',
    receita_linha: '03b Receita por Linha',
    despesa: '04 Despesa',
    fluxo: '05 Fluxo de caixa',
    tesouraria: '06 Tesouraria',
    endividamento: '07 Endividamento Bancário',
    comparativo: '08 Comparativo',
    relatorio: '09 Relatório IA',
    indicadores_contabeis: '10 Indicadores Contábeis (dado indisponível)',
    faturamento_produto: '10 Faturamento por Produto',
    curva_abc: '11 Curva ABC',
    marketing: '12 Marketing ADS',
    valuation: '13 Valuation',
    hierarquia: '14 Hierarquia ADS',
    detalhado: '15 Detalhado',
    profunda_cliente: '16 Profunda Cliente',
    crm: '17 CRM',
    estoque: '18 Estoque & Capital de Giro',
    ponto_equilibrio: '19 Pontos de Equilíbrio & Alavancagem',
    rentabilidade: '20 Retorno & Rentabilidade',
    benchmarks: '21 Benchmarks vs Cliente',
  };
  function App() {
    var p = useState('overview'); var page = p[0], setPage = p[1];
    var f = useState(Object.assign({}, DEFAULT_FILTERS)); var filters = f[0], setFilters = f[1];
    var fo = useState(false); var filtersOpen = fo[0], setFiltersOpen = fo[1];
    var so = useState(false); var sidebarOpen = so[0], setSidebarOpen = so[1];
    var sf = useState(function () {
      try { return localStorage.getItem('bi.statusFilter') || 'realizado'; } catch (e) { return 'realizado'; }
    });
    var statusFilter = sf[0], setStatusFilter = sf[1];
    // Drilldown global: setado quando o usuario clica numa barra/linha de grafico.
    var dd = useState(null);
    var drilldown = dd[0], setDrilldown = dd[1];
    // Year selector: padrao = ano corrente (window.REF_YEAR)
    var ys = useState(function () {
      // Default = 0 (Todos os anos) — mostra R$ 120M consolidado em vez de só 5 meses
      try {
        var raw = localStorage.getItem('bi.year');
        if (raw === null) return 0;
        var y = parseInt(raw, 10);
        return (y === 0 || y > 1900) ? y : 0;
      } catch (e) { return 0; }
    });
    var year = ys[0], setYear = ys[1];
    var ms = useState(function () {
      try { var m = parseInt(localStorage.getItem('bi.month'), 10); return (m >= 0 && m <= 12) ? m : 0; } catch (e) { return 0; }
    });
    var month = ms[0], setMonth = ms[1];
    // Filtro Empresa (cascade global). '0' = consolidado.
    var es = useState(function () {
      try { return localStorage.getItem('bi.empresa') || '0'; } catch (e) { return '0'; }
    });
    var empresa = es[0], setEmpresa = es[1];

    // BI export multi-tela: array de page-ids ou null. Quando setado, renderiza
    // todas as telas em sequencia + chama window.print() depois do layout pintar.
    var pp = useState(null); var printPages = pp[0], setPrintPages = pp[1];
    useEffect(function () {
      window.startBiExport = function (pages) {
        document.body.classList.add('bi-print-mode');
        setPrintPages(pages);
      };
      return function () { window.startBiExport = null; };
    }, []);
    useEffect(function () {
      if (!printPages) return;
      var cancelled = false;
      var waitReady = function () {
        // 1) fonts
        var fontsP = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
        // 2) imagens (todas as <img> do bi-print-root tem que ter terminado)
        var imgsP = new Promise(function (resolve) {
          var imgs = Array.prototype.slice.call(document.querySelectorAll('.bi-print-root img'));
          var pending = imgs.filter(function (i) { return !i.complete; });
          if (pending.length === 0) return resolve();
          var done = 0;
          pending.forEach(function (i) {
            var fin = function () { done++; if (done >= pending.length) resolve(); };
            i.addEventListener('load', fin, { once: true });
            i.addEventListener('error', fin, { once: true });
          });
          // safety net
          setTimeout(resolve, 5000);
        });
        // 3) PageRelatorio: se foi incluído no export, esperar até ele renderizar conteudo
        //    (carrega async via fetch). Damos até 30s, polling a cada 200ms.
        var hasRelatorio = printPages.indexOf('relatorio') !== -1;
        var relatorioP = !hasRelatorio ? Promise.resolve() : new Promise(function (resolve) {
          var deadline = Date.now() + 30000;
          var poll = function () {
            if (cancelled) return resolve();
            // Sinal: PageRelatorio renderizou .report-cover OU mensagem de erro/help
            var rendered = document.querySelector('.bi-print-root .report-cover')
              || document.querySelector('.bi-print-root .report');
            if (rendered) return resolve();
            if (Date.now() > deadline) return resolve();
            setTimeout(poll, 200);
          };
          poll();
        });
        Promise.all([fontsP, imgsP, relatorioP]).then(function () {
          if (cancelled) return;
          // 2 frames pra garantir reflow final + 400ms pra layout estabilizar
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              setTimeout(function () {
                if (cancelled) return;
                window.print();
                setTimeout(function () {
                  document.body.classList.remove('bi-print-mode');
                  setPrintPages(null);
                }, 800);
              }, 400);
            });
          });
        });
      };
      waitReady();
      return function () { cancelled = true; };
    }, [printPages]);

    // window.BIT é a "fonte global" usada por componentes que não recebem B via prop
    // (OverviewBars, MonthlyBars title, etc) e por hooks internos que leem fmt/fmtK.
    // PRECISA recompor em qualquer mudança de filtro — antes só escutava statusFilter
    // e passava só 1 arg pro _makeBit (que tem signature de 5 args), deixando empresa/
    // year/month/drilldown sempre defaults → barras ficavam com escala antiga.
    useEffect(function () {
      try { localStorage.setItem('bi.statusFilter', statusFilter); } catch (e) {}
      if (typeof window._makeBit === 'function') {
        window.BIT = window._makeBit(statusFilter, empresa, year, month, drilldown);
      }
    }, [statusFilter, empresa, year, month, drilldown]);

    // statusFilter/year/month/empresa devem limpar drilldown (mas não disparar nessa
    // useEffect — pra evitar loop com a recomposição acima).
    useEffect(function () { setDrilldown(null); }, [statusFilter]);
    useEffect(function () {
      try { localStorage.setItem('bi.year', String(year)); } catch (e) {}
      setDrilldown(null);
    }, [year]);
    useEffect(function () {
      try { localStorage.setItem('bi.month', String(month)); } catch (e) {}
      setDrilldown(null);
    }, [month]);
    useEffect(function () {
      try { localStorage.setItem('bi.empresa', String(empresa)); } catch (e) {}
      setDrilldown(null);
    }, [empresa]);

    var handleSetPage = function (newPage) {
      setPage(newPage);
      setSidebarOpen(false);
      setDrilldown(null);
    };

    // PAGE_COMPS só inclui componentes que existem no bundle (build-jsx só
    // empacota arquivos pages-X.jsx das pages ativas em bi.config.js).
    var PAGE_COMPS = {};
    if (typeof PageOverview            !== 'undefined') PAGE_COMPS.overview            = PageOverview;
    if (typeof PageIndicators          !== 'undefined') PAGE_COMPS.indicators          = PageIndicators;
    if (typeof PageReceita             !== 'undefined') PAGE_COMPS.receita             = PageReceita;
    if (typeof PageReceitaLinha        !== 'undefined') PAGE_COMPS.receita_linha       = PageReceitaLinha;
    if (typeof PageDespesa             !== 'undefined') PAGE_COMPS.despesa             = PageDespesa;
    if (typeof PageFluxo               !== 'undefined') PAGE_COMPS.fluxo               = PageFluxo;
    if (typeof PageTesouraria          !== 'undefined') PAGE_COMPS.tesouraria          = PageTesouraria;
    if (typeof PageEndividamento       !== 'undefined') PAGE_COMPS.endividamento       = PageEndividamento;
    if (typeof PageComparativo         !== 'undefined') PAGE_COMPS.comparativo         = PageComparativo;
    if (typeof PageRelatorio           !== 'undefined') PAGE_COMPS.relatorio           = PageRelatorio;
    if (typeof PageFaturamentoProduto  !== 'undefined') PAGE_COMPS.faturamento_produto = PageFaturamentoProduto;
    if (typeof PageCurvaABC            !== 'undefined') PAGE_COMPS.curva_abc           = PageCurvaABC;
    if (typeof PageMarketing           !== 'undefined') PAGE_COMPS.marketing           = PageMarketing;
    if (typeof PageValuation           !== 'undefined') PAGE_COMPS.valuation           = PageValuation;
    if (typeof PageHierarquia          !== 'undefined') PAGE_COMPS.hierarquia          = PageHierarquia;
    if (typeof PageDetalhado           !== 'undefined') PAGE_COMPS.detalhado           = PageDetalhado;
    if (typeof PageProfundaCliente     !== 'undefined') PAGE_COMPS.profunda_cliente    = PageProfundaCliente;
    if (typeof PageCRM                 !== 'undefined') PAGE_COMPS.crm                 = PageCRM;
    if (typeof PageIndicadoresContabeis !== 'undefined') PAGE_COMPS.indicadores_contabeis = PageIndicadoresContabeis;
    if (typeof PageEstoque             !== 'undefined') PAGE_COMPS.estoque             = PageEstoque;
    if (typeof PagePontoEquilibrio     !== 'undefined') PAGE_COMPS.ponto_equilibrio   = PagePontoEquilibrio;
    if (typeof PageRentabilidade       !== 'undefined') PAGE_COMPS.rentabilidade      = PageRentabilidade;
    if (typeof PageBenchmarks          !== 'undefined') PAGE_COMPS.benchmarks         = PageBenchmarks;
    var PageComp = PAGE_COMPS[page];

    var commonProps = {
      filters: filters,
      setFilters: setFilters,
      onOpenFilters: function () { setFiltersOpen(true); },
      statusFilter: statusFilter,
      year: year,
      setYear: setYear,
      month: month,
      setMonth: setMonth,
      empresa: empresa,
      setEmpresa: setEmpresa,
      drilldown: drilldown,
      setDrilldown: setDrilldown,
    };

    // Modo print multi-tela: renderiza todas as paginas selecionadas em sequencia
    if (printPages && printPages.length > 0) {
      return (
        <div className="app bi-print-root">
          {printPages.map(function (id, i) {
            var Comp = PAGE_COMPS[id];
            if (!Comp) return null;
            return (
              <div key={id + '-' + i} className="bi-print-page">
                <div className="bi-print-header">
                  <img src="assets/bgp-logo-white.png" alt="BGP" className="bi-print-logo" />
                  <div className="bi-print-title">
                    <div className="bi-print-pagenum">{PAGE_LABELS[id] || id}</div>
                    <div className="bi-print-brand">BI Financeiro</div>
                  </div>
                </div>
                <Comp {...commonProps} />
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className={'app ' + (sidebarOpen ? 'sidebar-open' : '')} data-screen-label={PAGE_LABELS[page]}>
        <Sidebar active={page} onSelect={handleSetPage} open={sidebarOpen} />
        <div className="sidebar-backdrop" onClick={function () { setSidebarOpen(false); }} />
        <div className="main">
          <Header
            page={page}
            onToggleSidebar={function () { setSidebarOpen(function (o) { return !o; }); }}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            year={year}
            setYear={setYear}
            month={month}
            setMonth={setMonth}
            empresa={empresa}
            setEmpresa={setEmpresa}
          />
          <PageComp {...commonProps} />
        </div>
        <FiltersDrawer open={filtersOpen} onClose={function () { setFiltersOpen(false); }} filters={filters} setFilters={setFilters} />
      </div>
    );
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
`;

  const finalSource = concat + '\n' + APP_BODY;

  const result = await esbuild.transform(finalSource, {
    loader: 'jsx',
    jsx: 'transform',
    minify: true,
    target: ['es2017'],
  });

  const out = path.join(ROOT, 'app.bundle.js');
  fs.writeFileSync(out, result.code);
  const sizeKB = (result.code.length / 1024).toFixed(1);
  console.log(`OK app.bundle.js (${sizeKB} KB) — concat de ${SOURCES.length} .jsx + App raiz`);
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
