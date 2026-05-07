// Configuração do cliente JCE / GLOBAL MAC.
// Fonte: ERP Solution/Aliare via Playwright (rotina 7003 — Razão de Caixa)
// extraído em C:\Projects\erp-extraction. Não é Omie.
module.exports = {
  cliente: {
    nome: "GLOBAL MAC / DC TRACTOR / DC COMERCIO",
    nome_curto: "GlobalMac",
    subdomain: "jce-bi",
    coolify_app_uuid: "",         // preencher após provisionar Coolify
    cor_primaria: "#22d3ee",
  },

  fontes: {
    // ERP Solution: extrator separado em C:\Projects\erp-extraction.
    // BASE_CAIXA_RAZAO.xlsx é gerado offline e copiado pro Drive.
    erp_solution: {
      url: "https://solution.mainroute.com.br",
      base_xlsx: "BASE_CAIXA_RAZAO.xlsx",  // nome do arquivo dentro do base_path
      empresas: [
        { codigo: "1", label: "GLOBAL MAC",  razao_social: "GLOBAL MAC COM. E SERV. DE MÁQ. E TRATORES LTDA" },
        { codigo: "2", label: "DC TRACTOR",  razao_social: "DC TRACTOR COM. E SERV. DE MÁQ. E TRATORES LTDA" },
        { codigo: "4", label: "DC COMERCIO", razao_social: "DC COMERCIO DE MAQUINAS LTDA" },
      ],
      // empresa 3 (GLOBALVALE) sem permissão pro user LUIS.E — pulada na extração
    },
    drive: {
      base_path: "G:/Meu Drive/BGP/CLIENTES/BI/465. JCE/BASES",
    },
  },

  pages: {
    // BI padrão completo + extras pedidos pelo cliente.
    // Páginas que dependem de fontes específicas (faturamento por linha,
    // CRM, marketing) ficam vazias até liberar nova extração ERP.
    geral:  ["overview", "indicators", "receita", "receita_linha", "despesa", "fluxo", "tesouraria", "endividamento", "comparativo", "relatorio", "indicadores_contabeis"],
    outros: ["estoque", "ponto_equilibrio", "rentabilidade", "benchmarks"],
  },

  meta: {
    ano_corrente: 2026,
    metas_crm: { mes: 0, ano: 0 },
    valuation_premissas: { wacc: 25, growth_year2: 20, growth_year3: 20, ipca: 4.5, perpetuity_growth: 10 },
  },

  template: {
    version_when_created: "1.0.0",
    version_last_synced: "1.0.0",
  },
};
