/*
 * CONFIGURAÇÃO EDITÁVEL — De Mala y Cuia
 * Os VALORES de referência ficam na planilha-mestre (data/*.csv → node scripts/build-data.mjs).
 * Aqui ficam apenas links, captura de lead e comportamento da página.
 */
window.CALC_CONFIG = {
  INSTAGRAM_URL: "https://www.instagram.com/demalaycuia",
  YOUTUBE_URL: "https://www.youtube.com/@demalaycuia",
  APP_URL: "", // link público (vai no texto compartilhado). Vazio = endereço da página.

  // Cotação comercial ao vivo (BCE via Frankfurter, sem chave). false = usa cotacao_fallback da planilha.
  CAMBIO_AO_VIVO: true,
  CAMBIO_API: "https://api.frankfurter.app/latest?from=EUR&to=BRL",

  // Captura de lead
  //   "netlify"  -> Netlify Forms (grátis, sem backend). Funciona ao publicar no Netlify.
  //   "endpoint" -> POST JSON para LEAD_ENDPOINT (Google Apps Script, Formspree, Make, n8n…)
  //   "demo"     -> não envia nada (apenas para pré-visualização)
  LEAD_MODO: "netlify",
  LEAD_ENDPOINT: "",
  LEAD_TITULO: "Receba seu plano de mudança completo",
  LEAD_TEXTO: "Enviamos por e-mail a sua simulação, o checklist dos primeiros 30 dias na Espanha e os alertas quando os valores de referência forem atualizados.",
  WHATSAPP_GRUPO_URL: "" // opcional: link do grupo/comunidade mostrado após o cadastro
};
