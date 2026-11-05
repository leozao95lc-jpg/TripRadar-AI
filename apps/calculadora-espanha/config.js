/*
 * CONFIGURAÇÃO EDITÁVEL — De Mala y Cuia
 * Links, cotação e VALORES DE REFERÊNCIA (em euros, por mês).
 * Revise os valores periodicamente e atualize REFERENCIA_DATA.
 */
window.CALC_CONFIG = {
  INSTAGRAM_URL: "https://www.instagram.com/demalaycuia",
  YOUTUBE_URL: "https://www.youtube.com/@demalaycuia",

  // Link público da calculadora (vai no texto compartilhado). Vazio = endereço da página.
  APP_URL: "",

  // Cotação inicial EUR -> BRL (editável pelo usuário). NÃO é cotação em tempo real.
  COTACAO_INICIAL: 6.3,

  REFERENCIA_DATA: "nov/2026",

  // Aluguel mensal por tipo de moradia + passe mensal de transporte + índice de custo local.
  // quarto: Idealista, relatórios de habitações em piso compartilhado (1º/2º tri 2026).
  // estudio/ap1/ap2: estimativas aproximadas — VALIDE no Idealista/Fotocasa antes de divulgar.
  // transporte: passe de 30 dias. Madrid zona A = €32,70 (CRTM 2026, com desconto de 40%
  //   válido até 31/12/2026). Demais cidades: estimativa.
  CIDADES: {
    "Madrid":    { quarto: 590, estudio: 1000, ap1: 1250, ap2: 1600, transporte: 33, indice: 1.00 },
    "Barcelona": { quarto: 600, estudio: 1000, ap1: 1250, ap2: 1550, transporte: 22, indice: 1.05 },
    "Valencia":  { quarto: 415, estudio: 800,  ap1: 950,  ap2: 1200, transporte: 40, indice: 0.90 },
    "Málaga":    { quarto: 430, estudio: 850,  ap1: 1050, ap2: 1300, transporte: 40, indice: 0.92 },
    "Alicante":  { quarto: 390, estudio: 700,  ap1: 850,  ap2: 1050, transporte: 35, indice: 0.88 },
    "Outra":     { quarto: 425, estudio: 700,  ap1: 850,  ap2: 1000, transporte: 35, indice: 0.90 }
  },

  // Contas da casa (luz, água, gás, internet). No quarto, é a parte de cada morador.
  CONTAS: { quarto: 40, estudio: 110, ap1: 130, ap2: 160 },

  // Gastos por pessoa em estilo "moderado" numa cidade de índice 1,00 (Madrid).
  POR_PESSOA: { mercado: 250, lazer: 150, celular: 12, saude: 50, outros: 60 },

  // Multiplicador do estilo de vida (aplicado a mercado, lazer e outros).
  ESTILO: { economico: 0.8, moderado: 1.0, confortavel: 1.3 }
};
