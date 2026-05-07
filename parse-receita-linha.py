#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
parse-receita-linha.py — JCE BI

Le data/dre_lancamentos.parquet, filtra tipo=RECEITA_BRUTA, mapeia
sint_codigo -> linha de negocio (6 categorias: tratores_novos,
tratores_usados, implementos_novos, implementos_usados, pecas, servicos)
e salva data/receita_por_linha.json com agregacao por (empresa,ano_mes,linha)
+ subdivisao por marca para linhas tratores_novos e implementos_novos.

Output (data/receita_por_linha.json):
{
  "meta": { "periodo": ["2025-01","2026-04"], "empresas": [...], "linhas": [...] },
  "linhas_def": { "tratores_novos": "Tratores Novos", ... },
  "totais_globais": { "tratores_novos": 60017254.36, ... },
  "pct_globais":    { "tratores_novos": 51.6, ... },
  "por_mes":        { "2025-01": { "tratores_novos": 1248900, ... }, ... },
  "por_empresa":    { "GLOBALMAC": { "tratores_novos": ..., ... }, ... },
  "por_empresa_mes": [
     { "empresa": "GLOBALMAC", "ano_mes": "2025-01", "linha": "tratores_novos", "valor": 1248900, "pct_total_mes_empresa": 65.2 }, ...
  ],
  "marcas_tratores_novos": {
     "global":  [ {"marca":"LS MTRON","valor":..., "pct":...}, ... ],
     "por_mes": { "2025-01": { "LS MTRON": 1248900, ... }, ... }
  },
  "marcas_implementos_novos": { ... mesma estrutura ... }
}
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
PARQUET = ROOT / 'data' / 'dre_lancamentos.parquet'
OUT_JSON = ROOT / 'data' / 'receita_por_linha.json'


# -------- mapping sint_codigo (estavel, nao depende de encoding) --------
# Usar sint_codigo evita problemas com caracteres acentuados corrompidos no parquet.
LINHA_BY_SINT = {
    # Tratores
    '3.01.03.01.01': 'tratores_novos',
    '3.01.03.01.02': 'tratores_usados',
    '3.01.03.01.03': 'pecas',  # pneus/camaras comercial -> pecas

    # Implementos
    '3.01.03.02.01': 'implementos_novos',
    '3.01.03.02.02': 'implementos_usados',

    # Pecas
    '3.01.03.03.01': 'pecas',  # originais tratores
    '3.01.03.03.02': 'pecas',  # originais implementos
    '3.01.03.03.06': 'pecas',  # pecas jacto
    '3.01.03.04.01': 'pecas',  # paralelas tratores
    '3.01.03.04.02': 'pecas',  # paralelas implementos
    '3.01.03.05.01': 'pecas',  # oleos e graxas
    '3.01.03.05.02': 'pecas',  # pneus e camaras
    '3.01.03.05.03': 'pecas',  # produtos buffalo
    '3.01.03.06.03': 'pecas',  # outros materiais

    # Servicos (mao de obra)
    '3.01.04.01':    'servicos',  # mao de obra tratores clientes
    '3.01.04.02':    'servicos',  # mao de obra implementos clientes
    '3.01.04.03':    'servicos',  # mao de obra tratores garantia
    '3.01.04.06':    'servicos',  # mao de obra implementos internos
    '3.01.04.09':    'servicos',  # servicos de terceiros

    # Impostos (excluir do total)
    '3.01.03.07':    'IGNORE',
}

LINHAS_LABEL = {
    'tratores_novos':     'Tratores Novos',
    'tratores_usados':    'Tratores Usados',
    'implementos_novos':  'Implementos Novos',
    'implementos_usados': 'Implementos Usados',
    'pecas':              'Peças',
    'servicos':           'Serviços',
}
LINHA_ORDER = ['tratores_novos', 'tratores_usados', 'implementos_novos',
               'implementos_usados', 'pecas', 'servicos']


# -------- regex de marca --------
# Marcas conhecidas; ordem importa (mais especificas primeiro).
MARCAS = [
    ('LS MTRON',         re.compile(r'\bLS\s*MTRON\b', re.I)),
    ('YANMAR',           re.compile(r'\bYANMAR\b', re.I)),
    ('YTO',              re.compile(r'\bYTO\b', re.I)),
    ('ANTONIO CARRARO',  re.compile(r'\bANTONIO\s+CARRARO\b', re.I)),
    ('JOHN DEERE',       re.compile(r'\bJOHN\s+DEERE\b', re.I)),
    ('AGCO',             re.compile(r'\bAGCO\b', re.I)),
    ('MASSEY FERGUSON',  re.compile(r'\bMASSEY\b', re.I)),
    ('NEW HOLLAND',      re.compile(r'\bNEW\s+HOLLAND\b', re.I)),
    ('STARA',            re.compile(r'\bSTARA\b', re.I)),
    ('VALTRA',           re.compile(r'\bVALTRA\b', re.I)),
    ('JACTO',            re.compile(r'\bJACTO\b', re.I)),
    ('KUHN',             re.compile(r'\bKUHN\b', re.I)),
    ('SAO JOSE',         re.compile(r'\bS[AÃ]?O?\s*JOS[EÉ]\b', re.I)),
    ('TATU',             re.compile(r'\bTATU\b', re.I)),
    ('MEC-RUL',          re.compile(r'\bMEC[-\s]?RUL\b', re.I)),
    ('MARISPAN',         re.compile(r'\bMARISPAN\b', re.I)),
    ('PICCIN',           re.compile(r'\bPICCIN\b', re.I)),
    ('MP AGRO',          re.compile(r'\bMP\s+AGRO\b', re.I)),
    ('JAN',              re.compile(r'IMPLEMENTOS\s+NOVOS\s+JAN\b', re.I)),
    ('BALDAN',           re.compile(r'\bBALDAN\b', re.I)),
    ('VENCE TUDO',       re.compile(r'\bVENCE\s+TUDO\b', re.I)),
    ('RODIMAQ',          re.compile(r'\bRODIMAQ\b', re.I)),
    ('MAQTRON',          re.compile(r'\bMAQTRON\b', re.I)),
    ('BUFFALO',          re.compile(r'\bBUFFALO\b', re.I)),
]


def detect_marca(conta_nome: str | None, historico: str | None) -> str:
    # 1) conta_nome eh autoridade (vem do plano de contas, ja categorizado).
    #    Tenta match contra lista de marcas conhecidas primeiro.
    if conta_nome:
        cn = str(conta_nome).strip()
        cn_up = cn.upper()
        # tenta match direto contra lista
        for label, rx in MARCAS:
            if rx.search(cn_up):
                return label
        # casos especiais: conta_nome generico "IMPLEMENTOS NOVOS OUTROS" / "VENDA TRATORES OUTROS"
        # (o ERP tem categoria explicita "OUTROS" pra implementos sem marca classificada)
        if 'OUTROS' in cn_up:
            return 'OUTROS'
        # MP AGRO / IMPLEMENTOS AGRICOLAS / IMPLEMENTOS JAN sao marcas reais embora o nome seja generico.
        # Limpa encoding (S�O JOS� -> SAO JOSE) e devolve o conta_nome cru, capitalized.
        cn_clean = cn_up.replace('Ã£', 'A').replace('Ã©', 'E')
        # remove caracteres nao-ascii (corrupcao do parquet)
        cn_clean = re.sub(r'[^A-Z0-9 \-]', '', cn_clean).strip()
        cn_clean = re.sub(r'\s+', ' ', cn_clean)
        return cn_clean or 'OUTROS'
    # 2) fallback: historico
    if historico:
        for label, rx in MARCAS:
            if rx.search(str(historico)):
                return label
    return 'OUTROS'


def main():
    if not PARQUET.exists():
        print(f'ERRO: parquet nao encontrado: {PARQUET}', file=sys.stderr)
        sys.exit(1)

    print(f'-> lendo {PARQUET.name}', file=sys.stderr)
    df = pd.read_parquet(PARQUET)
    print(f'   {len(df):,} lctos total', file=sys.stderr)

    # Filtra so receita
    rec = df[df['tipo'] == 'RECEITA_BRUTA'].copy()
    print(f'   {len(rec):,} lctos RECEITA_BRUTA', file=sys.stderr)

    # Mapeia linha de negocio
    rec['linha'] = rec['sint_codigo'].map(LINHA_BY_SINT).fillna('IGNORE')
    ignorados = rec[rec['linha'] == 'IGNORE']
    if not ignorados.empty:
        print(f'   ignorados (impostos/desconhecidos): {len(ignorados):,} lctos, '
              f'R$ {ignorados["valor_abs"].sum():,.2f}', file=sys.stderr)
    rec = rec[rec['linha'] != 'IGNORE']

    # Marca = detectada do conta_nome + historico
    rec['marca'] = rec.apply(
        lambda r: detect_marca(r.get('conta_nome'), r.get('historico')),
        axis=1,
    )

    # ---- agregacoes ----
    # totais globais por linha
    totais = rec.groupby('linha')['valor_abs'].sum().to_dict()
    total_receita = sum(totais.values())
    pct_globais = {
        l: round((v / total_receita) * 100, 4) if total_receita else 0.0
        for l, v in totais.items()
    }

    # por mes (consolidado)
    pm = rec.groupby(['ano_mes', 'linha'])['valor_abs'].sum().reset_index()
    por_mes: dict[str, dict[str, float]] = {}
    for _, row in pm.iterrows():
        por_mes.setdefault(row['ano_mes'], {})[row['linha']] = round(float(row['valor_abs']), 2)

    # por empresa (consolidado)
    pe = rec.groupby(['empresa_label', 'linha'])['valor_abs'].sum().reset_index()
    por_empresa: dict[str, dict[str, float]] = {}
    for _, row in pe.iterrows():
        por_empresa.setdefault(row['empresa_label'], {})[row['linha']] = round(float(row['valor_abs']), 2)

    # cubo por (empresa, mes, linha)
    cub = rec.groupby(['empresa_label', 'ano_mes', 'linha'])['valor_abs'].sum().reset_index()
    # total por (empresa, mes) pra calcular pct
    tot_em = rec.groupby(['empresa_label', 'ano_mes'])['valor_abs'].sum().to_dict()
    por_empresa_mes = []
    for _, row in cub.iterrows():
        emp = row['empresa_label']
        ym = row['ano_mes']
        ln = row['linha']
        v = float(row['valor_abs'])
        denom = tot_em.get((emp, ym), 0.0)
        pct = round((v / denom) * 100, 2) if denom else 0.0
        por_empresa_mes.append({
            'empresa': emp,
            'ano_mes': ym,
            'linha': ln,
            'valor': round(v, 2),
            'pct_total_mes_empresa': pct,
        })

    # ---- marcas: tratores_novos ----
    def agg_marcas(linha_id: str) -> dict:
        sub = rec[rec['linha'] == linha_id]
        if sub.empty:
            return {'global': [], 'por_mes': {}, 'por_empresa': {}}
        # global
        g = sub.groupby('marca')['valor_abs'].sum().sort_values(ascending=False)
        total_l = float(g.sum())
        global_list = [
            {
                'marca': m,
                'valor': round(float(v), 2),
                'pct': round((float(v) / total_l) * 100, 2) if total_l else 0.0,
            }
            for m, v in g.items()
        ]
        # por mes
        pm2 = sub.groupby(['ano_mes', 'marca'])['valor_abs'].sum().reset_index()
        por_mes_marca: dict[str, dict[str, float]] = {}
        for _, row in pm2.iterrows():
            por_mes_marca.setdefault(row['ano_mes'], {})[row['marca']] = round(float(row['valor_abs']), 2)
        # por empresa
        pe2 = sub.groupby(['empresa_label', 'marca'])['valor_abs'].sum().reset_index()
        por_emp_marca: dict[str, dict[str, float]] = {}
        for _, row in pe2.iterrows():
            por_emp_marca.setdefault(row['empresa_label'], {})[row['marca']] = round(float(row['valor_abs']), 2)
        return {
            'global': global_list,
            'por_mes': por_mes_marca,
            'por_empresa': por_emp_marca,
        }

    marcas_tn = agg_marcas('tratores_novos')
    marcas_in = agg_marcas('implementos_novos')

    # meta
    periodo = sorted(rec['ano_mes'].unique().tolist())
    empresas = sorted(rec['empresa_label'].unique().tolist())

    out = {
        'meta': {
            'periodo': [periodo[0], periodo[-1]] if periodo else [None, None],
            'meses': periodo,
            'empresas': empresas,
            'linhas': LINHA_ORDER,
            'gerado_em': pd.Timestamp.now().isoformat(),
            'lctos_processados': int(len(rec)),
            'total_receita_bruta': round(float(total_receita), 2),
        },
        'linhas_def': LINHAS_LABEL,
        'totais_globais': {l: round(float(totais.get(l, 0.0)), 2) for l in LINHA_ORDER},
        'pct_globais': {l: pct_globais.get(l, 0.0) for l in LINHA_ORDER},
        'por_mes': por_mes,
        'por_empresa': por_empresa,
        'por_empresa_mes': por_empresa_mes,
        'marcas_tratores_novos': marcas_tn,
        'marcas_implementos_novos': marcas_in,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    sz_kb = OUT_JSON.stat().st_size / 1024
    print(f'-> escrito {OUT_JSON.name} ({sz_kb:.1f} KB)', file=sys.stderr)

    # ---- relatorio no stdout ----
    print('\n=== RECEITA POR LINHA DE NEGOCIO (16 meses, 3 empresas) ===')
    print(f'Total: R$ {total_receita:,.2f}')
    print()
    for l in LINHA_ORDER:
        v = totais.get(l, 0.0)
        p = pct_globais.get(l, 0.0)
        print(f'  {LINHAS_LABEL[l]:22s}  R$ {v:>16,.2f}  ({p:>5.2f}%)')
    print()
    print('Marcas Tratores Novos (top 10):')
    for it in marcas_tn['global'][:10]:
        print(f'  {it["marca"]:22s}  R$ {it["valor"]:>14,.2f}  ({it["pct"]:>5.2f}%)')
    print()
    print('Marcas Implementos Novos (top 10):')
    for it in marcas_in['global'][:10]:
        print(f'  {it["marca"]:22s}  R$ {it["valor"]:>14,.2f}  ({it["pct"]:>5.2f}%)')


if __name__ == '__main__':
    main()
