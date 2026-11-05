/* ==========================================================================
   DE MALA Y CUIA — RENDERIZAÇÃO + MÉTRICAS
   Não é preciso editar este arquivo para adicionar cards ou trocar links:
   tudo vem de config.js (window.DMYC_CONFIG).
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.DMYC_CONFIG;
  if (!CFG) { console.error("[DMYC] config.js não carregado."); return; }

  var STATUS = { ACTIVE: "active", SOON: "soon", DISABLED: "disabled" };

  /* ----------------------------------------------------------------------
     Utilitários
     ---------------------------------------------------------------------- */
  function isValidUrl(url) {
    return typeof url === "string" && /^https:\/\/[^\s]+$/i.test(url.trim());
  }

  // Criação segura de elementos (sem innerHTML com dados de configuração)
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  function icon(name) {
    var known = document.getElementById("i-" + name);
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#i-" + (known ? name : "link"));
    svg.appendChild(use);
    return svg;
  }

  function storage(key, value) {
    try {
      if (value === undefined) return window.sessionStorage.getItem(key);
      window.sessionStorage.setItem(key, value);
    } catch (e) { /* modo privado / bloqueado: segue sem persistir */ }
    return null;
  }

  /* ----------------------------------------------------------------------
     Origem do acesso (UTM)
     Bio do Leonardo:  ?utm_source=instagram&utm_medium=bio&utm_campaign=leonardo
     Bio da Marcelly:  ?utm_source=instagram&utm_medium=bio&utm_campaign=marcelly
     ---------------------------------------------------------------------- */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function readAttribution() {
    var params = new URLSearchParams(window.location.search);
    var utm = {};
    UTM_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) utm[k] = v.toLowerCase().slice(0, 100);
    });

    if (Object.keys(utm).length) {
      storage("dmyc_utm", JSON.stringify(utm));
    } else {
      try { utm = JSON.parse(storage("dmyc_utm") || "{}"); } catch (e) { utm = {}; }
    }

    var profiles = (CFG.analytics && CFG.analytics.profiles) || [];
    var profile = "desconhecido";
    if (utm.utm_campaign && profiles.indexOf(utm.utm_campaign) !== -1) {
      profile = utm.utm_campaign;
    } else if (utm.utm_source) {
      profile = utm.utm_source;
    } else if (/instagram\.com/i.test(document.referrer)) {
      profile = "instagram_sem_utm";
    } else if (!document.referrer) {
      profile = "direto";
    } else {
      profile = "outro";
    }
    return { utm: utm, profile: profile };
  }

  var ATTR = readAttribution();

  // Acrescenta UTM ao link de saída (para Hotmart/Kiwify/etc. atribuírem a venda)
  function withOutboundUtm(url) {
    try {
      var u = new URL(url);
      if (!u.searchParams.has("utm_source")) {
        u.searchParams.set("utm_source", "demalaycuia");
        u.searchParams.set("utm_medium", "linkpage");
        u.searchParams.set("utm_campaign", ATTR.profile);
      }
      return u.toString();
    } catch (e) { return url; }
  }

  /* ----------------------------------------------------------------------
     Analytics (GA4-ready)
     Todos os eventos vão para window.dataLayer (compatível com GA4 e GTM).
     ---------------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var GA_ID = CFG.analytics && CFG.analytics.ga4Id;
  if (GA_ID && /^G-[A-Z0-9]+$/i.test(GA_ID)) {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { origin_profile: ATTR.profile });
  }

  function track(eventName, params) {
    var payload = Object.assign({ origin_profile: ATTR.profile }, params || {});
    window.gtag("event", eventName, payload);
    if (CFG.analytics && CFG.analytics.debug) console.info("[DMYC track]", eventName, payload);
  }
  window.DMYC_track = track; // exposto para futuras páginas/ferramentas

  /* ----------------------------------------------------------------------
     Normalização dos recursos
     ---------------------------------------------------------------------- */
  function normalize(list) {
    var seen = {};
    return (list || [])
      .filter(function (r) {
        if (!r || !r.id) { console.warn("[DMYC] recurso sem id ignorado:", r); return false; }
        if (seen[r.id]) { console.warn("[DMYC] id duplicado ignorado:", r.id); return false; }
        seen[r.id] = true;
        return r.status !== STATUS.DISABLED;
      })
      .map(function (r) {
        var status = r.status === STATUS.SOON ? STATUS.SOON : STATUS.ACTIVE;
        if (status === STATUS.ACTIVE && !isValidUrl(r.url)) {
          console.warn("[DMYC] '" + r.id + "' está ativo mas sem URL https válida → exibido como 'Em breve'.");
          status = STATUS.SOON;
        }
        if (!CFG.categories[r.category]) {
          console.warn("[DMYC] categoria desconhecida em '" + r.id + "': " + r.category);
        }
        return Object.assign({}, r, { status: status, order: Number(r.order) || 999 });
      })
      .sort(function (a, b) { return a.order - b.order; });
  }

  /* ----------------------------------------------------------------------
     Card
     ---------------------------------------------------------------------- */
  function buildCard(r, index) {
    var cat = CFG.categories[r.category];
    var isSoon = r.status === STATUS.SOON;
    var num = String(index + 1).padStart(2, "0");

    var meta = h("div", { class: "card__meta" }, [
      h("span", { text: cat ? cat.label : r.category }),
      r.badge && !isSoon ? h("span", { class: "card__badge", text: r.badge }) : null,
    ]);

    var cta = h("span", { class: "card__cta", "aria-hidden": isSoon ? "true" : null }, [
      isSoon ? icon("clock") : null,
      isSoon ? "Disponível em breve" : (r.cta || "Acessar"),
      isSoon ? null : icon("arrow"),
    ]);

    var body = h("div", { class: "card__body" }, [
      meta,
      h("h3", { class: "card__title", text: r.title }),
      r.description ? h("p", { class: "card__desc", text: r.description }) : null,
      cta,
    ]);

    var stub = h("div", { class: "card__stub", "aria-hidden": "true" }, [
      icon(r.icon),
      h("span", { class: "card__num", text: num }),
    ]);

    var classes = "card" + (r.featured && !isSoon ? " card--featured" : "") + (isSoon ? " card--soon" : "");
    var card;

    if (isSoon) {
      card = h("div", {
        class: classes,
        role: "group",
        "aria-label": r.title + " — em breve, ainda indisponível",
        "data-id": r.id,
      }, [stub, body, h("span", { class: "card__stamp", "aria-hidden": "true", text: "EM BREVE" })]);
      // Mede interesse antes do lançamento
      card.addEventListener("click", function () {
        track("resource_interest", {
          resource_id: r.id, resource_name: r.title, resource_category: r.category,
          resource_type: r.type, position: index + 1,
        });
      });
    } else {
      var href = r.utm ? withOutboundUtm(r.url) : r.url;
      card = h("a", {
        class: classes,
        href: href,
        target: r.newTab ? "_blank" : null,
        rel: r.newTab ? "noopener noreferrer" : null,
        "data-id": r.id,
        "aria-label": r.title + " — " + (r.cta || "Acessar") + (r.newTab ? " (abre em nova aba)" : ""),
      }, [stub, body]);
      card.addEventListener("click", function () {
        track("resource_click", {
          resource_id: r.id, resource_name: r.title, resource_category: r.category,
          resource_type: r.type, position: index + 1, featured: !!r.featured,
          link_url: r.url,
        });
      });
    }

    var li = h("li", null, [card]);
    li.style.setProperty("--i", index); // via CSSOM: compatível com a CSP
    return li;
  }

  /* ----------------------------------------------------------------------
     Seções
     ---------------------------------------------------------------------- */
  function renderResources() {
    var root = document.getElementById("conteudos");
    var items = normalize(CFG.resources);
    var frag = document.createDocumentFragment();

    if (!items.length) {
      frag.appendChild(h("p", { class: "noscript", text: "Novidades em breve." }));
    } else if (CFG.site.layout === "category") {
      var groups = {};
      items.forEach(function (r) { (groups[r.category] = groups[r.category] || []).push(r); });
      var counter = 0;
      Object.keys(groups)
        .sort(function (a, b) {
          return ((CFG.categories[a] || {}).order || 99) - ((CFG.categories[b] || {}).order || 99);
        })
        .forEach(function (key) {
          var label = (CFG.categories[key] || {}).label || key;
          var headingId = "cat-" + key;
          var ul = h("ul", { class: "cards" });
          groups[key].forEach(function (r) { ul.appendChild(buildCard(r, counter++)); });
          frag.appendChild(h("section", { class: "group", "aria-labelledby": headingId }, [
            h("h2", { class: "eyebrow", id: headingId, text: label }), ul,
          ]));
        });
    } else {
      var list = h("ul", { class: "cards" });
      items.forEach(function (r, i) { list.appendChild(buildCard(r, i)); });
      frag.appendChild(h("section", { class: "group", "aria-labelledby": "sec-main" }, [
        h("h2", { class: "eyebrow", id: "sec-main", text: CFG.site.sectionTitle || "Nossos conteúdos" }), list,
      ]));
    }

    root.appendChild(frag);
  }

  function socialEntries() {
    return Object.keys(CFG.social || {})
      .map(function (k) { return Object.assign({ key: k }, CFG.social[k]); })
      .filter(function (s) {
        if (!isValidUrl(s.url)) { console.warn("[DMYC] rede '" + s.key + "' sem URL válida → oculta."); return false; }
        return true;
      });
  }

  function socialLink(s, extraClass, children) {
    var a = h("a", {
      class: extraClass,
      href: s.url,
      target: "_blank",
      rel: "noopener noreferrer me",
      "aria-label": s.label + " no " + (s.icon === "youtube" ? "YouTube" : "Instagram") + " (abre em nova aba)",
    }, children);
    a.addEventListener("click", function () {
      track("social_click", { social_network: s.icon, social_profile: s.key, link_url: s.url });
    });
    return a;
  }

  function renderSocial() {
    var entries = socialEntries();

    var hero = document.getElementById("hero-social");
    // No topo: 1 ícone por rede (evita 2 ícones iguais de Instagram lado a lado)
    var shownNetworks = {};
    entries.forEach(function (s) {
      if (shownNetworks[s.icon]) return;
      shownNetworks[s.icon] = true;
      hero.appendChild(socialLink(s, null, [icon(s.icon)]));
    });
    if (!hero.children.length) hero.hidden = true;

    var list = document.getElementById("footer-social");
    entries.forEach(function (s) {
      list.appendChild(h("li", null, [
        socialLink(s, null, [
          icon(s.icon),
          h("span", { class: "s-label", text: s.label }),
          h("span", { class: "s-handle", text: s.handle || "" }),
        ]),
      ]));
    });
    if (!entries.length) list.closest(".footer").querySelector(".eyebrow").hidden = true;
  }

  function renderHeader() {
    document.getElementById("tagline").textContent = CFG.site.tagline || "";
    document.getElementById("year").textContent = String(new Date().getFullYear());

    if (CFG.site.logo) {
      var brand = document.getElementById("brand");
      var img = new Image();
      img.alt = "De Mala y Cuia";
      img.decoding = "async";
      img.onload = function () { brand.replaceChildren(img); };
      img.onerror = function () { console.warn("[DMYC] logo não encontrado:", CFG.site.logo); };
      img.src = CFG.site.logo;
    }
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */
  renderHeader();
  renderResources();
  renderSocial();

  track("bio_visit", {
    utm_source: ATTR.utm.utm_source || "(none)",
    utm_medium: ATTR.utm.utm_medium || "(none)",
    utm_campaign: ATTR.utm.utm_campaign || "(none)",
  });
})();
