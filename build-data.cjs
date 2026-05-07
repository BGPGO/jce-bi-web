#!/usr/bin/env node
/**
 * build-data.cjs — JCE / GlobalMac (v1.7 — full ledger + cross-filter)
 *
 * Lê:
 *   - data/bi_data.json         — DRE estruturada (agregada)
 *   - data/all_tx.json          — 48k lançamentos compactos pra cross-filter
 *   - data/saldos_razao.json    — saldos caixa/banco por filial
 *
 * Schema window.BIT (compatível template):
 *   - ALL_TX populado [kind, ymonth, dia, categoria, cliente, valor, realizado, fornecedor, cc, empresa, sint_codigo]
 *   - filterTx (statusFilter, drilldown, empresa) → filtra
 *   - aggregateTx (txList, year, month) → recomputa
 *   - getBit (statusFilter, drilldown, year, month, empresa) → BIT-like
 *   - SEPARA: MARGEM_EBITDA (resultado_op/rec_liq) e MARGEM_LIQUIDA (lucro_liq/rec_liq)
 *   - VALOR_LIQUIDO = lucro_liquido (não EBITDA)
 *   - EBITDA = resultado_op
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const cfg = require('./bi.config.js');
const BI_DATA_PATH = path.join(__dirname, 'data', 'bi_data.json');
const ALL_TX_PATH  = path.join(__dirname, 'data', 'all_tx.json');
const SALDOS_PATH  = path.join(__dirname, 'data', 'saldos_razao.json');
const ENDIV_PATH   = path.join(__dirname, 'data', 'endividamento.json');
const RECEITA_LINHA_PATH = path.join(__dirname, 'data', 'receita_por_linha.json');
const BALANCETE_PATH = path.join(__dirname, 'data', 'balancete_oficial.json');
const CR_CP_PATH   = path.join(__dirname, 'data', 'cr_cp.json');
const OUT_FILE     = path.join(__dirname, 'data.js');

const MONTHS      = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MONTHS_FULL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

console.log('=== build-data JCE v1.7 (full ledger + cross-filter) ===');
const bi = JSON.parse(fs.readFileSync(BI_DATA_PATH, 'utf8'));
const ALL_TX_RAW = JSON.parse(fs.readFileSync(ALL_TX_PATH, 'utf8'));

// Filtra MÚTUOS / INTERCOMPANY: categoria contém "MUTUO" OU cliente/fornecedor
// é nome de outra empresa do grupo. Inflam receita+despesa em ~R$ 67M cada lado
// sem ser atividade econômica real (transferência entre CNPJs do mesmo grupo).
const NOMES_GRUPO = ['GLOBAL MAC', 'GLOBALMAC', 'DC TRACTOR', 'DCTRACTOR',
                     'DC COMERCIO', 'DCCOMERCIO', 'DC MAQUINAS', 'DC MAQ', 'GLOBALVALE'];
function isMutuoOuIntercompany(r) {
  const cat = (r[3] || '').toUpperCase();
  if (cat.includes('MUTUO') || cat.includes('MÚTUO')) return true;
  const cli = (r[4] || '').toUpperCase();
  const forn = (r[7] || '').toUpperCase();
  for (const n of NOMES_GRUPO) {
    if (cli.includes(n) || forn.includes(n)) return true;
  }
  return false;
}
const ALL_TX_REALIZADO = ALL_TX_RAW.filter(r => !isMutuoOuIntercompany(r));
const removidosMutuos = ALL_TX_RAW.length - ALL_TX_REALIZADO.length;
console.log(`  ALL_TX_RAW: ${ALL_TX_RAW.length.toLocaleString()} · removidos mútuos+intercompany: ${removidosMutuos.toLocaleString()} · líquido: ${ALL_TX_REALIZADO.length.toLocaleString()}`);
const SALDOS = fs.existsSync(SALDOS_PATH) ? JSON.parse(fs.readFileSync(SALDOS_PATH, 'utf8')) : { contas: [], totais_por_empresa: {} };
const ENDIVIDAMENTO = fs.existsSync(ENDIV_PATH) ? JSON.parse(fs.readFileSync(ENDIV_PATH, 'utf8')) : null;

const RECEITA_LINHA = fs.existsSync(RECEITA_LINHA_PATH) ? JSON.parse(fs.readFileSync(RECEITA_LINHA_PATH, 'utf8')) : null;
const BALANCETE = fs.existsSync(BALANCETE_PATH) ? JSON.parse(fs.readFileSync(BALANCETE_PATH, 'utf8')) : null;
const CR_CP = fs.existsSync(CR_CP_PATH) ? JSON.parse(fs.readFileSync(CR_CP_PATH, 'utf8')) : null;

// ALL_TX_PENDENTE: converte cr_cp.json em tuples ALL_TX-compatible com realizado=0.
// Permite filtro statusFilter='a_pagar_receber' agregar pelas mesmas funções (filterTx/aggregateTx).
const ALL_TX_PENDENTE = [];
if (CR_CP && CR_CP.por_empresa) {
  const vencToYmonth = (s) => {
    if (!s || !s.includes('/')) return null;
    const [d, m, y] = s.split('/');
    if (!y || y.length !== 4) return null;
    return { ymonth: `${y}-${m}`, dia: parseInt(d, 10) || 1 };
  };
  const isMutuoCrCp = (cli) => {
    const c = (cli || '').toUpperCase();
    return NOMES_GRUPO.some(n => c.includes(n));
  };
  for (const emp of Object.keys(CR_CP.por_empresa)) {
    const empData = CR_CP.por_empresa[emp];
    for (const t of (empData.a_receber || [])) {
      if (isMutuoCrCp(t.cliente)) continue;  // skip intercompany
      const dv = vencToYmonth(t.vencimento);
      if (!dv) continue;
      const cat = (t.dias_atraso > 0 ? `Vencido ${t.dias_atraso}d` : 'A vencer');
      ALL_TX_PENDENTE.push(['r', dv.ymonth, dv.dia, cat, t.cliente || '', t.valor || 0, 0, '', t.centro_custo || '', String(emp), '', '']);
    }
    for (const t of (empData.a_pagar || [])) {
      if (isMutuoCrCp(t.cliente)) continue;
      const dv = vencToYmonth(t.vencimento);
      if (!dv) continue;
      const cat = (t.dias_atraso > 0 ? `Vencido ${t.dias_atraso}d` : 'A vencer');
      ALL_TX_PENDENTE.push(['d', dv.ymonth, dv.dia, cat, '', t.valor || 0, 0, t.cliente || '', t.centro_custo || '', String(emp), '', '']);
    }
  }
}
const ALL_TX = ALL_TX_REALIZADO.concat(ALL_TX_PENDENTE);
console.log(`  ALL_TX_PENDENTE (cr_cp): ${ALL_TX_PENDENTE.length.toLocaleString()} títulos`);
console.log(`  ALL_TX total: ${ALL_TX.length.toLocaleString()} (realizado + pendente)`);

console.log(`  bi_data.json: ${(fs.statSync(BI_DATA_PATH).size/1024).toFixed(1)} KB`);
console.log(`  all_tx.json: ${(fs.statSync(ALL_TX_PATH).size/1024/1024).toFixed(1)} MB (${ALL_TX.length.toLocaleString()} rows)`);
console.log(`  saldos: ${SALDOS.contas?.length || 0} contas`);
console.log(`  endividamento: ${ENDIVIDAMENTO ? ENDIVIDAMENTO.por_banco_consolidado.length + ' bancos · R$ ' + ENDIVIDAMENTO.totais_consolidados.divida_banco.toLocaleString('pt-BR') : 'INDISPONÍVEL'}`);
console.log(`  receita_por_linha: ${RECEITA_LINHA ? 'R$ ' + RECEITA_LINHA.meta.total_receita_bruta.toLocaleString('pt-BR') + ' (' + RECEITA_LINHA.meta.lctos_processados + ' lctos)' : 'INDISPONÍVEL — rode parse-receita-linha.py'}`);
console.log(`  balancete: ${BALANCETE ? Object.keys(BALANCETE).join(', ') + ' (jan-fev 2026)' : 'INDISPONÍVEL — rode parse-balancete-pdf.py'}`);
console.log(`  cr_cp: ${CR_CP ? 'A receber R$ ' + CR_CP.consolidado.a_receber_total.toLocaleString('pt-BR') + ' · A pagar R$ ' + CR_CP.consolidado.a_pagar_total.toLocaleString('pt-BR') : 'INDISPONÍVEL — rode 80_consulta_titulos_multi_empresa.py'}`);
console.log(`  ano ref: ${bi.ref_year} | empresas: ${bi.empresas.length}`);

// =============================================================================
// INDICADORES CONTABEIS — calculados a partir de data/balancete_oficial.json
// (jan-fev 2026 — fechamento parcial do contador). Anualizamos lucro/receita
// usando o periodo conhecido (2 meses) e benchmarks setoriais.
// =============================================================================
const EMPRESA_BAL_MAP = {
  '1':         'GLOBALMAC',
  'GLOBALMAC': 'GLOBALMAC',
  '2':         'DC_TRACTOR',
  'DCTRACTOR': 'DC_TRACTOR',
  '4':         null,  // DC COMERCIO — sem balancete oficial
  'DCCOMERCIO':null,
};

function computeIndicadoresContabeis(bal) {
  if (!bal) return null;
  const ac = bal.ativo_circulante;
  const anc = bal.ativo_nao_circulante;
  const at = bal.ativo_total;
  const pc = bal.passivo_circulante;
  const pnc = bal.passivo_nao_circulante;
  const pl = bal.patrimonio_liquido;
  const disponivel = bal.disponivel;
  const estoques = bal.estoques;
  const realizavel_lp = bal.realizavel_lp || 0;
  const imob = bal.imobilizado_liquido;
  const empfin_pc = bal.emprestimos_financiamentos_pc;
  const empfin_pnc = bal.emprestimos_financiamentos_pnc;
  const fornec = bal.fornecedores;

  // DRE periodo (2 meses jan-fev 2026)
  const rec_liq_periodo = bal.receita_liquida;
  const rec_bruta_periodo = bal.receita_bruta;
  const lucro_periodo = bal.lucro_periodo;
  const lucro_bruto = bal.lucro_bruto;
  const desp_op = bal.despesas_operacionais;
  const cmv = bal.cmv;
  // EBITDA proxy = lucro_op = lucro_bruto - desp_op (sem incluir financeiro/IR e sem add-back D&A)
  // Conservador, mas o melhor que conseguimos sem nota de depreciacao do periodo
  const ebitda_periodo = lucro_bruto - desp_op;

  // Anualizar (jan-fev = 2 meses; ano fiscal = 12 meses; fator 6)
  const FATOR = 6;
  const lucro_anual = lucro_periodo * FATOR;
  const rec_anual = rec_liq_periodo * FATOR;
  const ebitda_anual = ebitda_periodo * FATOR;

  // Liquidez
  const liq_corrente = pc > 0 ? ac / pc : null;
  const liq_geral    = (pc + pnc) > 0 ? (ac + realizavel_lp) / (pc + pnc) : null;
  const liq_imediata = pc > 0 ? disponivel / pc : null;
  const liq_seca     = pc > 0 ? (ac - estoques) / pc : null;

  // Estrutura
  const cap_proprio_pct = at > 0 ? (pl / at) * 100 : null;
  const cap_terceiros_pct = at > 0 ? ((pc + pnc) / at) * 100 : null;
  const imob_ativo_pct = at > 0 ? (imob / at) * 100 : null;

  // Endividamento
  const divida_total = empfin_pc + empfin_pnc;
  const divida_liquida = divida_total - disponivel;
  const div_ebitda = ebitda_anual > 0 ? divida_liquida / ebitda_anual : null;
  const endiv_oneroso_pct = (divida_total + pl) > 0 ? (divida_total / (divida_total + pl)) * 100 : null;

  // Rentabilidade (anualizado)
  const roe_pct = pl > 0 ? (lucro_anual / pl) * 100 : null;
  const roa_pct = at > 0 ? (lucro_anual / at) * 100 : null;
  const ros_pct = rec_anual > 0 ? (lucro_anual / rec_anual) * 100 : null;
  const giro_ativo = at > 0 ? rec_anual / at : null;

  // Ciclo (proxy — usa saldo final, nao media; PMR e PMP usam DRE jan-fev)
  // PMR = (Clientes / Receita Bruta) * dias_periodo
  const dias_periodo = 59;  // jan-fev 2026 (31+28)
  const pmr = rec_bruta_periodo > 0 ? (bal.clientes / rec_bruta_periodo) * dias_periodo : null;
  // PMP = (Fornecedores / CMV) * dias_periodo (proxy — usa CMV em vez de compras)
  const pmp = cmv > 0 ? (fornec / cmv) * dias_periodo : null;
  // PME = (Estoques / CMV) * dias_periodo
  const pme = cmv > 0 ? (estoques / cmv) * dias_periodo : null;
  const ciclo_op = (pmr || 0) + (pme || 0);
  const ciclo_fin = ciclo_op - (pmp || 0);

  // NCG = Ativo Circulante Operacional - Passivo Circulante Operacional
  // ACO = AC - Disponivel - Aplic. Liq. Imediata (so disponivel ja exclui)
  // PCO = PC - Emprestimos PC - Duplicatas Descontadas (financeiros)
  const aco = ac - disponivel;
  const pco = pc - empfin_pc - (bal.duplicatas_descontadas || 0);
  const ncg = aco - pco;

  // Giro do estoque (anualizado)
  const cmv_anual = cmv * FATOR;
  const giro_estoque = estoques > 0 ? cmv_anual / estoques : null;

  return {
    periodo: bal.periodo,
    // Saldos brutos pra tooltip
    raw: {
      ativo_total: at, ativo_circulante: ac, ativo_nao_circulante: anc,
      passivo_circulante: pc, passivo_nao_circulante: pnc, patrimonio_liquido: pl,
      disponivel, estoques, clientes: bal.clientes,
      imobilizado: imob, fornecedores: fornec,
      emprestimos_pc: empfin_pc, emprestimos_pnc: empfin_pnc,
      divida_total, divida_liquida,
      receita_bruta_periodo: rec_bruta_periodo, receita_liquida_periodo: rec_liq_periodo,
      receita_anual_estimada: rec_anual,
      lucro_periodo, lucro_anual_estimado: lucro_anual,
      ebitda_periodo, ebitda_anual_estimado: ebitda_anual,
      cmv_periodo: cmv, cmv_anual_estimado: cmv_anual,
    },
    liquidez: {
      corrente: liq_corrente, geral: liq_geral, imediata: liq_imediata, seca: liq_seca,
    },
    estrutura: {
      capital_proprio_pct: cap_proprio_pct,
      capital_terceiros_pct: cap_terceiros_pct,
      imobilizado_ativo_pct: imob_ativo_pct,
    },
    endividamento: {
      divida_total, divida_liquida,
      divida_ebitda: div_ebitda,
      endividamento_oneroso_pct: endiv_oneroso_pct,
    },
    rentabilidade: {
      roe_pct, roa_pct, ros_pct, giro_ativo,
    },
    ciclo: {
      pmr_dias: pmr, pmp_dias: pmp, pme_dias: pme,
      ciclo_operacional: ciclo_op, ciclo_financeiro: ciclo_fin,
      ncg, giro_estoque,
    },
  };
}

const INDICADORES_CONTABEIS = {};
if (BALANCETE) {
  for (const [empCode, balKey] of Object.entries(EMPRESA_BAL_MAP)) {
    if (!balKey) continue;
    if (!BALANCETE[balKey]) continue;
    INDICADORES_CONTABEIS[empCode] = computeIndicadoresContabeis(BALANCETE[balKey]);
  }
  // Alias por label tambem
  if (BALANCETE.GLOBALMAC) INDICADORES_CONTABEIS.GLOBALMAC = INDICADORES_CONTABEIS.GLOBALMAC || INDICADORES_CONTABEIS['1'];
  if (BALANCETE.DC_TRACTOR) INDICADORES_CONTABEIS.DCTRACTOR = INDICADORES_CONTABEIS.DCTRACTOR || INDICADORES_CONTABEIS['2'];

  // Consolidado (soma das que tem balancete: GLOBALMAC + DC_TRACTOR; DC COMERCIO sem balancete)
  const balsArr = ['GLOBALMAC','DC_TRACTOR'].filter(k => BALANCETE[k]).map(k => BALANCETE[k]);
  if (balsArr.length) {
    const sumBal = {};
    const numFields = ['ativo_circulante','ativo_nao_circulante','ativo_total','passivo_circulante','passivo_nao_circulante','patrimonio_liquido','disponivel','clientes','estoques','realizavel_lp','imobilizado_liquido','emprestimos_financiamentos_pc','emprestimos_financiamentos_pnc','fornecedores','duplicatas_descontadas','receita_bruta','receita_liquida','lucro_bruto','despesas_operacionais','cmv','lucro_periodo'];
    for (const f of numFields) sumBal[f] = balsArr.reduce((s,b)=>s + (b[f]||0), 0);
    sumBal.periodo = balsArr[0].periodo;
    INDICADORES_CONTABEIS['0']  = computeIndicadoresContabeis(sumBal);
    INDICADORES_CONTABEIS.all   = INDICADORES_CONTABEIS['0'];
    INDICADORES_CONTABEIS.consolidado = INDICADORES_CONTABEIS['0'];
    INDICADORES_CONTABEIS._cobertura = balsArr.length + ' de ' + bi.empresas.length + ' empresas';
  }
}

console.log(`\n  Indicadores Contabeis calculados: ${Object.keys(INDICADORES_CONTABEIS).filter(k => !k.startsWith('_')).join(', ')}`);
if (INDICADORES_CONTABEIS.GLOBALMAC) {
  const g = INDICADORES_CONTABEIS.GLOBALMAC;
  console.log(`    [GLOBALMAC]  Liq Corr: ${g.liquidez.corrente.toFixed(2)}  ROE: ${g.rentabilidade.roe_pct.toFixed(1)}%  Div/EBITDA: ${g.endividamento.divida_ebitda ? g.endividamento.divida_ebitda.toFixed(1)+'x' : 'n/a'}`);
}
if (INDICADORES_CONTABEIS.DCTRACTOR) {
  const g = INDICADORES_CONTABEIS.DCTRACTOR;
  console.log(`    [DC TRACTOR] Liq Corr: ${g.liquidez.corrente.toFixed(2)}  ROE: ${g.rentabilidade.roe_pct.toFixed(1)}%  Div/EBITDA: ${g.endividamento.divida_ebitda ? g.endividamento.divida_ebitda.toFixed(1)+'x' : 'n/a'}`);
}

const REF_YEAR = bi.ref_year;
const AVAILABLE_YEARS = bi.available_years;
const EMPRESAS = bi.empresas;

// ---- DRE consolidada (do bi_data.json) ----
console.log(`\n  Consolidado (16 meses, 3 empresas):`);
const total = bi.dre_consolidado;
console.log(`    Receita Bruta:    R$ ${total.receita_bruta.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`    Receita Líquida:  R$ ${total.receita_liquida.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`    CMV:              R$ ${total.cmv.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`    Despesa Op:       R$ ${total.despesa_op.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`    EBITDA:           R$ ${total.resultado_op.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (margem ${total.margem_ebitda_caixa.toFixed(2)}%)`);
console.log(`    Lucro Líquido:    R$ ${total.lucro_liquido.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (margem ${total.margem_liquida.toFixed(2)}%)`);

const meta = {
  empresa: {
    nome_fantasia: cfg.cliente.nome_curto,
    razao_social: cfg.cliente.nome,
    cnpj: '16.619.634/0001-67',
    cidade: 'Pelotas-MT · Passo Fundo · Barra · Porto · Canguçu',
  },
  fetched_at: bi.fetched_at,
  ref_year: REF_YEAR,
  empresas: EMPRESAS,
  source: 'ERP Solution / Razão Contábil completo · 170k lançamentos · jan/2025-mai/2026',
  counts: { lancamentos_total: ALL_TX.length },
};

const SURROGATES = {
  TOP_FORNECEDORES: bi.top_fornecedores.map(f => ({ nome: f.cliente, valor: f.valor, pct: 0 })),
  TOP_CLIENTES:    bi.top_clientes.map(c => ({ nome: c.cliente, valor: c.valor, pct: 0 })),
  CONCENTRACAO_TOP5_FORNECEDOR: 0,
  CONCENTRACAO_TOP5_CLIENTE: 0,
  BENCHMARKS: {
    EBITDA_MARGIN_SETOR: 3.5, DIVIDA_EBITDA_SETOR: 3.9,
    ABSORCAO_PCT_IDEAL: 73, ABSORCAO_PCT_OK_MIN: 60, ABSORCAO_PCT_TOP: 76.5,
    INADIMPLENCIA_AGRO: 8.1,
    CONCENTRACAO_FORNECEDOR_OK: 70, CONCENTRACAO_FORNECEDOR_RISK: 85,
  },
};
const totalForn = SURROGATES.TOP_FORNECEDORES.reduce((s,f)=>s+f.valor,0);
SURROGATES.CONCENTRACAO_TOP5_FORNECEDOR = totalForn ? (SURROGATES.TOP_FORNECEDORES.slice(0,5).reduce((s,f)=>s+f.valor,0) / totalForn) * 100 : 0;
SURROGATES.TOP_FORNECEDORES.forEach(f => f.pct = totalForn ? (f.valor/totalForn)*100 : 0);
const totalCli = SURROGATES.TOP_CLIENTES.reduce((s,c)=>s+c.valor,0);
SURROGATES.CONCENTRACAO_TOP5_CLIENTE = totalCli ? (SURROGATES.TOP_CLIENTES.slice(0,5).reduce((s,c)=>s+c.valor,0) / totalCli) * 100 : 0;
SURROGATES.TOP_CLIENTES.forEach(c => c.pct = totalCli ? (c.valor/totalCli)*100 : 0);

// ====== escrever data.js ======
const DATA_JS = `/* JCE BI v1.7 — gerado por build-data.cjs em ${new Date().toISOString()} */
/* Fonte: ERP Solution Razão Contábil completo. ${meta.counts.lancamentos_total} lançamentos. */
const MONTHS = ${JSON.stringify(MONTHS)};
const MONTHS_FULL = ${JSON.stringify(MONTHS_FULL)};

function fmt(n, opts = {}) {
  const { dec = 2, prefix = "R$", showSign = false } = opts;
  const sign = n < 0 ? "-" : (showSign ? "+" : "");
  const abs = Math.abs(n);
  const parts = abs.toFixed(dec).split(".");
  parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
  return \`\${sign}\${prefix}\${parts.join(",")}\`;
}
function fmtK(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return \`\${sign}R$\${(abs / 1e6).toFixed(2).replace(".", ",")} M\`;
  if (abs >= 1e3) return \`\${sign}R$\${(abs / 1e3).toFixed(2).replace(".", ",")} K\`;
  return \`\${sign}R$\${abs.toFixed(0)}\`;
}
function fmtPct(n, dec = 2) {
  const sign = n > 0 ? "+" : (n < 0 ? "-" : "");
  return \`\${sign}\${Math.abs(n).toFixed(dec).replace(".", ",")}%\`;
}

const META = ${JSON.stringify(meta, null, 2)};
const REF_YEAR = ${REF_YEAR};
const AVAILABLE_YEARS = ${JSON.stringify(AVAILABLE_YEARS)};
const EMPRESAS = ${JSON.stringify(EMPRESAS)};
const SURROGATES = ${JSON.stringify(SURROGATES, null, 2)};
const SALDOS = ${JSON.stringify(SALDOS, null, 2)};
const ENDIVIDAMENTO = ${JSON.stringify(ENDIVIDAMENTO)};
const RECEITA_LINHA = ${JSON.stringify(RECEITA_LINHA)};
const INDICADORES_CONTABEIS = ${JSON.stringify(INDICADORES_CONTABEIS)};
const CR_CP = ${JSON.stringify(CR_CP)};
const BI_DATA = ${JSON.stringify(bi)};
const ALL_TX = ${JSON.stringify(ALL_TX)};

// ====== filterTx: aplica statusFilter + drilldown + empresa + year/month ======
function filterTx(allTx, statusFilter, drilldown, empresa, year, month) {
  let out = allTx;
  // statusFilter:
  //   'realizado'        → realizado=1 (Razão Caixa: pagamentos/recebimentos efetivos)
  //   'a_pagar_receber'  → realizado=0 (CR/CP pendentes do 7093)
  //   'tudo'             → ambos
  if (statusFilter === 'realizado') out = out.filter(r => r[6] === 1);
  else if (statusFilter === 'a_pagar_receber') out = out.filter(r => r[6] === 0);
  // empresa
  if (empresa && empresa !== '0' && empresa !== 'all') {
    out = out.filter(r => r[9] === empresa);
  }
  // year (0 = todos)
  if (year && year > 0) {
    const yPrefix = String(year);
    out = out.filter(r => r[1] && r[1].slice(0,4) === yPrefix);
  }
  // month (0 = ano todo)
  if (month && month >= 1 && month <= 12) {
    const mm = String(month).padStart(2, '0');
    out = out.filter(r => r[1] && r[1].slice(5,7) === mm);
  }
  // drilldown
  if (drilldown) {
    if (drilldown.type === 'mes')        out = out.filter(r => r[1] === drilldown.value);
    else if (drilldown.type === 'categoria') out = out.filter(r => r[3] === drilldown.value);
    else if (drilldown.type === 'cliente')   out = out.filter(r => r[0] === 'r' && r[4] === drilldown.value);
    else if (drilldown.type === 'fornecedor')out = out.filter(r => r[0] === 'd' && r[7] === drilldown.value);
  }
  return out;
}

// ====== aggregateTx: monta MONTH_DATA / KPIs / TOPs do array filtrado ======
function aggregateTx(txList, year, month) {
  const months = MONTHS_FULL.map(m => ({ m, receita: 0, despesa: 0 }));
  const recCat = new Map(), despCat = new Map(), recCli = new Map(), despForn = new Map();
  const extratoArr = [], extratoRecArr = [], extratoDespArr = [];
  let totalRec = 0, totalDesp = 0;
  for (const row of txList) {
    const [kind, ym, dia, cat, cli, valor, realizado, forn, cc, emp, sint] = row;
    if (!ym) continue;
    const mIdx = parseInt(ym.slice(5,7), 10) - 1;
    if (mIdx < 0 || mIdx > 11) continue;
    if (kind === 'r') {
      months[mIdx].receita += valor;
      totalRec += valor;
      recCat.set(cat, (recCat.get(cat) || 0) + valor);
      if (cli) recCli.set(cli, (recCli.get(cli) || 0) + valor);
    } else {
      months[mIdx].despesa += valor;
      totalDesp += valor;
      despCat.set(cat, (despCat.get(cat) || 0) + valor);
      if (forn) despForn.set(forn, (despForn.get(forn) || 0) + valor);
    }
    const dataStr = String(dia).padStart(2,'0') + '/' + ym.slice(5,7) + '/' + ym.slice(0,4);
    const extRow = [dataStr, cc || 'Operações', cat, kind === 'r' ? cli : forn, kind === 'r' ? valor : -valor, realizado ? 'PAGO' : ''];
    extratoArr.push(extRow);
    if (kind === 'r') extratoRecArr.push(extRow); else extratoDespArr.push(extRow);
  }
  const sortByDateDesc = (a, b) => {
    const [da,ma,ya] = a[0].split('/').map(Number);
    const [db,mb,yb] = b[0].split('/').map(Number);
    return new Date(yb,mb-1,db) - new Date(ya,ma-1,da);
  };
  extratoArr.sort(sortByDateDesc); extratoRecArr.sort(sortByDateDesc); extratoDespArr.sort(sortByDateDesc);
  const topN = (mp, n) => Array.from(mp.entries()).map(([name,value]) => ({name,value})).sort((a,b)=>b.value-a.value).slice(0,n);
  const VALOR_LIQUIDO = totalRec - totalDesp;
  const MARGEM = totalRec > 0 ? (VALOR_LIQUIDO / totalRec) * 100 : 0;
  return {
    MONTH_DATA: months,
    RECEITA_CATEGORIAS: topN(recCat, 12),
    DESPESA_CATEGORIAS: topN(despCat, 12),
    RECEITA_CLIENTES: topN(recCli, 12),
    DESPESA_FORNECEDORES: topN(despForn, 12),
    EXTRATO: extratoArr.slice(0, 200),
    EXTRATO_RECEITAS: extratoRecArr.slice(0, 200),
    EXTRATO_DESPESAS: extratoDespArr.slice(0, 200),
    KPIS: {
      TOTAL_RECEITA: totalRec, TOTAL_DESPESA: totalDesp,
      VALOR_LIQUIDO, MARGEM_LIQUIDA: MARGEM, MARGEM_EBITDA: MARGEM,
      VALOR_LIQ_SERIES: months.map(m => m.receita - m.despesa),
    },
    RECDESP_AREA: months.map(m => ({ m: m.m.slice(0,3), receita: m.receita, despesa: m.despesa })),
  };
}

// ====== DRE estruturada via bi_data.month_totals (regime competência) ======
function aggregateDre(empresa, year, month) {
  const tots = (BI_DATA.month_totals || []).filter(m => {
    if (empresa && empresa !== '0' && String(m.empresa) !== String(empresa)) return false;
    if (year && year > 0 && !String(m.ano_mes).startsWith(String(year))) return false;
    if (month && month >= 1 && month <= 12) {
      const mm = String(month).padStart(2, '0');
      if (!String(m.ano_mes).endsWith('-' + mm)) return false;
    }
    return true;
  });
  const dre = { receita_bruta:0, deducoes:0, cmv:0, despesa_op:0, receita_fin:0, despesa_fin:0, provisao_ir:0, n_lctos:0 };
  for (const t of tots) {
    dre.receita_bruta += t.receita_bruta || 0;
    dre.deducoes += t.deducoes || 0;
    dre.cmv += t.cmv || 0;
    dre.despesa_op += t.despesa_op || 0;
    dre.receita_fin += t.receita_fin || 0;
    dre.despesa_fin += t.despesa_fin || 0;
    dre.provisao_ir += t.provisao_ir || 0;
    dre.n_lctos += t.n_lctos || 0;
  }
  dre.receita_liquida = dre.receita_bruta - dre.deducoes;
  dre.margem_bruta = dre.receita_liquida - dre.cmv;
  dre.resultado_op = dre.margem_bruta - dre.despesa_op;
  dre.resultado_fin = dre.receita_fin - dre.despesa_fin;
  dre.lucro_liquido = dre.resultado_op + dre.resultado_fin - dre.provisao_ir;
  dre.margem_liquida = dre.receita_liquida > 0 ? (dre.lucro_liquido / dre.receita_liquida) * 100 : 0;
  dre.margem_ebitda = dre.receita_liquida > 0 ? (dre.resultado_op / dre.receita_liquida) * 100 : 0;
  dre.margem_bruta_pct = dre.receita_liquida > 0 ? (dre.margem_bruta / dre.receita_liquida) * 100 : 0;
  return dre;
}

// FLUXO_RECEITA / FLUXO_DESPESA mensais REAIS (não média anual replicada)
function fluxoMensal(empresa, year, kind) {
  // groupBy categoria a partir de ALL_TX filtrado por kind+empresa+year
  let txs = ALL_TX.filter(r => r[0] === kind);
  if (empresa && empresa !== '0') txs = txs.filter(r => r[9] === empresa);
  if (year && year > 0) txs = txs.filter(r => r[1] && r[1].slice(0,4) === String(year));
  // agrega por categoria
  const catMap = new Map();
  for (const r of txs) {
    if (!catMap.has(r[3])) catMap.set(r[3], { total: 0, monthly: Array(12).fill(0) });
    const o = catMap.get(r[3]);
    o.total += r[5];
    const mIdx = parseInt(r[1].slice(5,7), 10) - 1;
    if (mIdx >= 0 && mIdx < 12) o.monthly[mIdx] += r[5];
  }
  const top5 = Array.from(catMap.entries()).sort((a,b) => b[1].total - a[1].total).slice(0,5);
  const sign = kind === 'r' ? 1 : -1;
  return top5.map(([cat, o]) => ({ cat, values: o.monthly.map(v => sign * v) }));
}

window.BI_DATA = BI_DATA;
window.BIT_META = META;
window.REF_YEAR = REF_YEAR;
window.AVAILABLE_YEARS = AVAILABLE_YEARS;
window.EMPRESAS = EMPRESAS;
window.BIT_PAGES = ${JSON.stringify(cfg.pages)};
window.SURROGATES = SURROGATES;
window.SALDOS = SALDOS;
window.ENDIVIDAMENTO = ENDIVIDAMENTO;
window.RECEITA_LINHA = RECEITA_LINHA;
window.INDICADORES_CONTABEIS = INDICADORES_CONTABEIS;
window.CR_CP = CR_CP;
window.ALL_TX = ALL_TX;

// Helper: pega visão CR/CP filtrada por empresa.
// Retorna { totais, aging_receber, aging_pagar, top_clientes, top_fornecedores, a_receber[], a_pagar[] }
window.getCrCp = function(empresa) {
  if (!CR_CP || !CR_CP.por_empresa) return null;
  const empKey = empresa && empresa !== '0' && empresa !== 'all' ? String(empresa) : null;
  if (empKey) {
    const e = CR_CP.por_empresa[empKey];
    if (!e) return null;
    return {
      label: e.label,
      totais: e.totais,
      aging_receber: e.aging_receber,
      aging_pagar: e.aging_pagar,
      top_clientes: e.top_clientes_receber,
      top_fornecedores: e.top_fornecedores_pagar,
      a_receber: e.a_receber,
      a_pagar: e.a_pagar,
      fetched_at: CR_CP.fetched_at,
      escopo: 'empresa',
    };
  }
  // Consolidado: mantém os totais agregados, mas para os tops/listas precisamos juntar
  const all_rec = [];
  const all_pag = [];
  const top_cli = new Map();
  const top_forn = new Map();
  for (const k in CR_CP.por_empresa) {
    const e = CR_CP.por_empresa[k];
    for (const r of (e.a_receber || [])) {
      all_rec.push({ ...r, empresa: e.label });
      const n = r.cliente || '?';
      const t = top_cli.get(n) || { nome: n, valor: 0, n: 0, vencido: 0, a_vencer: 0, max_atraso: 0 };
      t.valor += r.valor;
      t.n += 1;
      if (r.dias_atraso > 0) { t.vencido += r.valor; if (r.dias_atraso > t.max_atraso) t.max_atraso = r.dias_atraso; }
      else t.a_vencer += r.valor;
      top_cli.set(n, t);
    }
    for (const r of (e.a_pagar || [])) {
      all_pag.push({ ...r, empresa: e.label });
      const n = r.fornecedor || '?';
      const t = top_forn.get(n) || { nome: n, valor: 0, n: 0, vencido: 0, a_vencer: 0, max_atraso: 0 };
      t.valor += r.valor;
      t.n += 1;
      if (r.dias_atraso > 0) { t.vencido += r.valor; if (r.dias_atraso > t.max_atraso) t.max_atraso = r.dias_atraso; }
      else t.a_vencer += r.valor;
      top_forn.set(n, t);
    }
  }
  all_rec.sort((a, b) => b.valor - a.valor);
  all_pag.sort((a, b) => b.valor - a.valor);
  const tops_cli = [...top_cli.values()].sort((a, b) => b.valor - a.valor);
  const tops_forn = [...top_forn.values()].sort((a, b) => b.valor - a.valor);
  return {
    label: 'Consolidado',
    totais: CR_CP.consolidado,
    aging_receber: CR_CP.consolidado.aging_receber,
    aging_pagar: CR_CP.consolidado.aging_pagar,
    top_clientes: tops_cli.slice(0, 30),
    top_fornecedores: tops_forn.slice(0, 30),
    a_receber: all_rec,
    a_pagar: all_pag,
    fetched_at: CR_CP.fetched_at,
    escopo: 'consolidado',
  };
};
window.aggregateTx = aggregateTx;
window.filterTx = filterTx;

function _makeBit(statusFilter, empresa, year, month, drilldown) {
  const filtered = filterTx(ALL_TX, statusFilter, drilldown, empresa, year, month);
  const agg = aggregateTx(filtered, year, month);
  const dre = aggregateDre(empresa, year, month);
  // **REGRA**: telas padrão são REGIME CAIXA. KPIs lêem aggregateTx (mesma fonte
  // das barras). Cards e barras somam pela mesma régua.
  // KPIs DRE/Competência (CMV, EBITDA, Margem Líquida) ficam SOMENTE em
  // PageIndicadoresContabeis via window.INDICADORES_CONTABEIS.
  const ck = agg.KPIS;
  const saldoFluxoCaixa = ck.TOTAL_RECEITA - ck.TOTAL_DESPESA;  // entradas − saídas (caixa)
  const margemFluxo = ck.TOTAL_RECEITA > 0 ? (saldoFluxoCaixa / ck.TOTAL_RECEITA) * 100 : 0;
  const indicadores = {
    // === REGIME CAIXA (das barras filtradas) ===
    TOTAL_RECEITA:        ck.TOTAL_RECEITA,    // entradas de caixa
    TOTAL_DESPESA:        ck.TOTAL_DESPESA,    // saídas de caixa
    VALOR_LIQUIDO:        saldoFluxoCaixa,     // saldo do período (caixa)
    MARGEM_LIQUIDA:       margemFluxo,         // saldo / entradas
    // === DRE/COMPETÊNCIA (separado, NÃO usar nas telas padrão de caixa) ===
    DRE_RECEITA_BRUTA:    dre.receita_bruta,
    DRE_RECEITA_LIQUIDA:  dre.receita_liquida,
    DRE_CMV:              dre.cmv,
    DRE_DESPESA_OP:       dre.despesa_op,
    DRE_EBITDA:           dre.resultado_op,
    DRE_LUCRO_LIQUIDO:    dre.lucro_liquido,
    DRE_MARGEM_BRUTA:     dre.margem_bruta_pct,
    DRE_MARGEM_EBITDA:    dre.margem_ebitda,
    DRE_MARGEM_LIQUIDA:   dre.margem_liquida,
  };
  // Saldos consolidados
  const saldoConsolidado = (!empresa || empresa === '0')
    ? Object.values(SALDOS.totais_por_empresa || {}).reduce((s,t) => s + (t.saldo_total_atual || 0), 0)
    : ((SALDOS.totais_por_empresa || {})[empresa] || {}).saldo_total_atual || 0;

  return Object.assign({
    META, MONTHS, MONTHS_FULL, fmt, fmtK, fmtPct,
    KPIS: agg.KPIS,  // pages legacy lêem B.KPIS.TOTAL_RECEITA / TOTAL_DESPESA
    MONTH_DATA: agg.MONTH_DATA,
    RECEITA_CATEGORIAS: agg.RECEITA_CATEGORIAS,
    DESPESA_CATEGORIAS: agg.DESPESA_CATEGORIAS,
    RECEITA_CLIENTES: agg.RECEITA_CLIENTES,
    DESPESA_FORNECEDORES: agg.DESPESA_FORNECEDORES,
    EXTRATO: agg.EXTRATO,
    EXTRATO_RECEITAS: agg.EXTRATO_RECEITAS,
    EXTRATO_DESPESAS: agg.EXTRATO_DESPESAS,
    DIAS: Array.from({ length: 31 }, (_, i) => i + 1),
    RECEITA_DIA: Array(31).fill(0),
    DESPESA_DIA: Array(31).fill(0),
    SALDOS_MES: agg.MONTH_DATA.reduce((acc, m, i) => { acc.push((acc[i-1] || 0) + (m.receita - m.despesa)); return acc; }, []),
    VALOR_LIQ_SERIES: agg.KPIS.VALOR_LIQ_SERIES,
    FLUXO_RECEITA: fluxoMensal(empresa, year, 'r'),
    FLUXO_DESPESA: fluxoMensal(empresa, year, 'd'),
    COMP_DATA: [
      { tipo: 'Receita Líquida', isHeader: true, d1: 0, d2: dre.receita_liquida },
      { tipo: '(-) CMV',         parent: 'Receita Líquida', d1: 0, d2: -dre.cmv },
      { tipo: 'Margem Bruta',    isHeader: true, d1: 0, d2: dre.margem_bruta },
      { tipo: '(-) Despesa Op',  parent: 'Margem Bruta', d1: 0, d2: -dre.despesa_op },
      { tipo: 'EBITDA',          isHeader: true, d1: 0, d2: dre.resultado_op },
      { tipo: '(+) Receita Fin', parent: 'EBITDA', d1: 0, d2: dre.receita_fin },
      { tipo: '(-) Despesa Fin', parent: 'EBITDA', d1: 0, d2: -dre.despesa_fin },
      { tipo: '(-) IRPJ/CSLL',   parent: 'EBITDA', d1: 0, d2: -dre.provisao_ir },
      { tipo: 'Lucro Líquido',   isHeader: true, d1: 0, d2: dre.lucro_liquido },
    ],
    DRE: dre,
    SALDO_CONSOLIDADO: saldoConsolidado,
    POSICAO_CAIXA: [
      { name: 'Saldo caixa+banco atual', value: saldoConsolidado },
      { name: 'Entradas (caixa) YTD', value: ck.TOTAL_RECEITA },
      { name: 'Saídas (caixa) YTD',  value: ck.TOTAL_DESPESA },
    ],
    COMPOSICAO_DESPESA: agg.DESPESA_CATEGORIAS.slice(0,6).map((c,i) => ({
      name: c.name, value: c.value,
      color: ['#2dd4bf','#22c55e','#a78bfa','#f59e0b','#ef4444','#6b7686'][i] || '#6b7686',
    })),
  }, indicadores);
}

window._makeBit = _makeBit;
window.BIT = _makeBit('realizado', '0', REF_YEAR, 0, null);

// Retro-compat: pages-2.jsx PageTesouraria lê window.BIT_SEGMENTS — manter shape
function _buildSegment(statusFilter, year) {
  const b = _makeBit(statusFilter, '0', year || 0, 0, null);
  // RECEITA_DIA/DESPESA_DIA: distribuir total ano por dia do mês (proxy)
  const totalRec = b.TOTAL_RECEITA || 0;
  const totalDesp = b.TOTAL_DESPESA || 0;
  const recDia = Array(31).fill(0);
  const despDia = Array(31).fill(0);
  // calcular do ALL_TX filtrado: por dia do mês qualquer (proxy de pulso diário)
  const filtered = filterTx(ALL_TX, statusFilter, null, '0', year || 0, 0);
  for (const r of filtered) {
    const dia = r[2];
    if (dia >= 1 && dia <= 31) {
      if (r[0] === 'r') recDia[dia - 1] += r[5];
      else despDia[dia - 1] += r[5];
    }
  }
  return Object.assign({}, b, { RECEITA_DIA: recDia, DESPESA_DIA: despDia });
}
window.BIT_SEGMENTS = {
  realizado: _buildSegment('realizado', 0),
  a_pagar_receber: _buildSegment('a_pagar_receber', 0),
  tudo: _buildSegment('tudo', 0),
};

// getBit: usado pelas pages com signature (statusFilter, drilldown, year, month, empresa)
window.getBit = function (statusFilter, drilldown, year, month, empresa) {
  return _makeBit(statusFilter || 'realizado', empresa || '0', year || 0, month || 0, drilldown);
};
window.recomputeBit = function (statusFilter, drilldown, year, empresa) {
  return _makeBit(statusFilter || 'realizado', empresa || '0', year || 0, 0, drilldown);
};
// applyDrilldown: legado pra extrato
window.applyDrilldown = function (rows, drilldown) {
  if (!drilldown) return rows;
  if (drilldown.type === 'mes') return rows.filter(r => {
    const [d, m, y] = (r[0] || '').split('/');
    return \`\${y}-\${m}\` === drilldown.value;
  });
  if (drilldown.type === 'categoria') return rows.filter(r => r[2] === drilldown.value);
  if (drilldown.type === 'cliente' || drilldown.type === 'fornecedor')
    return rows.filter(r => r[3] === drilldown.value);
  return rows;
};
`;

fs.writeFileSync(OUT_FILE, DATA_JS);
const stat = fs.statSync(OUT_FILE);
console.log(`\n=== OK ===`);
console.log(`  ${OUT_FILE} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
