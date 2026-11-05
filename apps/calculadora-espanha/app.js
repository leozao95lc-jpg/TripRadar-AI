/*
 * Calculadora de Imigração — Brasil para Espanha | De Mala y Cuia
 * JavaScript puro, sem dependências. Nenhum dado é salvo (sem cookies/localStorage).
 *
 * Para adicionar/editar um campo de custo, altere apenas a lista CAMPOS abaixo.
 *   etapa : 2 (Brasil, em R$) ou 3 (Espanha, em €)
 *   modo  : "fixo"   -> valor total, sem opção por pessoa
 *           "total"  -> padrão total, usuário pode trocar para "por pessoa"
 *           "pessoa" -> padrão por pessoa (multiplica pelo nº de pessoas)
 *           "mala"   -> valor por mala x malas por pessoa x pessoas
 */
(function () {
  "use strict";

  var CFG = window.CALC_CONFIG || {};

  var CAMPOS = [
    // ETAPA 2 — Brasil (R$)
    { id: "passagens", etapa: 2, label: "Passagens aéreas", dica: "Valor total, já somando todas as pessoas.", modo: "fixo" },
    { id: "bagagem", etapa: 2, label: "Bagagem despachada", dica: "Custo por mala. Deixe em branco se já está inclusa na passagem.", modo: "mala" },
    { id: "vistos", etapa: 2, label: "Vistos e taxas consulares", dica: "Conforme o seu tipo de visto.", modo: "pessoa" },
    { id: "apostilamento", etapa: 2, label: "Apostilamentos e traduções juramentadas", dica: "Certidões, diplomas, antecedentes criminais…", modo: "pessoa" },
    { id: "seguro", etapa: 2, label: "Seguro saúde", dica: "Confira a cobertura exigida para o seu tipo de visto.", modo: "pessoa" },
    { id: "outrosDocs", etapa: 2, label: "Outros documentos", dica: "Passaporte, certidões, autenticações…", modo: "total" },
    // ETAPA 3 — Espanha (€)
    { id: "hospedagem", etapa: 3, label: "Hospedagem inicial", dica: "Hotel, hostel ou aluguel temporário nas primeiras semanas.", modo: "total" },
    { id: "caucao", etapa: 3, label: "Caução e entrada do aluguel", dica: "Fiança, primeiro mês e eventual taxa da imobiliária.", modo: "total" },
    { id: "alimentacao", etapa: 3, label: "Alimentação inicial", dica: "Primeiras semanas, antes de usar a reserva mensal.", modo: "total" },
    { id: "transporte", etapa: 3, label: "Transporte", dica: "Saída do aeroporto, passes iniciais, deslocamentos.", modo: "total" },
    { id: "chip", etapa: 3, label: "Chip de celular", dica: "Chip e primeira recarga.", modo: "pessoa" },
    { id: "docEspanha", etapa: 3, label: "Documentação na Espanha", dica: "Taxas, fotos, cópias e trâmites locais.", modo: "pessoa" },
    { id: "outrosEspanha", etapa: 3, label: "Outros gastos iniciais", dica: "Móveis, utensílios, roupas de frio…", modo: "total" }
  ];
  var MOEDA_ETAPA = { 2: "BRL", 3: "EUR" };

  var CORES = { brasil: "#E8622C", espanha: "#3E7350", reserva: "#C9A227", margem: "#1F3D2B" };
  var ICONES = {
    brasil: '<svg viewBox="0 0 24 24"><path d="M2.5 19h19M3 13.5l3.2 1 4.3-1.4-5.6-6 2-.7 8 4.8 4.4-1.5a1.8 1.8 0 0 1 1.2 3.4L6.6 17.3 3 13.5Z"/></svg>',
    espanha: '<svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6"/></svg>',
    reserva: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 10h18"/></svg>',
    margem: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>'
  };

  // ---------- Estado (somente em memória) ----------
  var estado;
  function estadoInicial() {
    var e = {
      etapa: 1,
      pessoas: CFG.PESSOAS_INICIAL || 1,
      malas: CFG.MALAS_INICIAL != null ? CFG.MALAS_INICIAL : 1,
      cidade: "Madrid",
      cidadeOutra: "",
      meses: CFG.MESES_RESERVA_INICIAL || 3,
      mensal: 0,
      cotacao: CFG.COTACAO_INICIAL || 6.3,
      margem: CFG.MARGEM_INICIAL || 0,
      valores: {},
      porPessoa: {}
    };
    CAMPOS.forEach(function (c) {
      e.valores[c.id] = 0;
      e.porPessoa[c.id] = c.modo === "pessoa";
    });
    return e;
  }

  // ---------- Utilitários ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  var fmtEUR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var fmtNum = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function brl(v) { return fmtBRL.format(Math.round(v)); }
  function eur(v) { return fmtEUR.format(Math.round(v)); }

  // Aceita "1.500", "1500,50", "1.500,50", "1500.50"
  function lerNumero(txt) {
    var s = String(txt || "").replace(/[^\d,.]/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function escreverNumero(n) { return n > 0 ? fmtNum.format(n) : ""; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- Cálculo ----------
  // Valor efetivo de um campo, na moeda original do campo
  function valorEfetivo(c) {
    var v = estado.valores[c.id] || 0;
    if (c.modo === "mala") return v * estado.malas * estado.pessoas;
    if (c.modo !== "fixo" && estado.porPessoa[c.id]) return v * estado.pessoas;
    return v;
  }

  function calcular() {
    var cot = estado.cotacao;
    var brasilBRL = 0, espanhaEUR = 0;
    CAMPOS.forEach(function (c) {
      if (c.etapa === 2) brasilBRL += valorEfetivo(c);
      else espanhaEUR += valorEfetivo(c);
    });
    var reservaEUR = estado.meses * estado.mensal; // reserva calculada UMA única vez

    // Tudo convertido para R$ antes de somar (nunca soma R$ com €)
    var brasil = brasilBRL;
    var espanha = espanhaEUR * cot;
    var reserva = reservaEUR * cot;
    var subtotal = brasil + espanha + reserva;
    var margem = subtotal * (estado.margem / 100);
    var total = subtotal + margem;

    return {
      cot: cot,
      brasilBRL: brasilBRL, espanhaEUR: espanhaEUR, reservaEUR: reservaEUR,
      brasil: brasil, espanha: espanha, reserva: reserva, margem: margem,
      totalBRL: total, totalEUR: total / cot
    };
  }

  // ---------- Renderização dos campos ----------
  function montarCampos() {
    [2, 3].forEach(function (etapa) {
      var alvo = $('[data-campos="' + etapa + '"]');
      var simbolo = MOEDA_ETAPA[etapa] === "BRL" ? "R$" : "€";
      alvo.innerHTML = CAMPOS.filter(function (c) { return c.etapa === etapa; }).map(function (c) {
        var modo = (c.modo === "total" || c.modo === "pessoa")
          ? '<div class="modo" data-modo="' + c.id + '" data-so-grupo>' +
              '<button type="button" data-pp="0">Total</button>' +
              '<button type="button" data-pp="1">Por pessoa</button></div>'
          : "";
        return '<div class="campo" data-campo="' + c.id + '">' +
          '<label for="f_' + c.id + '">' + esc(c.label) + '</label>' +
          '<p class="dica">' + esc(c.dica) + '</p>' + modo +
          '<div class="entrada"><span class="moeda">' + simbolo + '</span>' +
          '<input type="text" id="f_' + c.id + '" data-id="' + c.id + '" inputmode="decimal" placeholder="0,00" autocomplete="off" /></div>' +
          '<p class="calc-linha" data-linha="' + c.id + '"></p></div>';
      }).join("");
    });
  }

  function sincronizarFormulario() {
    sincronizarChips();
    $("#pessoasOutro").value = Math.max(4, estado.pessoas);
    $("#malasOutro").value = Math.max(3, estado.malas);
    $("#cidadeOutra").value = estado.cidadeOutra;
    // valores
    CAMPOS.forEach(function (c) { $("#f_" + c.id).value = escreverNumero(estado.valores[c.id]); });
    $("#mensal").value = escreverNumero(estado.mensal);
    $("#cotacao").value = fmtNum.format(estado.cotacao);
  }

  function marcarChips(grupo, valor) {
    $$('[data-chips="' + grupo + '"] button').forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.v === valor ? "true" : "false");
    });
  }

  // Atualiza tudo que depende de valores (linhas auxiliares, parcial, resultado)
  function atualizar() {
    var multi = estado.pessoas > 1;
    CAMPOS.forEach(function (c) {
      var bloco = $('[data-campo="' + c.id + '"]');
      if (c.modo === "mala") bloco.hidden = estado.malas === 0;
      var seletor = $('[data-modo="' + c.id + '"]');
      if (seletor) {
        seletor.hidden = !multi;
        $$("button", seletor).forEach(function (b) {
          b.setAttribute("aria-pressed", (b.dataset.pp === "1") === !!estado.porPessoa[c.id] ? "true" : "false");
        });
      }
      var linha = $('[data-linha="' + c.id + '"]');
      var v = estado.valores[c.id] || 0;
      var fmt = c.etapa === 2 ? brl : eur;
      var txt = "";
      if (v > 0 && c.modo === "mala") {
        var qtd = estado.malas * estado.pessoas;
        txt = "= " + fmt(valorEfetivo(c)) + " (" + qtd + (qtd === 1 ? " mala)" : " malas)");
      } else if (v > 0 && multi && c.modo !== "fixo" && estado.porPessoa[c.id]) {
        txt = "= " + fmt(valorEfetivo(c)) + " para " + estado.pessoas + " pessoas";
      }
      linha.textContent = txt;
    });

    var r = calcular();
    $("#reservaLinha").textContent = estado.mensal > 0
      ? "Reserva: " + estado.meses + " × " + eur(estado.mensal) + " = " + eur(r.reservaEUR) + "  (≈ " + brl(r.reserva) + ")"
      : "";
    $("#parcial").innerHTML = estado.etapa > 1 && r.totalBRL > 0
      ? "Total parcial: <strong>" + brl(r.totalBRL) + "</strong> · " + eur(r.totalEUR)
      : "";

    if (estado.etapa === 5) renderResultado(r);
  }

  function nomeCidade() {
    return estado.cidade === "Outra" ? (estado.cidadeOutra.trim() || "outra cidade") : estado.cidade;
  }

  function renderResultado(r) {
    var p = estado.pessoas;
    $("#resPerfil").textContent = "Destino: " + nomeCidade() + " · " + p + (p === 1 ? " pessoa" : " pessoas") +
      " · cotação de simulação 1 € = R$ " + fmtNum.format(r.cot);
    $("#totalBRL").textContent = brl(r.totalBRL);
    $("#totalEUR").textContent = "≈ " + eur(r.totalEUR);
    $("#porPessoa").textContent = p > 1 ? "Equivale a " + brl(r.totalBRL / p) + " por pessoa" : "";

    var itens = [
      { k: "brasil", t: "Gastos no Brasil", d: "Passagens e documentação", pri: brl(r.brasil), sec: "≈ " + eur(r.brasil / r.cot), v: r.brasil },
      { k: "espanha", t: "Gastos iniciais na Espanha", d: "Chegada e instalação", pri: eur(r.espanhaEUR), sec: "≈ " + brl(r.espanha), v: r.espanha },
      { k: "reserva", t: "Reserva financeira", d: estado.meses + (estado.meses === 1 ? " mês" : " meses") + " × " + eur(estado.mensal), pri: eur(r.reservaEUR), sec: "≈ " + brl(r.reserva), v: r.reserva }
    ];
    if (estado.margem > 0) {
      itens.push({ k: "margem", t: "Margem para imprevistos", d: "+" + estado.margem + "% sobre o total", pri: brl(r.margem), sec: "≈ " + eur(r.margem / r.cot), v: r.margem });
    }

    $("#blocos").innerHTML = itens.map(function (i) {
      return '<div class="bloco"><div class="bloco-ico" style="background:' + CORES[i.k] + '">' + ICONES[i.k] + '</div>' +
        '<div class="bloco-txt"><p class="bloco-titulo">' + i.t + '</p><p class="bloco-detalhe">' + esc(i.d) + '</p></div>' +
        '<div class="bloco-val"><strong>' + i.pri + '</strong><span>' + i.sec + '</span></div></div>';
    }).join("");

    // Gráfico de rosca (SVG puro; circunferência normalizada para 100)
    var soma = r.totalBRL;
    var donut = '<circle cx="21" cy="21" r="15.915" stroke="#F4EBDD"></circle>';
    var leg = "";
    if (soma > 0) {
      var acum = 0;
      itens.forEach(function (i) {
        var pct = (i.v / soma) * 100;
        if (pct > 0) {
          donut += '<circle cx="21" cy="21" r="15.915" stroke="' + CORES[i.k] + '" stroke-dasharray="' + pct.toFixed(3) + " " + (100 - pct).toFixed(3) + '" stroke-dashoffset="' + (-acum).toFixed(3) + '"></circle>';
          acum += pct;
        }
        leg += '<li><i style="background:' + CORES[i.k] + '"></i>' + i.t.replace("Gastos iniciais na", "Chegada na").replace("Gastos no", "Saída do") + "<b>" + Math.round(pct) + "%</b></li>";
      });
    } else {
      leg = '<li class="vazio">Preencha alguns valores para ver a distribuição.</li>';
    }
    $("#donut").innerHTML = donut;
    $("#legenda").innerHTML = leg;
  }

  // ---------- Navegação ----------
  function irPara(n) {
    estado.etapa = n;
    $$(".etapa").forEach(function (s) { s.hidden = Number(s.dataset.etapa) !== n; });
    var noResultado = n === 5;
    $("#resultado").hidden = !noResultado;
    $("#nav").hidden = noResultado;
    $("#progresso").hidden = noResultado;
    if (!noResultado) {
      $("#progressoFill").style.width = (n * 25) + "%";
      $("#progressoTxt").textContent = "Etapa " + n + " de 4";
      $("#btnVoltar").hidden = n === 1;
      $("#btnProximo").textContent = n === 4 ? "Calcular" : "Próximo";
    }
    atualizar();
    $(".topo").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Resumo / compartilhamento ----------
  function linkApp() { return CFG.APP_URL || location.href.split("#")[0].split("?")[0]; }

  function resumoTexto() {
    var r = calcular();
    var p = estado.pessoas;
    var l = [
      "🇧🇷➡️🇪🇸 Meu planejamento para imigrar para a Espanha",
      "📍 " + nomeCidade() + " · " + p + (p === 1 ? " pessoa" : " pessoas"),
      "",
      "✈️ Gastos no Brasil: " + brl(r.brasil) + " (≈ " + eur(r.brasil / r.cot) + ")",
      "🏠 Gastos iniciais na Espanha: " + eur(r.espanhaEUR) + " (≈ " + brl(r.espanha) + ")",
      "💰 Reserva (" + estado.meses + (estado.meses === 1 ? " mês" : " meses") + "): " + eur(r.reservaEUR) + " (≈ " + brl(r.reserva) + ")"
    ];
    if (estado.margem > 0) l.push("🛟 Margem para imprevistos (+" + estado.margem + "%): " + brl(r.margem));
    l.push("", "TOTAL ESTIMADO: " + brl(r.totalBRL) + " | " + eur(r.totalEUR));
    if (p > 1) l.push("Por pessoa: " + brl(r.totalBRL / p));
    l.push("Cotação de simulação: 1 € = R$ " + fmtNum.format(r.cot), "", "Simule a sua com a calculadora De Mala y Cuia:", linkApp());
    return l.join("\n");
  }

  function copiar(texto, msg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); aviso(msg); } catch (e) { aviso("Não foi possível copiar automaticamente."); }
      document.body.removeChild(ta);
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
    // chips (delegação)
    document.addEventListener("click", function (ev) {
      var chip = ev.target.closest("[data-chips] button");
      if (chip) {
        var g = chip.parentElement.dataset.chips, v = chip.dataset.v;
        if (g === "pessoas") estado.pessoas = v === "4+" ? Math.max(4, Number($("#pessoasOutro").value) || 4) : Number(v);
        if (g === "malas") estado.malas = v === "3+" ? Math.max(3, Number($("#malasOutro").value) || 3) : Number(v);
        if (g === "cidade") estado.cidade = v;
        if (g === "meses") estado.meses = Number(v);
        if (g === "margem") estado.margem = Number(v);
        sincronizarChips();
        atualizar();
        if (g === "pessoas" && v === "4+") $("#pessoasOutro").focus();
        if (g === "cidade" && v === "Outra") $("#cidadeOutra").focus();
        return;
      }
      var pp = ev.target.closest("[data-modo] button");
      if (pp) {
        estado.porPessoa[pp.parentElement.dataset.modo] = pp.dataset.pp === "1";
        atualizar();
      }
    });

    // valores (atualização automática)
    document.addEventListener("input", function (ev) {
      var el = ev.target;
      if (el.dataset.id) estado.valores[el.dataset.id] = lerNumero(el.value);
      else if (el.id === "mensal") estado.mensal = lerNumero(el.value);
      else if (el.id === "cotacao") { var c = lerNumero(el.value); if (c > 0) estado.cotacao = c; }
      else if (el.id === "pessoasOutro") estado.pessoas = Math.min(20, Math.max(4, parseInt(el.value, 10) || 4));
      else if (el.id === "malasOutro") estado.malas = Math.min(10, Math.max(3, parseInt(el.value, 10) || 3));
      else if (el.id === "cidadeOutra") estado.cidadeOutra = el.value;
      else return;
      atualizar();
    });

    // formata ao sair do campo
    document.addEventListener("focusout", function (ev) {
      var el = ev.target;
      if (el.dataset && el.dataset.id) el.value = escreverNumero(estado.valores[el.dataset.id]);
      else if (el.id === "mensal") el.value = escreverNumero(estado.mensal);
      else if (el.id === "cotacao") el.value = fmtNum.format(estado.cotacao);
      else if (el.id === "pessoasOutro") el.value = estado.pessoas;
      else if (el.id === "malasOutro") el.value = estado.malas;
    });

    // Enter avança
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target.tagName === "INPUT" && estado.etapa < 5) {
        ev.preventDefault(); ev.target.blur(); $("#btnProximo").click();
      }
    });

    $("#btnVoltar").addEventListener("click", function () { if (estado.etapa > 1) irPara(estado.etapa - 1); });
    $("#btnProximo").addEventListener("click", function () {
      if (estado.etapa === 4 && calcular().totalBRL === 0) {
        aviso("Preencha ao menos um valor para calcular.");
        return;
      }
      irPara(estado.etapa + 1);
    });
    $("#btnEditar").addEventListener("click", function () { irPara(2); });
    var refazerArmado = null;
    $("#btnRefazer").addEventListener("click", function () {
      var b = this;
      if (!refazerArmado) { // confirmação em dois toques (sem pop-up)
        b.textContent = "Toque de novo para apagar";
        refazerArmado = setTimeout(function () { refazerArmado = null; b.textContent = "Refazer simulação"; }, 3000);
        return;
      }
      clearTimeout(refazerArmado); refazerArmado = null; b.textContent = "Refazer simulação";
      estado = estadoInicial();
      sincronizarFormulario();
      irPara(1);
    });
    $("#btnCopiar").addEventListener("click", function () { copiar(resumoTexto(), "Resumo copiado! Cole onde quiser."); });
    $("#btnCompartilhar").addEventListener("click", function () {
      var texto = resumoTexto();
      if (navigator.share) {
        navigator.share({ title: "Meu planejamento para imigrar para a Espanha", text: texto })
          .catch(function (e) { if (e && e.name !== "AbortError") copiar(texto, "Resumo copiado para compartilhar!"); });
      } else copiar(texto, "Resumo copiado para compartilhar!");
    });
  }

  function sincronizarChips() {
    marcarChips("pessoas", estado.pessoas >= 4 ? "4+" : String(estado.pessoas));
    marcarChips("malas", estado.malas >= 3 ? "3+" : String(estado.malas));
    var lista = ["Madrid", "Valencia", "Barcelona", "Alicante", "Málaga"];
    marcarChips("cidade", lista.indexOf(estado.cidade) >= 0 ? estado.cidade : "Outra");
    marcarChips("meses", String(estado.meses));
    marcarChips("margem", String(estado.margem));
    $("#pessoasOutroBox").hidden = estado.pessoas < 4;
    $("#malasOutroBox").hidden = estado.malas < 3;
    $("#cidadeOutraBox").hidden = estado.cidade !== "Outra";
  }

  // ---------- Início ----------
  function iniciar() {
    if (CFG.INSTAGRAM_URL) $("#linkInstagram").href = CFG.INSTAGRAM_URL; else $("#linkInstagram").hidden = true;
    if (CFG.YOUTUBE_URL) $("#linkYoutube").href = CFG.YOUTUBE_URL; else $("#linkYoutube").hidden = true;
    estado = estadoInicial();
    montarCampos();
    sincronizarFormulario();
    ligarEventos();
    irPara(1);
  }

  // Exposto apenas para testes automatizados
  window.__calc = { calcular: calcular, lerNumero: lerNumero, get estado() { return estado; } };

  iniciar();
})();
