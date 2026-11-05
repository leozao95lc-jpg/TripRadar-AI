/* ==========================================================================
   DE MALA Y CUIA — CONFIGURAÇÃO CENTRAL
   --------------------------------------------------------------------------
   Este é o ÚNICO arquivo que precisa ser editado no dia a dia:
   links, redes sociais, cards, status e analytics.

   Regra de segurança: qualquer URL que não comece com "https://" é tratada
   como "não configurada". Card ativo sem URL válida vira "Em breve"
   automaticamente; rede social sem URL válida não aparece. Assim nenhum
   seguidor cai em link quebrado.
   ========================================================================== */

window.DMYC_CONFIG = {
  /* ------------------------------------------------------------------------
     1. SITE
     ------------------------------------------------------------------------ */
  site: {
    // Caminho do logotipo oficial. Deixe "" para usar o logotipo textual.
    // Ex.: "assets/img/logo-demalaycuia.svg"
    logo: "",
    tagline:
      "Do Brasil para a Espanha, compartilhando experiências, descobertas e ferramentas para ajudar você a planejar sua própria jornada.",
    // "flat"     → todos os cards em uma única lista ("Nossos conteúdos")
    // "category" → cards agrupados por categoria (usar quando houver ~6+ itens)
    layout: "flat",
    sectionTitle: "Nossos conteúdos",
  },

  /* ------------------------------------------------------------------------
     2. REDES SOCIAIS
     Substitua os valores "PREENCHER_..." pelas URLs reais.
     ------------------------------------------------------------------------ */
  social: {
    instagramLeonardo: {
      label: "Leonardo",
      handle: "@PREENCHER",
      url: "PREENCHER_URL_INSTAGRAM_LEONARDO", // ex.: https://www.instagram.com/usuario/
      icon: "instagram",
    },
    instagramMarcelly: {
      label: "Marcelly",
      handle: "@PREENCHER",
      url: "PREENCHER_URL_INSTAGRAM_MARCELLY",
      icon: "instagram",
    },
    youtube: {
      label: "De Mala y Cuia",
      handle: "YouTube",
      url: "PREENCHER_URL_CANAL_YOUTUBE", // ex.: https://www.youtube.com/@canal
      icon: "youtube",
    },
  },

  /* ------------------------------------------------------------------------
     3. CATEGORIAS
     Só aparecem na página as categorias que tiverem ao menos 1 card visível.
     Pode cadastrar todas agora sem impacto visual.
     ------------------------------------------------------------------------ */
  categories: {
    conteudo:    { label: "Conteúdo",          order: 1 },
    produto:     { label: "Produto digital",   order: 2 },
    ferramenta:  { label: "Ferramenta",        order: 3 },
    servico:     { label: "Serviço",           order: 4 },
    parceria:    { label: "Parceria",          order: 5 },
  },

  /* ------------------------------------------------------------------------
     4. RECURSOS (CARDS)
     Para criar um card novo: copie um objeto, cole no fim da lista e ajuste.

     Campos:
       id          identificador único, sem espaços (usado no analytics)
       title       título do card
       description descrição curta (até ~110 caracteres)
       icon        youtube | book | calculator | instagram | play | map |
                   sheet | chat | plane | tag | star | link
       url         link de destino (https://...)
       cta         texto do botão
       category    chave de "categories" acima
       type        video | ebook | tool | guide | service | affiliate | social
       order       ordem de exibição (menor aparece primeiro)
       status      "active" | "soon" | "disabled"  (disabled = oculto)
       featured    true destaca o card em laranja (use em no máximo 1 ou 2)
       newTab      true abre em nova aba
       badge       etiqueta opcional (ex.: "Novo", "Grátis", "-20%")
       utm         true acrescenta UTM ao link de saída (útil para plataformas
                   de venda como Hotmart/Kiwify medirem a origem da venda)
     ------------------------------------------------------------------------ */
  resources: [
    {
      id: "youtube-canal",
      title: "Nossa jornada no YouTube",
      description:
        "Experiências, cotidiano, descobertas e tudo sobre nossa vida na Espanha.",
      icon: "youtube",
      url: "PREENCHER_URL_CANAL_YOUTUBE",
      cta: "Assistir aos vídeos",
      category: "conteudo",
      type: "video",
      order: 10,
      status: "active",
      featured: false,
      newTab: true,
      utm: false,
    },
    {
      id: "ebook-morar-espanha",
      title: "Guia para morar na Espanha",
      description:
        "Um material para ajudar você a entender, organizar e planejar sua mudança para a Espanha.",
      icon: "book",
      url: "PREENCHER_URL_PAGINA_EBOOK",
      cta: "Conhecer o e-book",
      category: "produto",
      type: "ebook",
      order: 20,
      status: "active",
      featured: true,
      badge: "E-book",
      newTab: true,
      utm: true,
    },
    {
      id: "calculadora-mudanca",
      title: "Calculadora de mudança para Espanha",
      description:
        "Simule quanto dinheiro pode precisar para sair do Brasil e começar uma nova vida na Espanha.",
      icon: "calculator",
      url: "", // inserir quando a calculadora estiver pronta
      cta: "Simular agora",
      category: "ferramenta",
      type: "tool",
      order: 30,
      status: "soon",
      featured: false,
      newTab: false,
      utm: true,
    },

    /* EXEMPLO (desativado) — modelo para copiar:
    {
      id: "planilha-custo-de-vida",
      title: "Planilha de custo de vida",
      description: "Compare aluguel, mercado e transporte entre cidades espanholas.",
      icon: "sheet",
      url: "https://...",
      cta: "Baixar planilha",
      category: "produto",
      type: "guide",
      order: 40,
      status: "disabled",
      featured: false,
      badge: "Grátis",
      newTab: true,
      utm: true,
    },
    */
  ],

  /* ------------------------------------------------------------------------
     5. ANALYTICS (Google Analytics 4)
     Cole o ID de métricas (formato "G-XXXXXXXXXX") para ativar.
     Vazio = nada é carregado; os eventos ficam só no window.dataLayer.
     ------------------------------------------------------------------------ */
  analytics: {
    ga4Id: "",
    debug: false, // true mostra os eventos no console do navegador
    // Valores de utm_campaign reconhecidos como perfil de origem
    profiles: ["leonardo", "marcelly"],
  },
};
