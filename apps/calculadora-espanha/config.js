/*
 * CONFIGURAÇÃO EDITÁVEL — De Mala y Cuia
 * Os VALORES de referência ficam na planilha-mestre (data/*.csv → node scripts/build-data.mjs).
 * Aqui ficam apenas links, captura de lead e comportamento da página.
 */
window.CALC_CONFIG = {
  INSTAGRAM_URL: "https://www.instagram.com/demalaycuia",
  YOUTUBE_URL: "https://www.youtube.com/@demalaycuia",
  APP_URL: "", // link público (vai no texto compartilhado). Vazio = endereço da página.

  // Cotação comercial ao vivo, sem chave de API. false = usa cotacao_fallback da planilha.
  // Fonte principal: AwesomeAPI (atualiza ao longo do dia). Reserva: BCE via Frankfurter (1x por dia útil).
  CAMBIO_AO_VIVO: true,
  CAMBIO_ATUALIZAR_MIN: 5, // reconsulta a cada N minutos com a página aberta

  // Captura de lead
  //   "netlify"  -> Netlify Forms (grátis, sem backend). Funciona ao publicar no Netlify.
  //   "endpoint" -> POST JSON para LEAD_ENDPOINT (Google Apps Script, Formspree, Make, n8n…)
  //   "demo"     -> não envia nada (apenas para pré-visualização)
  LEAD_MODO: "netlify",
  LEAD_ENDPOINT: "",
  LEAD_TITULO: "Receba uma amostra do Café com Imigração",
  LEAD_TEXTO: "Deixe seu e-mail e enviamos, de graça, o capítulo 9 do Café com Imigração.",
  LEAD_MATERIAL: "cafe-com-imigracao-cap9", // identifica o material pedido no lead
  WHATSAPP_GRUPO_URL: "" // opcional: link do grupo/comunidade mostrado após o cadastro
};
