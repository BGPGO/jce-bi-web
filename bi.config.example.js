// bi.config.js — gerado por `bgp-bi init` e editado manualmente.
// NUNCA commite credenciais aqui (use .env).
//
// Após editar, rode `node bgp-bi.cjs build` pra validar.
module.exports = {
  cliente: {
    nome: "<NOME DO CLIENTE>",        // ex: "RADKE Soluções Intralogísticas"
    subdomain: "<subdomain>",          // ex: "radke-bi" (vira radke-bi.<COOLIFY_HOST>.sslip.io)
    coolify_app_uuid: "",              // preenchido por bgp-bi init após provisionar
    cor_primaria: "#22d3ee",           // ciano default
  },

  fontes: {
    omie: {
      app_key_env: "OMIE_APP_KEY",
      app_secret_env: "OMIE_APP_SECRET",
      bancos_ok: ["033", "748", "756"], // códigos dos bancos válidos (ex: Santander/Sicredi/Sicoob)
    },
    drive: {
      base_path: "G:/Meu Drive/BGP/CLIENTES/BI/<NUMERO>. <NOME>/BASES",
    },
  },

  pages: {
    geral: ["overview", "receita", "despesa", "fluxo", "tesouraria", "comparativo", "relatorio_ia", "valuation"],
    outros: [],  // ative as Pages opcionais: ["faturamento_produto", "curva_abc", "marketing_ads", "crm_omie"]
  },

  meta: {
    ano_corrente: 2026,
    metas_crm: { mes: 1_000_000, ano: 12_000_000 },
    valuation_premissas: { wacc: 25, growth_year2: 20, growth_year3: 20, ipca: 4.5, perpetuity_growth: 10 },
  },

  template: {
    version_when_created: "1.0.0",
    version_last_synced: "1.0.0",
  },
};
