/*
 * Interface da calculadora: estado em memória → Motor.calcular → render().
 * Regras de cálculo ficam em engine.js; valores em data/*.csv (gerados em data.js).
 * A simulação não é salva (sem cookies/localStorage). Só o formulário de lead envia dados, com consentimento.
 */
(function () {
  "use strict";

  var CFG = window.CALC_CONFIG || {};
  var D = window.CALC_DATA;
  var M = window.Motor;
  var P = D.parametros;

  var NOMES = { essencial: "Essencial", confortavel: "Confortável", real: "Real" };
  var CURTO = { essencial: "Essen.", confortavel: "Confort.", real: "Real" };
  var DESC = {
    essencial: "O piso: sem lazer pago, aluguel abaixo da média.",
    confortavel: "Vida normal de classe média.",
    real: "Como recém-chegados gastam de fato, com imprevistos."
  };
  var TIPO_SELO = { oficial: ["fonte", "fonte"], portal: ["fonte", "fonte"], estimativa: ["estimativa", "estimativa"], terceiro: ["terceiro", "terceiro"], imprensa: ["imprensa", "imprensa"] };

  // ---------- Estado ----------
  var cambioPadrao = D.cambio[0];
  var e = {
    cidade: D.cidades[0].id, moradia: "quarto", zona: "cidade", perfil: "solo", seguro: false,
    camada: "confortavel", overrides: {},
    fx: { metodo: cambioPadrao.id, comercial: P.cotacao_fallback, spread: cambioPadrao.spread_pct, iof: cambioPadrao.iof_pct }
  };
  var fxOrigem = "Cotação de referência de " + P.cotacao_fallback_data + " (não é tempo real).";
  var fxEditado = false;
  var editando = null;
  var R; // último resultado

  // ---------- Utilitários ----------
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var fE = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var fR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  var fN = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  var fN1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  var fFx = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  function eur(v) { return fE.format(Math.round(v)); }
  function brl(v) { return fR.format(Math.round(v)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lerNumero(txt) {
    var s = String(txt || "").replace(/[^\d,.]/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) && n >= 0 ? n : 0;
  }
  function selo(fonteId) {
    if (fonteId === "seu") return '<span class="selo seu">seu valor</span>';
    var f = D.fontes[fonteId] || D.fontes.estimativa_dmc;
    var t = TIPO_SELO[f.tipo] || TIPO_SELO.estimativa;
    return '<span class="selo ' + t[0] + '" title="' + esc(f.titulo) + '">' + t[1] + "</span>";
  }
  function setChips(grupo, valor) {
    $$('[data-chips="' + grupo + '"] button').forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.v === String(valor) ? "true" : "false"); });
  }
  function perfilAtual() { return D.perfis.filter(function (p) { return p.id === e.perfil; })[0]; }

  // ---------- Montagem inicial ----------
  function montar() {
    $("#chipsCidade").innerHTML = D.cidades.map(function (c) { return '<button type="button" data-v="' + c.id + '">' + esc(c.nome) + "</button>"; }).join("");
    $("#chipsMoradia").innerHTML = D.tipologias.map(function (t) { return '<button type="button" data-v="' + t.id + '">' + esc(t.nome) + "</button>"; }).join("");
    $("#chipsPerfil").innerHTML = D.perfis.map(function (p) { return '<button type="button" data-v="' + p.id + '">' + esc(p.nome) + "</button>"; }).join("");
    $("#chipsMetodo").innerHTML = D.cambio.map(function (c) { return '<button type="button" data-v="' + c.id + '">' + esc(c.nome) + "</button>"; }).join("");
    $("#tLead").textContent = CFG.LEAD_TITULO || "Receba seu plano";
    $("#leadTexto").textContent = CFG.LEAD_TEXTO || "";
    if (CFG.INSTAGRAM_URL) $("#linkInstagram").href = CFG.INSTAGRAM_URL; else $("#linkInstagram").hidden = true;
    if (CFG.YOUTUBE_URL) $("#linkYoutube").href = CFG.YOUTUBE_URL; else $("#linkYoutube").hidden = true;
    escreverFx();
    renderFontes();
  }

  function escreverFx() {
    $("#fxComercial").value = fN.format(e.fx.comercial);
    $("#fxSpread").value = fN.format(e.fx.spread);
    $("#fxIof").value = fN.format(e.fx.iof);
  }

  // ---------- Render ----------
  function render() {
    var perfil = perfilAtual();
    if (perfil.criancas > 0 && e.moradia === "quarto") e.moradia = "ap2";
    R = M.calcular(D, e);
    var cx = R.cx, cid = cx.cidade;

    // chips
    setChips("cidade", e.cidade); setChips("moradia", e.moradia); setChips("zona", e.zona); setChips("perfil", e.perfil);
    setChips("seguro", e.seguro ? "sim" : "nao"); setChips("metodo", e.fx.metodo);
    $$('[data-chips="moradia"] button').forEach(function (b) { b.disabled = b.dataset.v === "quarto" && perfil.criancas > 0; });
    $("#zonaDica").textContent = e.zona === "centro" ? "Ex.: " + cid.centro_ref + ". Aluguel " + Math.round((cid.centro_fator - 1) * 100) + "% acima da média."
      : e.zona === "periferia" ? "Ex.: " + cid.periferia_ref + ". Aluguel " + Math.round((1 - cid.periferia_fator) * 100) + "% menor, mas o passe de transporte custa +" + eur(cid.periferia_transporte_extra) + " por adulto."
      : "Bairros residenciais típicos, na média da cidade.";

    var zonaTxt = { centro: "no centro de ", cidade: "em ", periferia: "na região metropolitana de " }[e.zona];
    var perfilTxt = cx.tipo.nome + " " + zonaTxt + cid.nome + " · " + perfil.nome.toLowerCase() + (e.seguro ? " · com seguro privado" : "");
    $("#perfilTxt").textContent = perfilTxt;

    renderTabela(); renderFx();
  }

  // Tudo o que depende do câmbio (a tabela é só em euros e não precisa ser redesenhada)
  function renderFx() {
    R = M.calcular(D, e);
    var sel = R.camadas[e.camada].mensal.total;
    $("#heroMeta").textContent = "Aluguéis: Idealista, jun/2026 · revisão dos valores: " + P.data_atualizacao + " · " + D.cidades.length + " cidades";
    renderCamadas(); renderCambio();
    $("#barraFixa").innerHTML = "<div><span>" + NOMES[e.camada] + "</span> · " + esc(R.cx.cidade.nome) + "<br>≈ " + brl(sel * R.efetivo) + "/mês</div><b>" + eur(sel) + "</b>";
  }

  function renderCamadas() {
    $("#camadas").innerHTML = M.CAMADAS.map(function (c) {
      var t = R.camadas[c].mensal.total;
      return '<button type="button" class="camada" role="radio" data-camada="' + c + '" aria-checked="' + (c === e.camada) + '">' +
        '<span class="c-nome">' + NOMES[c] + '</span><span class="c-eur">' + eur(t) + '</span>' +
        '<span class="c-brl">≈ ' + brl(t * R.efetivo) + " por mês</span>" +
        '<span class="c-desc">' + DESC[c] + "</span></button>";
    }).join("");
  }

  function renderTabela() {
    var mapa = {}, ordem = [];
    M.CAMADAS.forEach(function (c) {
      R.camadas[c].mensal.linhas.forEach(function (l) {
        var base = l.id.replace(/ \(.*/, "");
        if (!mapa[base]) { mapa[base] = { id: base, nome: l.nome, grupo: l.grupo, fonte: l.fonte, nota: l.nota, editado: l.editado, v: {} }; ordem.push(base); }
        mapa[base].v[c] = l.valor;
        if (l.id === "imprevistos") mapa[base].nome = l.nome;
      });
    });
    var idx = {}; D.itens.forEach(function (it, i) { idx[it.id] = i; });
    ordem.sort(function (a, b) { return idx[a] - idx[b]; });

    var html = "<thead><tr><th>Item</th>" + M.CAMADAS.map(function (c) {
      return '<th class="' + (c === e.camada ? "sel" : "") + '"><span class="th-longo">' + NOMES[c] + '</span><span class="th-curto">' + CURTO[c] + "</span></th>";
    }).join("") + "</tr></thead><tbody>";
    var grupoAtual = null;
    ordem.forEach(function (id) {
      var l = mapa[id];
      if (l.grupo !== grupoAtual) { grupoAtual = l.grupo; html += '<tr class="grupo-linha"><td colspan="4">' + esc(l.grupo) + "</td></tr>"; }
      var podeEditar = id !== "imprevistos";
      html += '<tr><td class="nome"><span class="nome-linha">' + esc(l.nome) + " " + selo(l.editado ? "seu" : l.fonte) +
        (podeEditar ? ' <button type="button" class="editar" data-editar="' + id + '">' + (l.editado ? "alterar" : "editar") + "</button>" : "") + "</span>" +
        (l.nota && !l.editado ? '<span class="nota">' + esc(l.nota) + "</span>" : "") + "</td>" +
        M.CAMADAS.map(function (c) { return '<td class="' + (c === e.camada ? "sel" : "") + '">' + (l.v[c] ? eur(l.v[c]) : "–") + "</td>"; }).join("") + "</tr>";
      if (editando === id) {
        html += '<tr class="edit-row"><td colspan="4"><div class="edit-box"><label for="ov_' + id + '">Seu valor mensal total (€), vale para os 3 cenários:</label>' +
          '<input id="ov_' + id + '" data-override="' + id + '" inputmode="decimal" value="' + (l.editado ? fN.format(e.overrides[id]) : "") + '" placeholder="' + fN.format(l.v[e.camada] || 0) + '" />' +
          '<button type="button" class="editar" data-limpar="' + id + '">usar referência</button>' +
          '<button type="button" class="editar" data-fechar="1">fechar</button></div></td></tr>';
      }
    });
    html += "</tbody><tfoot><tr><td>Total por mês</td>" + M.CAMADAS.map(function (c) {
      return '<td class="' + (c === e.camada ? "sel" : "") + '">' + eur(R.camadas[c].mensal.total) + "</td>";
    }).join("") + "</tr></tfoot>";
    $("#tabela").innerHTML = html;
  }

  function renderCambio() {
    var ef = R.efetivo, sobre = (ef / e.fx.comercial - 1) * 100;
    var mensal = R.camadas[e.camada].mensal.total;
    $("#fxOrigem").textContent = fxOrigem;
    $("#fxRes").innerHTML =
      '<div class="kpi"><span>Cotação comercial</span><strong>R$ ' + fFx.format(e.fx.comercial) + "</strong><em>1 euro hoje</em></div>" +
      '<div class="kpi"><span>Você paga</span><strong>R$ ' + fFx.format(ef) + "</strong><em>com spread e IOF (+" + fN1.format(sobre) + "%)</em></div>" +
      '<div class="kpi fx-total"><span>Seu custo mensal (' + NOMES[e.camada] + ")</span><strong>" + brl(mensal * ef) + "</strong><em>" + eur(mensal) + " × R$ " + fFx.format(ef) + "</em></div>";
  }

  function renderFontes() {
    $("#fontesData").textContent = "Valores revisados em " + P.data_atualizacao + ". Cada fonte mostra a data do dado original, e cada linha da tabela diz se o valor tem fonte publicada ou é estimativa.";
    $("#listaFontes").innerHTML = Object.keys(D.fontes).map(function (k) {
      var f = D.fontes[k], t = TIPO_SELO[f.tipo] || TIPO_SELO.estimativa;
      return '<li><span class="selo ' + t[0] + '">' + t[1] + "</span>" + (f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.titulo) + "</a>" : "<span>" + esc(f.titulo) + "</span>") +
        '<span class="f-data">' + esc(f.data || "") + "</span></li>";
    }).join("");
  }

  // ---------- Câmbio ao vivo ----------
  // AwesomeAPI (cotação comercial, atualiza ao longo do dia); se falhar, BCE via Frankfurter.
  function pegarJson(url) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 5000);
    return fetch(url, ctrl ? { signal: ctrl.signal, cache: "no-store" } : {}).then(function (r) {
      clearTimeout(t); if (!r.ok) throw new Error("http"); return r.json();
    });
  }
  function aplicarCotacao(v, origem) {
    if (!(v > 0) || fxEditado) return;
    e.fx.comercial = v; fxOrigem = origem;
    if (document.activeElement !== $("#fxComercial")) $("#fxComercial").value = fN.format(v);
    renderFx();
  }
  function buscarCambio() {
    if (!CFG.CAMBIO_AO_VIVO || !window.fetch || document.hidden) return;
    pegarJson("https://economia.awesomeapi.com.br/json/last/EUR-BRL").then(function (j) {
      var q = j && j.EURBRL, v = q && parseFloat(q.bid);
      if (!v) throw new Error("vazio");
      var quando = q.create_date ? q.create_date.slice(8, 10) + "/" + q.create_date.slice(5, 7) + " às " + q.create_date.slice(11, 16) : "agora";
      aplicarCotacao(v, "Cotação comercial atualizada automaticamente (" + quando + ", AwesomeAPI).");
    }).catch(function () {
      return pegarJson("https://api.frankfurter.app/latest?from=EUR&to=BRL").then(function (j) {
        var d = (j.date || "").split("-").reverse().join("/");
        aplicarCotacao(j && j.rates && j.rates.BRL, "Cotação comercial do Banco Central Europeu de " + d + ", atualizada automaticamente.");
      });
    }).catch(function () { /* mantém a cotação de referência da planilha */ });
  }

  // ---------- Resumo / compartilhar ----------
  function resumo() {
    var s = R.camadas[e.camada];
    var l = [
      "🇪🇸 Meu custo de vida na Espanha (cenário " + NOMES[e.camada] + ")",
      "📍 " + $("#perfilTxt").textContent, "",
      "Custo mensal: " + eur(s.mensal.total) + " (≈ " + brl(s.mensal.total * R.efetivo) + ")",
      "Essencial " + eur(R.camadas.essencial.mensal.total) + " · Confortável " + eur(R.camadas.confortavel.mensal.total) + " · Real " + eur(R.camadas.real.mensal.total),
      "Câmbio efetivo usado: R$ " + fFx.format(R.efetivo), "",
      "Simule o seu na calculadora De Mala y Cuia:", CFG.APP_URL || location.href.split("#")[0].split("?")[0]
    ];
    return l.join("\n");
  }
  function copiar(texto, msg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (x) { ok = false; }
      document.body.removeChild(ta);
      aviso(ok ? msg : "Não foi possível copiar automaticamente.");
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(function () { aviso(msg); }, fallback);
    else fallback();
  }
  var toastT;
  function aviso(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }

  // ---------- Lead ----------
  function enviarLead(ev) {
    ev.preventDefault();
    var msg = $("#leadMsg"), btn = $("#leadBtn");
    var email = $("#leadEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = "Confira o e-mail: ele parece incompleto."; $("#leadEmail").focus(); return; }
    if (!$("#leadConsent").checked) { msg.textContent = "Marque a autorização para podermos enviar a amostra."; return; }
    if ($('#leadForm [name="bot-field"]').value) return;
    var s = R.camadas[e.camada], q = new URLSearchParams(location.search);
    var dados = {
      nome: $("#leadNome").value.trim(), email: email, whatsapp: $("#leadWhats").value.trim(), consentimento: "sim " + new Date().toISOString(),
      cidade: R.cx.cidade.nome, moradia: R.cx.tipo.nome, zona: e.zona, perfil: perfilAtual().nome, cenario: NOMES[e.camada],
      custo_mensal_eur: Math.round(s.mensal.total), custo_mensal_brl: Math.round(s.mensal.total * R.efetivo), material: CFG.LEAD_MATERIAL || "",
      utm_source: q.get("utm_source") || "", utm_medium: q.get("utm_medium") || "", utm_campaign: q.get("utm_campaign") || ""
    };
    btn.disabled = true; msg.textContent = "Enviando…";
    var envio;
    var ml = CFG.LEAD_MODO === "mailerlite" && CFG.MAILERLITE_ACCOUNT_ID && CFG.MAILERLITE_FORM_ID;
    if (ml) {
      // Formulário embutido do MailerLite: mesmo envio que o código de incorporação dele faz (sem chave de API na página).
      var mlCorpo = new URLSearchParams();
      mlCorpo.append("fields[email]", dados.email);
      if (dados.nome) mlCorpo.append("fields[name]", dados.nome);
      if (dados.whatsapp) mlCorpo.append("fields[phone]", dados.whatsapp);
      (CFG.MAILERLITE_CAMPOS_EXTRAS || []).forEach(function (k) { if (dados[k] !== undefined && dados[k] !== "") mlCorpo.append("fields[" + k + "]", dados[k]); });
      mlCorpo.append("ml-submit", "1"); mlCorpo.append("anticsrf", "true");
      envio = fetch("https://assets.mailerlite.com/jsonp/" + CFG.MAILERLITE_ACCOUNT_ID + "/forms/" + CFG.MAILERLITE_FORM_ID + "/subscribe",
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: mlCorpo.toString() })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j && j.success !== false }; }); });
    } else if (CFG.LEAD_MODO === "netlify" || CFG.LEAD_MODO === "mailerlite") { // MailerLite sem IDs: guarda no Netlify
      var corpo = new URLSearchParams(dados); corpo.append("form-name", "leads");
      envio = fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: corpo.toString() });
    } else if (CFG.LEAD_MODO === "endpoint" && CFG.LEAD_ENDPOINT) {
      envio = fetch(CFG.LEAD_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(dados) });
    } else {
      envio = new Promise(function (ok) { setTimeout(function () { ok({ ok: true, demo: true }); }, 500); });
    }
    envio.then(function (r) {
      if (r && r.ok === false) throw new Error("http");
      $("#leadForm").reset();
      msg.innerHTML = (r && r.demo ? "Modo demonstração: nada foi enviado. " : "") + "Pronto! O capítulo 9 chega no seu e-mail em alguns minutos. Se não aparecer, confira a caixa de spam ou Promoções." +
        (CFG.HOTMART_URL ? ' <a href="' + esc(CFG.HOTMART_URL) + '" target="_blank" rel="noopener">Conheça o e-book completo.</a>' : "") +
        (CFG.WHATSAPP_GRUPO_URL ? ' <a href="' + esc(CFG.WHATSAPP_GRUPO_URL) + '" target="_blank" rel="noopener">Entre também na comunidade.</a>' : "");
    }).catch(function () {
      msg.textContent = "Não conseguimos enviar agora. Verifique sua conexão e tente de novo.";
    }).then(function () { btn.disabled = false; });
  }

  // ---------- Eventos ----------
  function ligar() {
    document.addEventListener("click", function (ev) {
      var t = ev.target;
      var chip = t.closest("[data-chips] button");
      if (chip && !chip.disabled) {
        var g = chip.parentElement.dataset.chips, v = chip.dataset.v;
        if (g === "seguro") e.seguro = v === "sim";
        else if (g === "metodo") {
          var m = D.cambio.filter(function (c) { return c.id === v; })[0];
          e.fx.metodo = v; if (v !== "personalizado") { e.fx.spread = m.spread_pct; e.fx.iof = m.iof_pct; }
          escreverFx();
        } else e[g] = v;
        if (g === "cidade" || g === "moradia" || g === "perfil" || g === "zona") {
          editando = null;
          if (Object.keys(e.overrides).length) { e.overrides = {}; aviso("Seus valores editados voltaram para a referência, porque o perfil mudou."); }
        }
        render(); return;
      }
      var cam = t.closest("[data-camada]");
      if (cam) { e.camada = cam.dataset.camada; render(); return; }
      if (t.dataset.editar) { editando = editando === t.dataset.editar ? null : t.dataset.editar; render(); var inp = $("#ov_" + editando); if (inp) inp.focus(); return; }
      if (t.dataset.limpar) { delete e.overrides[t.dataset.limpar]; editando = null; render(); return; }
      if (t.dataset.fechar) { editando = null; render(); return; }
    });

    document.addEventListener("change", function (ev) {
      var t = ev.target;
      if (t.dataset && t.dataset.override) {
        var txt = t.value.trim();
        if (txt === "") delete e.overrides[t.dataset.override]; else e.overrides[t.dataset.override] = lerNumero(txt);
        editando = null; render();
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target.dataset && ev.target.dataset.override) { ev.preventDefault(); ev.target.blur(); }
    });

    function numInput(id, fn) {
      $(id).addEventListener("input", function () { fn(lerNumero(this.value)); setChips("metodo", e.fx.metodo); renderFx(); });
    }
    numInput("#fxComercial", function (v) { if (v > 0) { e.fx.comercial = v; fxEditado = true; fxOrigem = "Cotação informada por você."; } });
    numInput("#fxSpread", function (v) { e.fx.spread = v; e.fx.metodo = "personalizado"; });
    numInput("#fxIof", function (v) { e.fx.iof = v; e.fx.metodo = "personalizado"; });
    $("#fxComercial").addEventListener("blur", function () { this.value = fN.format(e.fx.comercial); });

    $("#leadForm").addEventListener("submit", enviarLead);
    $("#btnCopiar").addEventListener("click", function () { copiar(resumo(), "Resumo copiado!"); });
    $("#btnCompartilhar").addEventListener("click", function () {
      var txt = resumo();
      if (navigator.share) navigator.share({ title: "Meu custo de vida na Espanha", text: txt }).catch(function (x) { if (!x || x.name !== "AbortError") copiar(txt, "Resumo copiado para compartilhar!"); });
      else copiar(txt, "Resumo copiado para compartilhar!");
    });
  }

  montar();
  ligar();
  render();
  buscarCambio();
  if (CFG.CAMBIO_AO_VIVO && CFG.CAMBIO_ATUALIZAR_MIN) setInterval(buscarCambio, CFG.CAMBIO_ATUALIZAR_MIN * 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) buscarCambio(); });
  window.__app = { get estado() { return e; }, get resultado() { return R; } };
})();
