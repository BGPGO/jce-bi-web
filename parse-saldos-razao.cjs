#!/usr/bin/env node
/**
 * parse-saldos-razao.cjs
 * Lê os CSVs do Razão Caixa em C:\Projects\erp-extraction\data\razao_full_emp{1,2,4}_*.csv
 * e extrai SALDO INICIAL + SALDO ATUAL por (empresa, conta_caixa).
 *
 * Estrutura do CSV:
 *   ...
 *   Conta;     12570;BANCO ITAU 99878-0 AG.5729;Sintética;1.01.01.02 BANCOS;
 *   ;;;;;;Saldo anterior;       2930,41;D;
 *   <lançamentos>...
 *   Saldo anterior;X;Débitos;Y;Créditos;Z;Saldo período;W;Atual;ATUAL;
 *
 * Saída: data/saldos_razao.json
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCES = [
  { empresa: '1', label: 'GLOBALMAC',  file: 'C:/Projects/erp-extraction/data/razao_full_emp1_GLOBALMAC.csv' },
  { empresa: '2', label: 'DCTRACTOR',  file: 'C:/Projects/erp-extraction/data/razao_full_emp2_DCTRACTOR.csv' },
  { empresa: '4', label: 'DCCOMERCIO', file: 'C:/Projects/erp-extraction/data/razao_full_emp4_DCCOMERCIO.csv' },
];

function parseMoney(s) {
  if (!s) return 0;
  const t = String(s).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return isNaN(n) ? 0 : n;
}

function parseFile(empresa, label, fpath) {
  if (!fs.existsSync(fpath)) return [];
  const txt = fs.readFileSync(fpath, 'latin1');
  const lines = txt.split('\n');
  const out = [];
  let cur = null;

  for (const raw of lines) {
    if (!raw) continue;
    const parts = raw.split(';').map(p => p.trim());

    // Conta header: "Conta;     12570;BANCO ITAU ...;Sintética;1.01.01.02 BANCOS;"
    if (parts[0] === 'Conta' && parts.length >= 4) {
      // commit anterior se tiver
      if (cur) out.push(cur);
      const id = parts[1];
      const nome = parts[2];
      // sintética pode estar no [3] ou [4] dependendo de empty
      let sint_full = '';
      for (let i = 3; i < parts.length; i++) {
        if (parts[i] && /^\d+\.\d+/.test(parts[i])) { sint_full = parts[i]; break; }
      }
      const m = sint_full.match(/^([\d\.]+)\s*(.*)$/);
      cur = {
        empresa,
        empresa_label: label,
        conta_id: id,
        conta_nome: nome,
        sintetica_codigo: m ? m[1] : '',
        sintetica_nome: m ? m[2].trim() : '',
        saldo_anterior: 0,
        saldo_anterior_dc: '',
        debitos: 0,
        creditos: 0,
        saldo_periodo: 0,
        saldo_atual: 0,
      };
      continue;
    }

    if (!cur) continue;

    // ";;;;;;Saldo anterior;          106,50;D;"
    if (parts.length >= 9 && parts[6] === 'Saldo anterior' && parts[0] === '') {
      cur.saldo_anterior = parseMoney(parts[7]);
      cur.saldo_anterior_dc = parts[8] || '';
      continue;
    }
    // "Saldo anterior;5275,69;Débitos;7361,79;Créditos;0,00;Saldo período;7361,79;Atual;12637,48;"
    if (parts[0] === 'Saldo anterior' && parts.length >= 10 && parts[2].toLowerCase().includes('bito')) {
      cur.saldo_anterior_total = parseMoney(parts[1]);
      cur.debitos = parseMoney(parts[3]);
      cur.creditos = parseMoney(parts[5]);
      cur.saldo_periodo = parseMoney(parts[7]);
      cur.saldo_atual = parseMoney(parts[9]);
      continue;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const all = [];
for (const s of SOURCES) {
  const rows = parseFile(s.empresa, s.label, s.file);
  console.log(`  ${s.label}: ${rows.length} contas (${rows.filter(r => r.saldo_atual !== 0).length} com saldo)`);
  all.push(...rows);
}

// só caixa+bancos
const SINT_CAIXA = ['CAIXA', 'BANCOS'];
const caixa = all.filter(r => SINT_CAIXA.some(s => (r.sintetica_nome || '').toUpperCase().includes(s)));
console.log(`  total caixa+bancos: ${caixa.length}`);

const out = {
  fetched_at: new Date().toISOString(),
  contas: caixa,
  totais_por_empresa: {},
};

for (const e of ['1', '2', '4']) {
  const subset = caixa.filter(r => r.empresa === e);
  out.totais_por_empresa[e] = {
    n_contas: subset.length,
    n_contas_com_saldo: subset.filter(r => r.saldo_atual !== 0).length,
    saldo_total_atual: subset.reduce((s, r) => s + r.saldo_atual, 0),
    saldo_total_anterior: subset.reduce((s, r) => s + r.saldo_anterior, 0),
  };
}

const outPath = path.join(__dirname, 'data', 'saldos_razao.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\n[ok] ${outPath}`);
console.log(JSON.stringify(out.totais_por_empresa, null, 2));
