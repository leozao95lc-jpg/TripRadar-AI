/*
 * Motor de cálculo: funções puras, sem DOM. Funciona no navegador (window.Motor)
 * e no Node (module.exports) para testes. Todas as regras estão em METODOLOGIA.md.
 */
(function (raiz) {
  "use strict";

  var CAMADAS = ["essencial", "confortavel", "real"];
  var r5 = function (v) { return Math.round(v / 5) * 5; };

  function contexto(D, e) {
    var cidade = D.cidades.filter(function (c) { return c.id === e.cidade; })[0] || D.cidades[0];
    var tipo = D.tipologias.filter(function (t) { return t.id === e.moradia; })[0] || D.tipologias[0];
    var perfil = D.perfis.filter(function (p) { return p.id === e.perfil; })[0] || D.perfis[0];
    return { D: D, e: e, P: D.parametros, cidade: cidade, tipo: tipo, perfil: perfil,
      adultos: perfil.adultos, criancas: perfil.criancas, pessoas: perfil.adultos + perfil.criancas,
      quarto: tipo.id === "quarto" };
  }

  function fatorZona(cx) {
    if (cx.e.zona === "centro") return cx.cidade.centro_fator || 1;
    if (cx.e.zona === "periferia") return cx.cidade.periferia_fator || 1;
    return 1;
  }

  // Aluguel mensal da moradia inteira (ou do(s) quarto(s)) em um cenário
  function aluguel(cx, camada) {
    var P = cx.P, base;
    if (cx.quarto) base = cx.cidade.quarto * (cx.adultos > 1 ? P.quarto_fator_casal : 1);
    else base = cx.cidade.aluguel_m2 * cx.tipo.m2 * (cx.tipo.premio_m2 || 1);
    base *= fatorZona(cx);
    if (camada === "essencial") base *= P.aluguel_fator_essencial;
    if (camada === "real") base *= 1 + P.premio_recem_chegado;
    return r5(base);
  }

  function aplica(cx, regra) {
    return regra === "todos" || (regra === "apto" && !cx.quarto) || (regra === "quarto" && cx.quarto);
  }

  function valorBase(cx, linha, camada) {
    var v = linha[camada];
    if (typeof v === "string" && v.charAt(0) === "@") v = cx.cidade[v.slice(1)];
    return Number(v) || 0;
  }

  // Custo mensal: linhas por cenário
  function mensal(cx, camada) {
    var e = cx.e, linhas = [], subtotal = 0, pct = [];
    cx.D.itens.forEach(function (it) {
      if (!aplica(cx, it.aplica)) return;
      if (it.opcional === "seguro" && !e.seguro) return;
      if (it.unidade === "pct") { pct.push(it); return; }
      var v;
      if (it.unidade === "aluguel") v = aluguel(cx, camada);
      else {
        v = valorBase(cx, it, camada);
        if (it.escala_cidade === "sim") v *= cx.cidade.fator_custo;
        if (it.id === "luz") v *= cx.cidade.fator_clima_luz;
        if (it.id === "transporte" && e.zona === "periferia") v += cx.cidade.periferia_transporte_extra || 0;
        var mult = { casa: cx.perfil.fator_casa, adulto: cx.adultos, crianca: cx.criancas, pessoa: cx.pessoas }[it.unidade];
        v *= mult == null ? 1 : mult;
        v = Math.round(v);
      }
      var editado = e.overrides && e.overrides[it.id] != null;
      if (editado) v = e.overrides[it.id];
      if (v <= 0 && !editado) return;
      linhas.push({ id: it.id, nome: it.nome, grupo: it.grupo, valor: v, editado: editado, fonte: fonteDe(cx, it), nota: it.nota });
      subtotal += v;
    });
    pct.forEach(function (it) {
      var p = valorBase(cx, it, camada);
      if (p <= 0) return;
      var v = Math.round(subtotal * p);
      linhas.push({ id: it.id, nome: it.nome + " (" + Math.round(p * 100) + "%)", grupo: it.grupo, valor: v, fonte: fonteDe(cx, it), nota: it.nota });
    });
    var total = linhas.reduce(function (s, l) { return s + l.valor; }, 0);
    return { linhas: linhas, total: total };
  }

  function fonteDe(cx, linha) {
    var f = linha.fonte;
    if (f === "@fonte_transporte") f = cx.cidade.fonte_transporte;
    if (linha.id === "aluguel") f = cx.quarto ? cx.cidade.fonte_quarto : cx.cidade.fonte_aluguel_m2;
    if (linha.id === "aluguel" && cx.e.zona !== "cidade" && cx.cidade.fonte_zonas === "estimativa_dmc") f = "estimativa_dmc";
    return f || "estimativa_dmc";
  }

  // ---------- Câmbio efetivo ----------
  function cambioEfetivo(fx) {
    return fx.comercial * (1 + fx.spread / 100) * (1 + fx.iof / 100);
  }

  function calcular(D, e) {
    var cx = contexto(D, e);
    var out = { cx: cx, efetivo: cambioEfetivo(e.fx), camadas: {} };
    CAMADAS.forEach(function (c) { out.camadas[c] = { mensal: mensal(cx, c) }; });
    return out;
  }

  var Motor = { CAMADAS: CAMADAS, calcular: calcular, aluguel: aluguel, contexto: contexto, cambioEfetivo: cambioEfetivo };
  if (typeof module !== "undefined" && module.exports) module.exports = Motor;
  else raiz.Motor = Motor;
})(this);
