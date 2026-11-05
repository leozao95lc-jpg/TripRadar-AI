/*
 * Custo de Vida na Espanha | De Mala y Cuia
 * JavaScript puro, sem dependências. Nenhum dado é salvo (sem cookies/localStorage).
 *
 * Os valores de referência ficam em config.js.
 * Para adicionar/editar uma categoria de gasto, altere a lista CAMPOS abaixo.
 *   escopo: "casa"   -> valor único da moradia
 *           "pessoa" -> valor por pessoa (multiplicado pelo nº de pessoas)
 *   No quarto compartilhado, aluguel e contas passam a ser por pessoa (um quarto cada).
 */
(function () {
  "use strict";

  var CFG = window.CALC_CONFIG || {};

  var CAMPOS = [
    { id: "aluguel", label: "Aluguel", escopo: "casa", cor: "#1F3D2B" },
    { id: "contas", label: "Contas da casa", dica: "Luz, água, gás e internet.", escopo: "casa", cor: "#3E7350" },
    { id: "mercado", label: "Supermercado", dica: "Compras do mês para cozinhar em casa.", escopo: "pessoa", cor: "#E8622C" },
    { id: "transporte", label: "Transporte público", dica: "Passe mensal de metrô/ônibus.", escopo: "pessoa", cor: "#C9A227" },
    { id: "celular", label: "Celular", dica: "Plano mensal de dados.", escopo: "pessoa", cor: "#8FA98F" },
    { id: "lazer", label: "Comer fora e lazer", dica: "Restaurantes, cafés, passeios.", escopo: "pessoa", cor: "#F0A07C" },
    { id: "saude", label: "Seguro saúde", dica: "Plano privado. Coloque 0 se vai usar só o sistema público.", escopo: "pessoa", cor: "#6E8B74" },
    { id: "outros", label: "Outros", dica: "Higiene, academia, roupas, assinaturas.", escopo: "pessoa", cor: "#B9A57A" }
  ];

  var MORADIA = { quarto: "quarto compartilhado", estudio: "estúdio", ap1: "apartamento de 1 quarto", ap2: "apartamento de 2 quartos" };
  var ESTILO = { economico: "econômico", moderado: "moderado", confortavel: "confortável" };

  // ---------- Estado (somente em memória) ----------
  var estado;
  function estadoInicial() {
    var e = {
      etapa: 1, cidade: "Madrid", cidadeOutra: "", moradia: "quarto", pessoas: 1, estilo: "moderado",
      cotacao: CFG.COTACAO_INICIAL || 6.3, valores: {}, editado: {}
    };
    return e;
  }

  // ---------- Utilitários ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  var fmtEUR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var fmtNum = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmtInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  function brl(v) { return fmtBRL.format(Math.round(v)); }
  function eur(v) { return fmtEUR.format(Math.round(v)); }

  function lerNumero(txt) {
    var s = String(txt || "").replace(/[^\d,.]/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function escreverNumero(n) { return n > 0 ? fmtInt.format(n) : ""; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- Referências ----------
  function escopo(c) {
    if ((c.id === "aluguel" || c.id === "contas") && estado.moradia === "quarto") return "pessoa";
    return c.escopo;
  }

  function referencia(id) {
    var cid = (CFG.CIDADES || {})[estado.cidade] || CFG.CIDADES.Outra;
    var pp = CFG.POR_PESSOA || {};
    var est = (CFG.ESTILO || {})[estado.estilo] || 1;
    var arred5 = function (v) { return Math.round(v / 5) * 5; };
    switch (id) {
      case "aluguel": return cid[estado.moradia] || 0;
      case "contas": return (CFG.CONTAS || {})[estado.moradia] || 0;
      case "transporte": return cid.transporte || 0;
      case "celular": return pp.celular || 0;
      case "saude": return pp.saude || 0;
      case "mercado": case "lazer": case "outros": return arred5((pp[id] || 0) * cid.indice * est);
    }
    return 0;
  }

  function aplicarReferencias(forcar) {
    CAMPOS.forEach(function (c) {
      if (forcar || !estado.editado[c.id]) {
        estado.valores[c.id] = referencia(c.id);
        if (forcar) estado.editado[c.id] = false;
      }
    });
  }

  // ---------- Cálculo ----------
  function efetivo(c) {
    var v = estado.valores[c.id] || 0;
    return escopo(c) === "pessoa" ? v * estado.pessoas : v;
  }
  function calcular() {
    var itens = CAMPOS.map(function (c) { return { c: c, v: efetivo(c) }; });
    var totalEUR = itens.reduce(function (s, i) { return s + i.v; }, 0);
    return { itens: itens, totalEUR: totalEUR, totalBRL: totalEUR * estado.cotacao, cot: estado.cotacao };
  }

  // ---------- Renderização ----------
  function nomeCidade() {
    return estado.cidade === "Outra" ? (estado.cidadeOutra.trim() || "outra cidade") : estado.cidade;
  }
  function textoPerfil() {
    var p = estado.pessoas;
    return MORADIA[estado.moradia] + " em " + nomeCidade() + ", " + p + (p === 1 ? " pessoa" : " pessoas") + ", estilo " + ESTILO[estado.estilo];
  }

  function montarCampos() {
    $("#campos").innerHTML = CAMPOS.map(function (c) {
      return '<div class="campo" data-campo="' + c.id + '">' +
        '<div class="campo-topo"><label for="f_' + c.id + '" data-label="' + c.id + '"></label><span class="tag" data-tag="' + c.id + '"></span></div>' +
        '<p class="dica" data-dica="' + c.id + '">' + esc(c.dica || "") + '</p>' +
        '<div class="entrada"><span class="moeda">€</span>' +
        '<input type="text" id="f_' + c.id + '" data-id="' + c.id + '" inputmode="decimal" placeholder="0" autocomplete="off" /></div>' +
        '<p class="calc-linha" data-linha="' + c.id + '"></p></div>';
    }).join("");
  }

  function escreverCampos() {
    CAMPOS.forEach(function (c) {
      var el = $("#f_" + c.id);
      if (document.activeElement !== el) el.value = escreverNumero(estado.valores[c.id]);
    });
  }

  function marcarChips(grupo, valor) {
    $$('[data-chips="' + grupo + '"] button').forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.v === valor ? "true" : "false");
    });
  }
  function sincronizarChips() {
    marcarChips("cidade", estado.cidade);
    marcarChips("moradia", estado.moradia);
    marcarChips("pessoas", estado.pessoas >= 4 ? "4+" : String(estado.pessoas));
    marcarChips("estilo", estado.estilo);
    $("#cidadeOutraBox").hidden = estado.cidade !== "Outra";
    $("#cidadeOutraDica").hidden = estado.cidade !== "Outra";
    $("#pessoasOutroBox").hidden = estado.pessoas < 4;
    $("#dicaQuarto").hidden = !(estado.moradia === "quarto" && estado.pessoas > 1);
  }

  function atualizar() {
    var p = estado.pessoas;
    CAMPOS.forEach(function (c) {
      var porPessoa = escopo(c) === "pessoa";
      var label = c.label;
      if (c.id === "aluguel") label = estado.moradia === "quarto" ? "Aluguel do quarto" : "Aluguel do " + MORADIA[estado.moradia];
      $('[data-label="' + c.id + '"]').textContent = label;
      $('[data-tag="' + c.id + '"]').textContent = porPessoa ? "por pessoa" : "total da casa";
      if (c.id === "aluguel") $('[data-dica="' + c.id + '"]').textContent = estado.moradia === "quarto"
        ? "Quarto em apartamento compartilhado, valor de cada pessoa."
        : "Valor mensal do imóvel inteiro.";
      var ref = referencia(c.id);
      var linha = "";
      if (porPessoa && p > 1 && estado.valores[c.id] > 0) linha = "= " + eur(efetivo(c)) + " para " + p + " pessoas";
      if (estado.editado[c.id] && ref > 0 && Math.round(ref) !== Math.round(estado.valores[c.id] || 0)) {
        linha += (linha ? " · " : "") + "referência: " + eur(ref);
      }
      $('[data-linha="' + c.id + '"]').textContent = linha;
    });
    $("#perfilTxt").textContent = textoPerfil();

    var r = calcular();
    $("#parcial").innerHTML = estado.etapa === 2 && r.totalEUR > 0
      ? "Total por mês: <strong>" + eur(r.totalEUR) + "</strong> · ≈ " + brl(r.totalBRL)
      : "";
    if (estado.etapa === 3) renderResultado(r);
  }

  function renderResultado(r) {
    var p = estado.pessoas;
    $("#resPerfil").textContent = textoPerfil().charAt(0).toUpperCase() + textoPerfil().slice(1);
    $("#totalEUR").textContent = eur(r.totalEUR);
    $("#totalBRL").textContent = "≈ " + brl(r.totalBRL) + " por mês";
    $("#destaqueMsg").textContent = "Esse é o valor estimado para viver um mês em " + nomeCidade() + " morando em " +
      (estado.moradia === "quarto" ? "um quarto compartilhado" : (estado.moradia === "estudio" ? "um estúdio" : "um " + MORADIA[estado.moradia])) + ".";
    $("#porPessoa").textContent = p > 1 ? "Equivale a " + eur(r.totalEUR / p) + " por pessoa" : "";

    $("#proj").innerHTML = [3, 6, 12].map(function (m) {
      return '<div><span>' + m + ' meses</span><strong>' + eur(r.totalEUR * m) + '</strong><em>≈ ' + brl(r.totalBRL * m) + '</em></div>';
    }).join("");

    var max = Math.max.apply(null, r.itens.map(function (i) { return i.v; }).concat([1]));
    var ordenado = r.itens.filter(function (i) { return i.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    $("#barras").innerHTML = ordenado.length ? ordenado.map(function (i) {
      var pct = r.totalEUR > 0 ? Math.round((i.v / r.totalEUR) * 100) : 0;
      return '<li><div class="barra-topo"><span>' + esc(i.c.label) + '</span><span><b>' + eur(i.v) + '</b> · ' + pct + '%</span></div>' +
        '<div class="barra"><i style="width:' + ((i.v / max) * 100).toFixed(1) + '%;background:' + i.c.cor + '"></i></div></li>';
    }).join("") : '<li class="vazio">Preencha alguns valores para ver a distribuição.</li>';
  }

  // ---------- Navegação ----------
  function irPara(n) {
    estado.etapa = n;
    $$(".etapa").forEach(function (s) { s.hidden = Number(s.dataset.etapa) !== n; });
    var res = n === 3;
    $("#resultado").hidden = !res;
    $("#nav").hidden = res;
    $("#progresso").hidden = res;
    if (!res) {
      $("#progressoFill").style.width = (n * 50) + "%";
      $("#progressoTxt").textContent = "Etapa " + n + " de 2";
      $("#btnVoltar").hidden = n === 1;
      $("#btnProximo").textContent = n === 2 ? "Ver resultado" : "Próximo";
    }
    if (n === 2) escreverCampos();
    atualizar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Resumo / compartilhamento ----------
  function linkApp() { return CFG.APP_URL || location.href.split("#")[0].split("?")[0]; }
  function resumoTexto() {
    var r = calcular();
    var l = ["🇪🇸 Meu custo de vida mensal na Espanha", "📍 " + textoPerfil(), ""];
    r.itens.filter(function (i) { return i.v > 0; }).forEach(function (i) { l.push("• " + i.c.label + ": " + eur(i.v)); });
    l.push("", "TOTAL POR MÊS: " + eur(r.totalEUR) + " (≈ " + brl(r.totalBRL) + ")");
    if (estado.pessoas > 1) l.push("Por pessoa: " + eur(r.totalEUR / estado.pessoas));
    l.push("Em 12 meses: " + eur(r.totalEUR * 12));
    l.push("Cotação de simulação: 1 € = R$ " + fmtNum.format(r.cot), "", "Simule o seu com a calculadora De Mala y Cuia:", linkApp());
    return l.join("\n");
  }

  function copiar(texto, msg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      aviso(ok ? msg : "Não foi possível copiar automaticamente.");
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () { aviso(msg); }, fallback);
    } else fallback();
  }

  var toastTimer;
  function aviso(msg) {
    var t = $("#toast");
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2400);
  }

  // ---------- Eventos ----------
  function ligarEventos() {
    document.addEventListener("click", function (ev) {
      var chip = ev.target.closest("[data-chips] button");
      if (!chip) return;
      var g = chip.parentElement.dataset.chips, v = chip.dataset.v;
      if (g === "cidade") estado.cidade = v;
      if (g === "moradia") estado.moradia = v;
      if (g === "estilo") estado.estilo = v;
      if (g === "pessoas") estado.pessoas = v === "4+" ? Math.max(4, Number($("#pessoasOutro").value) || 4) : Number(v);
      aplicarReferencias(false);
      sincronizarChips();
      atualizar();
      if (g === "cidade" && v === "Outra") $("#cidadeOutra").focus();
    });

    document.addEventListener("input", function (ev) {
      var el = ev.target;
      if (el.dataset.id) { estado.valores[el.dataset.id] = lerNumero(el.value); estado.editado[el.dataset.id] = true; }
      else if (el.id === "cotacao") { var c = lerNumero(el.value); if (c > 0) estado.cotacao = c; }
      else if (el.id === "pessoasOutro") estado.pessoas = Math.min(12, Math.max(4, parseInt(el.value, 10) || 4));
      else if (el.id === "cidadeOutra") estado.cidadeOutra = el.value;
      else return;
      atualizar();
    });

    document.addEventListener("focusout", function (ev) {
      var el = ev.target;
      if (el.dataset && el.dataset.id) el.value = escreverNumero(estado.valores[el.dataset.id]);
      else if (el.id === "cotacao") el.value = fmtNum.format(estado.cotacao);
      else if (el.id === "pessoasOutro") el.value = estado.pessoas;
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target.tagName === "INPUT" && estado.etapa < 3) {
        ev.preventDefault(); ev.target.blur(); $("#btnProximo").click();
      }
    });

    $("#btnVoltar").addEventListener("click", function () { if (estado.etapa > 1) irPara(estado.etapa - 1); });
    $("#btnProximo").addEventListener("click", function () {
      if (estado.etapa === 2 && calcular().totalEUR === 0) { aviso("Preencha ao menos um valor."); return; }
      irPara(estado.etapa + 1);
    });
    $("#btnRestaurar").addEventListener("click", function () {
      aplicarReferencias(true); escreverCampos(); atualizar(); aviso("Valores de referência restaurados.");
    });
    $("#btnEditar").addEventListener("click", function () { irPara(2); });

    var armado = null;
    $("#btnRefazer").addEventListener("click", function () {
      var b = this;
      if (!armado) { // confirmação em dois toques (sem pop-up)
        b.textContent = "Toque de novo para apagar";
        armado = setTimeout(function () { armado = null; b.textContent = "Nova simulação"; }, 3000);
        return;
      }
      clearTimeout(armado); armado = null; b.textContent = "Nova simulação";
      estado = estadoInicial(); aplicarReferencias(true);
      sincronizarChips(); $("#cidadeOutra").value = ""; $("#pessoasOutro").value = 4;
      $("#cotacao").value = fmtNum.format(estado.cotacao);
      irPara(1);
    });

    $("#btnCopiar").addEventListener("click", function () { copiar(resumoTexto(), "Resumo copiado! Cole onde quiser."); });
    $("#btnCompartilhar").addEventListener("click", function () {
      var texto = resumoTexto();
      if (navigator.share) {
        navigator.share({ title: "Meu custo de vida na Espanha", text: texto })
          .catch(function (e) { if (!e || e.name !== "AbortError") copiar(texto, "Resumo copiado para compartilhar!"); });
      } else copiar(texto, "Resumo copiado para compartilhar!");
    });
  }

  // ---------- Início ----------
  function iniciar() {
    if (CFG.INSTAGRAM_URL) $("#linkInstagram").href = CFG.INSTAGRAM_URL; else $("#linkInstagram").hidden = true;
    if (CFG.YOUTUBE_URL) $("#linkYoutube").href = CFG.YOUTUBE_URL; else $("#linkYoutube").hidden = true;
    $("#refData").textContent = "referência " + (CFG.REFERENCIA_DATA || "");
    estado = estadoInicial();
    aplicarReferencias(true);
    montarCampos();
    sincronizarChips();
    $("#cotacao").value = fmtNum.format(estado.cotacao);
    ligarEventos();
    irPara(1);
  }

  window.__calc = { calcular: calcular, get estado() { return estado; } };
  iniciar();
})();
