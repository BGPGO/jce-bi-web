/**
 * pages-extras-jce.jsx
 *
 * Páginas extras "Outros" do BI JCE — análises do doc Ajustes BI - Global
 * que NÃO se encaixam em Visão Geral / Receita / Despesa / Fluxo /
 * Tesouraria / Comparativo. Cada uma é uma TELA PRÓPRIA da seção Outros.
 *
 * Pages (4):
 *   - PageEstoque         — PME, PMP, PMR, NCG, ciclo financeiro, giro estoque
 *                           (DADO INDISPONÍVEL c/ benchmarks setoriais)
 *   - PagePontoEquilibrio — PE Operacional, PE Financeiro, PE Geral, GAF, GAO
 *                           (calculado a partir do DRE com premissa de % fixo)
 *   - PageRentabilidade   — ROA, ROE, ROS, Giro do Ativo, Juros s/ vendas
 *                           (depende do balanço; placeholder + ROS calculado)
 *   - PageBenchmarks      — KPIs do BI vs benchmark setor com desvio
 *
 * Padrão: cada page é REATIVA a (statusFilter, year, month, empresa, drilldown)
 * via useMemo + window.getBit. Usa SVG charts existentes (Gauge, Sparkline,
 * Heatmap, Pareto) sempre que cabível.
 */
const { useState, useMemo, useEffect } = React;

// =============================================================================
// Helpers compartilhados nas pages-extras
// =============================================================================

// Card de KPI marcado como "DADO INDISPONÍVEL" — visual idêntico ao Page
// Indicadores Contábeis pra manter consistência. Aceita benchmark + motivo.
const PlaceholderKpi = ({ name, motivo, benchmark, fonte }) => (
  <div style={{
    background: "rgba(255,255,255,0.02)",
    border: "1px dashed rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: 14,
    position: "relative",
  }}>
    <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(251, 191, 36, 0.85)", marginBottom: 6, fontWeight: 600 }}>
      Dado indisponível
    </div>
    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{name}</div>
    <div style={{ fontSize: 11, color: "var(--fg-2)", marginBottom: 8, fontFamily: "JetBrains Mono, monospace" }}>{motivo}</div>
    {benchmark && (
      <div style={{ fontSize: 11, color: "var(--cyan, #22d3ee)" }}>benchmark: {benchmark}</div>
    )}
    {fonte && (
      <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 4 }}>{fonte}</div>
    )}
  </div>
);

// Card de KPI calculado com tom (red/amber/green) automatizado por desvio do
// benchmark. Aceita value (número), unit ('%' / 'x' / 'd' / 'R$').
const CalcKpi = ({ name, value, unit, target, lower_is_better, sub, format }) => {
  const fmt = format || ((v) => `${v.toFixed(2).replace(".", ",")}${unit || ""}`);
  let tone = "cyan";
  if (target != null && Number.isFinite(value)) {
    const ok = lower_is_better ? value <= target : value >= target;
    const close = lower_is_better ? value <= target * 1.15 : value >= target * 0.85;
    tone = ok ? "green" : (close ? "amber" : "red");
  }
  const color = tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : tone === "amber" ? "#fbbf24" : "var(--cyan)";
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8,
      padding: 14,
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 6, fontWeight: 600 }}>
        {name}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color }}>
        {Number.isFinite(value) ? fmt(value) : "—"}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>{sub}</div>}
      {target != null && (
        <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 6 }}>
          alvo: {lower_is_better ? "≤" : "≥"} {typeof target === "number" ? target.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : target}{unit || ""}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// PageEstoque — Capital de Giro · PME / PMR / PMP / Ciclo Financeiro / NCG
// =============================================================================
// Motivo: ERP Solution não fornece o módulo Estoque pro user atual; ciclo
// financeiro e NCG dependem de saldos médios de estoque + duplicatas a receber
// + duplicatas a pagar. Mostramos placeholders + benchmarks setoriais.

const PageEstoque = ({ statusFilter, year, month, empresa, drilldown, setDrilldown }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const SUR = (typeof window !== "undefined" && window.SURROGATES) || {};
  const BENCH = SUR.BENCHMARKS || {};

  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const empresaLabel = (!empresa || empresa === '0') ? "Consolidado" :
    (window.EMPRESAS && window.EMPRESAS.find(e => e.codigo === empresa) || {}).label || empresa;

  // Receita realizada do período (proxy pra dimensionar o que ESTARIA na NCG)
  const receitaPeriodo = B.RECEITA_LIQUIDA || B.TOTAL_RECEITA || 0;
  const cmvPeriodo = B.CMV || 0;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Estoque & Capital de Giro</h1>
          <div className="status-line">
            {empresaLabel} · ano {refYear} · ciclo financeiro, NCG e giro de estoque
          </div>
        </div>
      </div>

      {/* Aviso explicando por que está indisponível */}
      <div className="card" style={{ marginBottom: 16, border: "1px solid rgba(251, 191, 36, 0.3)", background: "rgba(251, 191, 36, 0.05)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 24, lineHeight: 1 }}>⚠</div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Por que estes KPIs estão indisponíveis</div>
            <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5 }}>
              Capital de giro depende de <b>saldos médios de Estoque, Duplicatas a Receber e Duplicatas a Pagar</b>.
              O acesso atual ao ERP Solution só inclui o módulo Razão de Caixa — sem visibilidade sobre
              o módulo de Estoque (codigos 1.01.04.xx no Balanço) e sem o saldo médio diário das contas
              a receber/pagar. Pra habilitar PME, PMR, PMP e ciclo financeiro precisamos de:
            </div>
            <ul style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 8, paddingLeft: 16 }}>
              <li>liberação do módulo Contábil ou exportação mensal do Balanço Patrimonial</li>
              <li>relatório de estoque (saldo + giro) ou view do RM/Aliare por empresa</li>
              <li>aging de Contas a Receber e Contas a Pagar</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Linha de contexto: receita e CMV do período (já temos via DRE) */}
      <div className="row row-4" style={{ gap: 12, marginBottom: 16 }}>
        <CalcKpi name="Receita Líquida YTD" value={receitaPeriodo} unit="" sub={`base p/ dimensionar ciclo · ${empresaLabel}`}
          format={(v) => B.fmtK(v)} />
        <CalcKpi name="CMV YTD" value={cmvPeriodo} unit="" sub="base p/ giro de estoque"
          format={(v) => B.fmtK(v)} />
        <CalcKpi name="Resultado Operacional" value={B.RESULTADO_OPERACIONAL || 0} unit="" sub="usado em GAO/GAF (ver Pto Equilíbrio)"
          format={(v) => B.fmtK(v)} />
        <CalcKpi name="Margem Bruta" value={B.MARGEM_BRUTA_PCT || 0} unit="%" sub={`vs setor: ${BENCH.EBITDA_MARGIN_SETOR || 3.5}% (EBITDA)`}
          target={20} />
      </div>

      {/* KPIs indisponíveis — mesma estética da PageIndicadoresContabeis */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Prazos Médios &amp; Ciclo Financeiro</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          <PlaceholderKpi name="PME — Prazo Médio Estoque"
            motivo="(Estoque médio / CMV) × 360"
            benchmark="60-90 dias (concessionária máq. agrícola)"
            fonte="Farm Equipment Magazine 2024" />
          <PlaceholderKpi name="PMR — Prazo Médio Recebimento"
            motivo="(Contas a Receber / Receita) × 360"
            benchmark="≤ 45 dias (BNDES Finame ≤ 60d)" />
          <PlaceholderKpi name="PMP — Prazo Médio Pagamento"
            motivo="(Fornecedores / CMV) × 360"
            benchmark="≥ 30 dias" />
          <PlaceholderKpi name="Ciclo Operacional"
            motivo="PME + PMR"
            benchmark="≤ 120 dias" />
          <PlaceholderKpi name="Ciclo Financeiro (Cash Cycle)"
            motivo="PME + PMR − PMP"
            benchmark="≤ 90 dias (saudável); ≤ 60 dias (excelente)" />
          <PlaceholderKpi name="NCG — Necessidade Capital de Giro"
            motivo="ACO − PCO (Ativo Circ. Operacional − Passivo Circ. Operacional)"
            benchmark="varia · acompanha sazonalidade da safra" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Giro &amp; Eficiência</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          <PlaceholderKpi name="Giro de Estoque" motivo="CMV / Estoque médio"
            benchmark="≥ 4x ao ano (concessionária)" fonte="FENABRAVE 2024" />
          <PlaceholderKpi name="Giro de Estoque por Linha"
            motivo="CMV linha / Estoque linha (Trator / Implemento / Peças)"
            benchmark="Peças ≥ 6x · Máq. ≥ 2x" />
          <PlaceholderKpi name="Capital de Giro Líquido"
            motivo="Ativo Circulante − Passivo Circulante"
            benchmark="positivo (mín. 1,2x do PC)" />
          <PlaceholderKpi name="Liquidez do CG"
            motivo="CG / Receita Mensal"
            benchmark="≥ 1,5 mês de operação" />
        </div>
      </div>

      {/* Benchmarks (sempre disponíveis) */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">Benchmarks setoriais — capital de giro</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          <BenchmarkTileE label="PMR alvo (concessionária)" value="≤ 45 dias" fonte="BNDES Finame · 2024" />
          <BenchmarkTileE label="PME alvo (máq. agrícola)" value="60-90 dias" fonte="Farm Equipment Magazine" />
          <BenchmarkTileE label="Giro estoque ideal" value="≥ 4x/ano" fonte="FENABRAVE 2024" />
          <BenchmarkTileE label="Inadimplência agro 2T2025" value={`${BENCH.INADIMPLENCIA_AGRO || 8.1}%`} fonte="Serasa via Gazeta do Povo" />
        </div>
      </div>
    </div>
  );
};

// Tile local de benchmark (evita colidir com BenchmarkTile de pages-1.jsx,
// que está no escopo do mesmo bundle concatenado).
const BenchmarkTileE = ({ label, value, fonte }) => (
  <div style={{ background: "rgba(34, 211, 238, 0.06)", border: "1px solid rgba(34, 211, 238, 0.2)", borderRadius: 8, padding: 14 }}>
    <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 300, fontFamily: "JetBrains Mono, monospace", color: "var(--cyan, #22d3ee)" }}>{value}</div>
    <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 6 }}>{fonte}</div>
  </div>
);

// =============================================================================
// PagePontoEquilibrio — PE Operacional / PE Financeiro / PE Geral / GAF / GAO
// =============================================================================
// PE Operacional = Custos Fixos / (1 − Custos Variáveis / Receita)
// PE Financeiro  = (CF + Despesa Fin) / Margem Contribuição
// PE Geral       = (CF + DF + Lucro alvo) / MC
// GAO            = Margem Contribuição / Resultado Operacional
// GAF            = Resultado Operacional / Lucro antes IR
//
// Premissa pra estimar Fixo vs Variável a partir do DRE caixa:
//   - CMV é 100% variável (se mexe com vendas)
//   - Despesa Op é dividida em: 60% fixa (folha, aluguel, infra), 40% variável
//     (comissões, transporte, frete). É premissa do mercado de concessionária
//     agrícola — pode ajustar via slider pelo gestor depois.

const PagePontoEquilibrio = ({ statusFilter, year, month, empresa, drilldown, setDrilldown }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const empresaLabel = (!empresa || empresa === '0') ? "Consolidado" :
    (window.EMPRESAS && window.EMPRESAS.find(e => e.codigo === empresa) || {}).label || empresa;

  // Slider local: % da Despesa Operacional considerada FIXA.
  // Default = 60% (premissa de concessionária máq. agrícola).
  const [pctFixo, setPctFixo] = useState(60);

  const calc = useMemo(() => {
    const receita = B.RECEITA_LIQUIDA || 0;
    const cmv = B.CMV || 0;
    const desp_op = B.DESPESA_OP || 0;
    const desp_fin = B.DESPESA_FIN || 0;
    const rec_fin = B.RECEITA_FIN || 0;
    const ebitda = B.RESULTADO_OPERACIONAL || 0;
    const lucro = B.LUCRO_LIQUIDO || 0;

    const f = pctFixo / 100;
    const cf = desp_op * f;          // Custos Fixos (parte da despesa op)
    const cv = cmv + desp_op * (1 - f); // Custos Variáveis (CMV + parte op)
    const cv_pct = receita > 0 ? cv / receita : 0;
    const mc_pct = 1 - cv_pct;       // Margem de contribuição %
    const mc = receita - cv;          // Margem de contribuição R$

    const pe_op = mc_pct > 0 ? cf / mc_pct : 0;
    const pe_fin = mc_pct > 0 ? (cf + desp_fin - rec_fin) / mc_pct : 0;
    const pe_geral_lucro_alvo = receita * 0.05; // alvo: 5% de margem líquida
    const pe_geral = mc_pct > 0 ? (cf + desp_fin - rec_fin + pe_geral_lucro_alvo) / mc_pct : 0;

    const lucro_antes_ir = ebitda - desp_fin + rec_fin;
    const gao = ebitda !== 0 ? mc / ebitda : 0;
    const gaf = lucro_antes_ir !== 0 ? ebitda / lucro_antes_ir : 0;
    const gat = gao * gaf; // alavancagem total (combinada)

    const margem_seguranca = receita > 0 && pe_op > 0 ? ((receita - pe_op) / receita) * 100 : 0;

    return { receita, cmv, desp_op, desp_fin, rec_fin, ebitda, lucro,
             cf, cv, cv_pct, mc_pct, mc,
             pe_op, pe_fin, pe_geral, pe_geral_lucro_alvo, lucro_antes_ir,
             gao, gaf, gat, margem_seguranca };
  }, [B, pctFixo]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Pontos de Equilíbrio &amp; Alavancagem</h1>
          <div className="status-line">
            {empresaLabel} · ano {refYear} · PE Operacional, Financeiro e Geral · GAO &amp; GAF
          </div>
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      {/* Premissa configurável */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Premissa: % da Despesa Operacional considerada FIXA</div>
            <div style={{ fontSize: 11, color: "var(--fg-2)" }}>
              CMV é 100% variável. Da Despesa Op, <b>{pctFixo}%</b> é fixa (folha, aluguel, infra) · <b>{100 - pctFixo}%</b> é variável (comissões, frete).
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="range" min="30" max="90" step="5" value={pctFixo}
              onChange={(e) => setPctFixo(Number(e.target.value))}
              style={{ width: 200 }} />
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 18, color: "var(--cyan)", minWidth: 50 }}>
              {pctFixo}%
            </div>
          </div>
        </div>
      </div>

      {/* KPIs principais — 4 colunas */}
      <div className="row row-4" style={{ gap: 12, marginBottom: 16 }}>
        <CalcKpi name="Receita Líquida"
          value={calc.receita}
          format={(v) => B.fmtK(v)}
          sub="base de cálculo" />
        <CalcKpi name="Margem de Contribuição"
          value={calc.mc_pct * 100} unit="%"
          target={20}
          sub={`= ${B.fmtK(calc.mc)} · cobre o fixo`} />
        <CalcKpi name="Custos Fixos"
          value={calc.cf}
          format={(v) => B.fmtK(v)}
          sub={`${pctFixo}% da Despesa Op`} />
        <CalcKpi name="Custos Variáveis"
          value={calc.cv}
          format={(v) => B.fmtK(v)}
          sub={`CMV + ${100 - pctFixo}% Despesa Op`} />
      </div>

      {/* 3 PEs */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Pontos de Equilíbrio</h2>
        <div className="row" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
          <PEBox label="PE Operacional"
            formula="CF / MC%"
            value={calc.pe_op}
            atual={calc.receita}
            sub="Receita mínima pra zerar EBITDA"
            fmt={B.fmtK} />
          <PEBox label="PE Financeiro"
            formula="(CF + DF − RF) / MC%"
            value={calc.pe_fin}
            atual={calc.receita}
            sub="Inclui Despesa/Receita Financeira"
            fmt={B.fmtK} />
          <PEBox label="PE Geral (lucro 5%)"
            formula="(CF + DF + Lucro) / MC%"
            value={calc.pe_geral}
            atual={calc.receita}
            sub={`Atinge ${B.fmtK(calc.pe_geral_lucro_alvo)} de lucro`}
            fmt={B.fmtK} />
        </div>

        {/* Margem de segurança */}
        <div style={{ marginTop: 16, padding: 14, background: "rgba(34, 211, 238, 0.06)",
          border: "1px solid rgba(34, 211, 238, 0.2)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-2)", fontWeight: 600 }}>
                Margem de Segurança Operacional
              </div>
              <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 4 }}>
                (Receita − PE Operacional) / Receita
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 600, fontFamily: "JetBrains Mono, monospace",
              color: calc.margem_seguranca >= 20 ? "var(--green)" : calc.margem_seguranca >= 0 ? "#fbbf24" : "var(--red)" }}>
              {calc.margem_seguranca.toFixed(1).replace(".", ",")}%
            </div>
          </div>
        </div>
      </div>

      {/* Alavancagem */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Grau de Alavancagem</h2>
        <div className="row" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
          <CalcKpi name="GAO — Operacional"
            value={calc.gao}
            unit="x"
            sub="Δ% Resultado Op / Δ% Receita · MC / EBITDA"
            target={2}
            lower_is_better={true} />
          <CalcKpi name="GAF — Financeiro"
            value={calc.gaf}
            unit="x"
            sub="Δ% Lucro / Δ% Resultado Op · EBITDA / LAIR"
            target={2}
            lower_is_better={true} />
          <CalcKpi name="GAT — Total"
            value={calc.gat}
            unit="x"
            sub="GAO × GAF · sensibilidade total"
            target={4}
            lower_is_better={true} />
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>
          <b>Como ler:</b> GAO {calc.gao.toFixed(2)}x significa que cada 1% de variação na receita gera ~{calc.gao.toFixed(1)}% de variação no resultado operacional.
          GAF {calc.gaf.toFixed(2)}x significa que o endividamento amplifica em {calc.gaf.toFixed(1)}x o impacto do EBITDA no lucro.
          Quanto mais alto, maior a sensibilidade e o risco.
        </div>
      </div>

      {/* DRE simplificado de apoio */}
      <div className="card">
        <h2 className="card-title">DRE simplificado · base do cálculo</h2>
        <table className="t" style={{ marginTop: 8 }}>
          <tbody>
            <tr><td>Receita Líquida</td><td className="num">{B.fmt(calc.receita)}</td></tr>
            <tr><td>(−) Custos Variáveis (CMV + {100 - pctFixo}% Op)</td><td className="num red">−{B.fmt(calc.cv)}</td></tr>
            <tr style={{ fontWeight: 700 }}><td>= Margem de Contribuição</td><td className="num">{B.fmt(calc.mc)} ({(calc.mc_pct * 100).toFixed(1).replace(".", ",")}%)</td></tr>
            <tr><td>(−) Custos Fixos ({pctFixo}% Despesa Op)</td><td className="num red">−{B.fmt(calc.cf)}</td></tr>
            <tr style={{ fontWeight: 700 }}><td>= EBITDA</td><td className="num">{B.fmt(calc.ebitda)}</td></tr>
            <tr><td>(−) Despesa Financeira</td><td className="num red">−{B.fmt(calc.desp_fin)}</td></tr>
            <tr><td>(+) Receita Financeira</td><td className="num green">+{B.fmt(calc.rec_fin)}</td></tr>
            <tr style={{ fontWeight: 700 }}><td>= Lucro antes IR</td><td className="num">{B.fmt(calc.lucro_antes_ir)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Sub-component pra apresentação de cada PE com gauge + comparação
const PEBox = ({ label, formula, value, atual, sub, fmt }) => {
  const ok = atual >= value;
  const ratio = value > 0 ? (atual / value) : 0;
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8,
      padding: 14,
    }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-2)", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "JetBrains Mono, monospace",
        color: ok ? "var(--green)" : "var(--red)" }}>
        {fmt(value)}
      </div>
      <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
        {formula}
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 11, color: "var(--fg-2)" }}>
          Atual: <b style={{ color: ok ? "var(--green)" : "var(--red)" }}>{fmt(atual)}</b>
          {value > 0 && (
            <span style={{ marginLeft: 6 }}>
              ({ratio >= 1 ? "+" : ""}{((ratio - 1) * 100).toFixed(0)}% vs PE)
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
};

// =============================================================================
// PageRentabilidade — ROA / ROE / ROS / Giro Ativo / Juros s/ Vendas
// =============================================================================
// ROS é o único 100% calculável a partir do DRE caixa (Lucro Líquido / Receita).
// ROA, ROE e Giro do Ativo dependem de Balanço Patrimonial (Ativo Total e PL).
// Mostramos ROS calculado + os outros como placeholder com benchmarks.
// Juros s/ Vendas = Despesa Financeira / Receita (calculável).

const PageRentabilidade = ({ statusFilter, year, month, empresa, drilldown, setDrilldown }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const empresaLabel = (!empresa || empresa === '0') ? "Consolidado" :
    (window.EMPRESAS && window.EMPRESAS.find(e => e.codigo === empresa) || {}).label || empresa;
  const SUR = (typeof window !== "undefined" && window.SURROGATES) || {};
  const BENCH = SUR.BENCHMARKS || {};

  const calc = useMemo(() => {
    const receita = B.RECEITA_LIQUIDA || 0;
    const lucro = B.LUCRO_LIQUIDO || 0;
    const ebitda = B.RESULTADO_OPERACIONAL || 0;
    const desp_fin = B.DESPESA_FIN || 0;
    const rec_fin = B.RECEITA_FIN || 0;
    const impostos = B.IMPOSTOS || 0;

    // ROS (Margem Líquida) — calculável
    const ros = receita > 0 ? (lucro / receita) * 100 : 0;
    // Margem EBITDA — calculável
    const margem_ebitda = receita > 0 ? (ebitda / receita) * 100 : 0;
    // Margem Bruta — calculável
    const margem_bruta = B.MARGEM_BRUTA_PCT || 0;
    // Juros sobre vendas — calculável (Despesa Fin / Receita)
    const juros_vendas = receita > 0 ? (desp_fin / receita) * 100 : 0;
    // Receita Fin sobre vendas
    const rec_fin_vendas = receita > 0 ? (rec_fin / receita) * 100 : 0;
    // Carga tributária aparente
    const carga_trib = receita > 0 ? (impostos / receita) * 100 : 0;
    // Resultado Fin Líquido
    const res_fin_liq = rec_fin - desp_fin;

    return { receita, lucro, ebitda, desp_fin, rec_fin, impostos,
             ros, margem_ebitda, margem_bruta, juros_vendas, rec_fin_vendas,
             carga_trib, res_fin_liq };
  }, [B]);

  // série de margem líquida mensal pra sparkline
  const margemSerie = useMemo(() => {
    if (!B.MONTH_DATA) return [];
    return B.MONTH_DATA.map(m => m.receita > 0 ? ((m.receita - m.despesa) / m.receita) * 100 : 0);
  }, [B]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Retorno &amp; Rentabilidade</h1>
          <div className="status-line">
            {empresaLabel} · ano {refYear} · ROA, ROE, ROS, Giro do Ativo · juros sobre vendas
          </div>
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      {/* Linha 1: KPIs CALCULADOS (ROS + margens) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Indicadores calculados (a partir do DRE caixa)</h2>
        <div className="row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          <CalcKpi name="ROS — Margem Líquida"
            value={calc.ros} unit="%"
            target={5}
            sub={`= Lucro Líq. / Receita · setor: ${BENCH.EBITDA_MARGIN_SETOR || 3.5}%`} />
          <CalcKpi name="Margem EBITDA"
            value={calc.margem_ebitda} unit="%"
            target={BENCH.EBITDA_MARGIN_SETOR || 3.5}
            sub={`vs setor: ${BENCH.EBITDA_MARGIN_SETOR || 3.5}% (Vamos S.A./AgriBiz 2024)`} />
          <CalcKpi name="Margem Bruta"
            value={calc.margem_bruta} unit="%"
            target={20}
            sub="= (Receita − CMV) / Receita" />
          <CalcKpi name="Juros sobre Vendas"
            value={calc.juros_vendas} unit="%"
            target={3}
            lower_is_better={true}
            sub={`Desp.Fin / Receita · ideal ≤ 3%`} />
        </div>

        <div className="row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          <CalcKpi name="Carga Tributária"
            value={calc.carga_trib} unit="%"
            target={15}
            lower_is_better={true}
            sub="Impostos / Receita Líquida" />
          <CalcKpi name="Resultado Fin. Líquido"
            value={calc.res_fin_liq}
            format={(v) => B.fmtK(v)}
            sub={calc.res_fin_liq >= 0 ? "ganhou com aplicações" : "queimou com juros"} />
          <CalcKpi name="Lucro Líquido"
            value={calc.lucro}
            format={(v) => B.fmtK(v)}
            sub="resultado final do exercício" />
          <CalcKpi name="Geração Op. Caixa"
            value={calc.ebitda}
            format={(v) => B.fmtK(v)}
            sub="EBITDA = resultado operacional" />
        </div>
      </div>

      {/* Sparkline da margem líquida ao longo do ano */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title-row" style={{ marginBottom: 10 }}>
          <h2 className="card-title">Evolução da Margem Líquida · {refYear}</h2>
          <div style={{ fontSize: 11, color: "var(--fg-2)" }}>
            média: <b>{margemSerie.length > 0 ? (margemSerie.reduce((s,v) => s+v, 0) / margemSerie.length).toFixed(2).replace(".", ",") : "0"}%</b>
          </div>
        </div>
        {margemSerie.length > 0 ? (
          <div style={{ paddingTop: 8 }}>
            <Sparkline values={margemSerie} width={900} height={120}
              color={calc.ros >= 5 ? "var(--green)" : calc.ros >= 0 ? "var(--cyan)" : "var(--red)"} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--fg-3, var(--fg-2))" }}>
              {(B.MONTHS || []).map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ color: "var(--fg-2)", fontSize: 12, padding: 14 }}>Sem dados mensais no filtro selecionado.</div>
        )}
      </div>

      {/* Indisponíveis (precisa Balanço) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Indicadores que dependem do Balanço Patrimonial</h2>
        <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 12 }}>
          Para ROA, ROE, Giro do Ativo é necessário ter <b>Ativo Total</b> e <b>Patrimônio Líquido</b> mensais —
          dependem da liberação do módulo Contábil ou exportação periódica do BP.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <PlaceholderKpi name="ROA — Retorno sobre o Ativo"
            motivo="Lucro Líquido / Ativo Total"
            benchmark="varia (concessionária 5-10%)" />
          <PlaceholderKpi name="ROE — Retorno sobre PL"
            motivo="Lucro Líquido / Patrimônio Líquido"
            benchmark="≥ 15% (custo de capital)" />
          <PlaceholderKpi name="Giro do Ativo"
            motivo="Receita / Ativo Total"
            benchmark="≥ 1,5x (concessionária)"
            fonte="Farm Equipment Mag" />
          <PlaceholderKpi name="Margem × Giro (DuPont)"
            motivo="ROS × Giro = ROA"
            benchmark="decompõe origem do retorno" />
          <PlaceholderKpi name="ROIC"
            motivo="NOPAT / Capital Investido"
            benchmark="≥ WACC (25%)" />
          <PlaceholderKpi name="Payback (anos)"
            motivo="Capital Investido / FCL anual"
            benchmark="≤ 5 anos" />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// PageBenchmarks — KPIs do BI vs benchmark setorial com desvio + plano de ação
// =============================================================================
// Análise transversal: pega o que o BI calcula HOJE e compara com fontes
// setoriais públicas (Sebrae / FENABRAVE / Farm Equipment Magazine / Vamos S.A.).

const PageBenchmarks = ({ statusFilter, year, month, empresa, drilldown, setDrilldown }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, empresa), [statusFilter, drilldown, year, month, empresa]);
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const empresaLabel = (!empresa || empresa === '0') ? "Consolidado" :
    (window.EMPRESAS && window.EMPRESAS.find(e => e.codigo === empresa) || {}).label || empresa;
  const SUR = (typeof window !== "undefined" && window.SURROGATES) || {};
  const BENCH = SUR.BENCHMARKS || {};

  // KPIs vs benchmarks
  const items = useMemo(() => {
    const receita = B.RECEITA_LIQUIDA || 0;
    const ebitda = B.RESULTADO_OPERACIONAL || 0;
    const lucro = B.LUCRO_LIQUIDO || 0;
    const margem_ebitda = receita > 0 ? (ebitda / receita) * 100 : 0;
    const margem_liquida = receita > 0 ? (lucro / receita) * 100 : 0;
    const margem_bruta = B.MARGEM_BRUTA_PCT || 0;
    const juros_vendas = receita > 0 ? ((B.DESPESA_FIN || 0) / receita) * 100 : 0;
    const concentracaoCP = SUR.CONCENTRACAO_TOP5_FORNECEDOR || 0;
    const concentracaoCR = SUR.CONCENTRACAO_TOP5_CLIENTE || 0;

    return [
      { kpi: "Margem EBITDA",
        atual: margem_ebitda, unit: "%", target: BENCH.EBITDA_MARGIN_SETOR || 3.5, lower_is_better: false,
        fonte: "Vamos S.A. + The AgriBiz · 2024",
        acao: margem_ebitda < (BENCH.EBITDA_MARGIN_SETOR || 3.5)
          ? "Revisar precificação, mix de margem (peças vs máq.) e renegociar fornecedores"
          : "Acima do setor — manter disciplina de custos e expandir mix de peças" },
      { kpi: "Margem Líquida (ROS)",
        atual: margem_liquida, unit: "%", target: 5, lower_is_better: false,
        fonte: "Sebrae 2024 (concessionária máq. agrícola)",
        acao: margem_liquida < 5
          ? "Reduzir despesa financeira ou aumentar margem de contribuição"
          : "Dentro do alvo — direcionar para reinvestimento" },
      { kpi: "Margem Bruta",
        atual: margem_bruta, unit: "%", target: 20, lower_is_better: false,
        fonte: "Mediana setor concessionário",
        acao: margem_bruta < 20
          ? "Aumentar share de peças e serviços (margem 35-40%) sobre máq. (margem 8-12%)"
          : "Boa mistura de peças/máq." },
      { kpi: "Juros sobre Vendas",
        atual: juros_vendas, unit: "%", target: 3, lower_is_better: true,
        fonte: "Limite saudável p/ concessionária Finame",
        acao: juros_vendas > 3
          ? "Renegociar dívida (Finame vs capital de giro), alongar prazo, antecipar recebíveis"
          : "Estrutura financeira saudável" },
      { kpi: "Concentração Top 5 Fornecedores",
        atual: concentracaoCP, unit: "%", target: BENCH.CONCENTRACAO_FORNECEDOR_OK || 70, lower_is_better: true,
        fonte: "Risco operacional · 70% saudável · 85%+ alto",
        acao: concentracaoCP > 85
          ? "URGENTE: diversificar fornecedores ou negociar contrato de longo prazo"
          : concentracaoCP > 70
            ? "Acompanhar — concentração média"
            : "OK · diversificação adequada" },
      { kpi: "Inadimplência (mercado)",
        atual: BENCH.INADIMPLENCIA_AGRO || 8.1, unit: "%", target: 5, lower_is_better: true,
        fonte: "Serasa 2T2025 · agro",
        acao: "Indicador de mercado · usar pra dimensionar provisão de PDD e política de crédito",
        is_market: true },
      { kpi: "Absorção (peças+serviços)",
        atual: null, unit: "%",
        target: BENCH.ABSORCAO_PCT_IDEAL || 73, lower_is_better: false,
        fonte: "Farm Equipment Magazine · WEDA",
        acao: "DADO INDISPONÍVEL · requer separação peças/serviços vs máquinas no DRE",
        unavailable: true },
      { kpi: "Dívida Líq. / EBITDA",
        atual: null, unit: "x",
        target: BENCH.DIVIDA_EBITDA_SETOR || 3.9, lower_is_better: true,
        fonte: "Covenant SLC = 4,0x · AgFeed 2025",
        acao: "DADO INDISPONÍVEL · requer saldo de empréstimos do Balanço",
        unavailable: true },
    ];
  }, [B, BENCH, SUR]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Benchmarks vs Cliente</h1>
          <div className="status-line">
            {empresaLabel} · ano {refYear} · KPIs do BI vs setor com desvio &amp; plano de ação
          </div>
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Resumo · KPIs comparados</h2>
        <div className="t-scroll" style={{ marginTop: 12 }}>
          <table className="t">
            <thead>
              <tr>
                <th>KPI</th>
                <th className="num">Atual</th>
                <th className="num">Alvo</th>
                <th className="num">Desvio</th>
                <th>Status</th>
                <th>Fonte / Plano de ação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const isUnavail = it.unavailable;
                const ok = !isUnavail && it.atual != null && (it.lower_is_better ? it.atual <= it.target : it.atual >= it.target);
                const close = !isUnavail && it.atual != null && (it.lower_is_better ? it.atual <= it.target * 1.15 : it.atual >= it.target * 0.85);
                const tone = isUnavail ? "amber"
                  : it.is_market ? "neutral"
                  : ok ? "green"
                  : close ? "amber"
                  : "red";
                const desvio = isUnavail || it.atual == null ? null
                  : it.target > 0 ? ((it.atual - it.target) / it.target) * 100 : 0;
                const toneColor = tone === "green" ? "var(--green)"
                  : tone === "red" ? "var(--red)"
                  : tone === "amber" ? "#fbbf24"
                  : "var(--cyan)";
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{it.kpi}</td>
                    <td className="num" style={{ color: toneColor, fontFamily: "JetBrains Mono, monospace" }}>
                      {isUnavail || it.atual == null ? "—"
                        : `${it.atual.toFixed(1).replace(".", ",")}${it.unit}`}
                    </td>
                    <td className="num" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                      {it.lower_is_better ? "≤" : "≥"} {Number(it.target).toFixed(1).replace(".", ",")}{it.unit}
                    </td>
                    <td className="num" style={{ color: toneColor, fontFamily: "JetBrains Mono, monospace" }}>
                      {desvio != null ? `${desvio >= 0 ? "+" : ""}${desvio.toFixed(0)}%` : "—"}
                    </td>
                    <td>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        background: tone === "green" ? "rgba(16, 185, 129, 0.15)"
                          : tone === "red" ? "rgba(239, 68, 68, 0.15)"
                          : tone === "amber" ? "rgba(251, 191, 36, 0.15)"
                          : "rgba(34, 211, 238, 0.15)",
                        color: toneColor,
                      }}>
                        {isUnavail ? "indisponível"
                          : it.is_market ? "mercado"
                          : ok ? "ok"
                          : close ? "atenção"
                          : "abaixo"}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--fg-2)" }}>
                      <div>{it.acao}</div>
                      <div style={{ fontSize: 10, color: "var(--fg-3, var(--fg-2))", marginTop: 2 }}>{it.fonte}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tiles agrupados de benchmarks setoriais (referência rápida) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Referências setoriais</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          <BenchmarkTileE label="Margem EBITDA setor" value={`${BENCH.EBITDA_MARGIN_SETOR || 3.5}%`} fonte="Vamos S.A. + The AgriBiz · 2024" />
          <BenchmarkTileE label="Dívida Líq. / EBITDA" value={`${BENCH.DIVIDA_EBITDA_SETOR || 3.9}x`} fonte="Covenant SLC = 4,0x · AgFeed 2025" />
          <BenchmarkTileE label="Absorção ideal" value={`${BENCH.ABSORCAO_PCT_IDEAL || 73}%`} fonte="Farm Equipment Magazine · WEDA" />
          <BenchmarkTileE label="Absorção mínimo OK" value={`${BENCH.ABSORCAO_PCT_OK_MIN || 60}%`} fonte="Farm Equipment Magazine" />
          <BenchmarkTileE label="Absorção top players" value={`${BENCH.ABSORCAO_PCT_TOP || 76.5}%`} fonte="Farm Equipment Magazine" />
          <BenchmarkTileE label="Inadimplência agro" value={`${BENCH.INADIMPLENCIA_AGRO || 8.1}%`} fonte="Serasa 2T2025 · Gazeta do Povo" />
          <BenchmarkTileE label="Concentração saudável" value={`≤ ${BENCH.CONCENTRACAO_FORNECEDOR_OK || 70}%`} fonte="Risco operacional" />
          <BenchmarkTileE label="Concentração risco" value={`≥ ${BENCH.CONCENTRACAO_FORNECEDOR_RISK || 85}%`} fonte="Risco operacional" />
        </div>
      </div>

      {/* Aviso sobre dados indisponíveis */}
      <div className="card" style={{ border: "1px solid rgba(34, 211, 238, 0.2)", background: "rgba(34, 211, 238, 0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Como melhorar essa análise</div>
        <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.6 }}>
          A análise de benchmark fica mais completa com:
          <ul style={{ marginTop: 8, paddingLeft: 16 }}>
            <li><b>Separação peças/serviços vs máquinas</b> no faturamento — habilita Absorção (73% ideal)</li>
            <li><b>Saldo de empréstimos</b> mensal (Balanço Patrimonial) — habilita Dívida Líq./EBITDA, ROIC</li>
            <li><b>Estoque + Contas a Receber</b> mensal — habilita PME, PMR, ciclo financeiro</li>
            <li><b>Patrimônio Líquido</b> — habilita ROE, alavancagem patrimonial</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================
Object.assign(window, {
  PageEstoque,
  PagePontoEquilibrio,
  PageRentabilidade,
  PageBenchmarks,
});
