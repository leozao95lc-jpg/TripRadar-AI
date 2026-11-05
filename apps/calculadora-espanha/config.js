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
  //   "mailerlite" -> formulário do MailerLite (veja MAILERLITE.md). Sem os IDs abaixo, cai no Netlify.
  LEAD_MODO: "mailerlite",
  LEAD_ENDPOINT: "",

  // MailerLite: copie do código de incorporação do formulário, no trecho
  // action="https://assets.mailerlite.com/jsonp/ACCOUNT_ID/forms/FORM_ID/subscribe"
  MAILERLITE_ACCOUNT_ID: "",
  MAILERLITE_FORM_ID: "",
  // Campos extras enviados ao MailerLite (crie antes, com estes nomes, em Assinantes > Campos).
  // Ex.: ["cidade", "moradia", "cenario", "custo_mensal_eur"]. Vazio = só nome, e-mail e telefone.
  MAILERLITE_CAMPOS_EXTRAS: [],

  HOTMART_URL: "", // link do e-book completo, mostrado após o cadastro
  LEAD_TITULO: "Receba uma amostra do Café com Imigração",
  LEAD_TEXTO: "O capítulo 9 completo, de graça no seu e-mail: Moradia sem cair em golpe. Os 4 cuidados que fizeram a gente pegar a chave no 3º dia em Valência, quanto pagamos para entrar (com comprovante) e um checklist de 16 itens.",
  LEAD_MATERIAL: "cafe-com-imigracao-cap9", // identifica o material pedido no lead
  WHATSAPP_GRUPO_URL: "" // opcional: link do grupo/comunidade mostrado após o cadastro
};
