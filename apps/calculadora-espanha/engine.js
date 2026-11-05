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

  // Aluguel usado nos cálculos: o valor informado pelo usuário, se houver
  function aluguelEfetivo(cx, camada) {
    var o = cx.e.overrides && cx.e.overrides.aluguel;
    return o != null ? o : aluguel(cx, camada);
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

  // Custo de chegada (pagamento único)
  function chegada(cx, camada) {
    var linhas = [];
    cx.D.chegada.forEach(function (c) {
      if (!aplica(cx, c.aplica)) return;
      var q = valorBase(cx, c, camada), v = 0;
      switch (c.regra) {
        case "meses_aluguel": v = q * aluguelEfetivo(cx, camada); break;
        case "noites": v = q * cx.cidade.hospedagem_noite * cx.perfil.fator_casa / 0.8; break; // solo = 1 diária
        case "enxoval": v = cx.tipo["enxoval_" + camada] || 0; break;
        case "pessoa": v = q * cx.pessoas; break;
        case "adulto": v = q * cx.adultos; break;
        default: v = q;
      }
      linhas.push({ id: c.id, nome: c.nome, valor: Math.round(v), fonte: c.fonte || "estimativa_dmc", nota: c.nota, zero: v === 0 });
    });
    return { linhas: linhas, total: linhas.reduce(function (s, l) { return s + l.valor; }, 0) };
  }

  // ---------- Câmbio efetivo ----------
  function cambioEfetivo(fx) {
    return fx.comercial * (1 + fx.spread / 100) * (1 + fx.iof / 100);
  }

  // ---------- IRPF simplificado (solteiro, sem filhos, 12 ou 14 pagas: anual) ----------
  function escala(D, base) {
    var imposto = 0, piso = 0;
    for (var i = 0; i < D.irpf.length; i++) {
      var teto = D.irpf[i].ate == null ? Infinity : D.irpf[i].ate;
      if (base > piso) imposto += (Math.min(base, teto) - piso) * D.irpf[i].aliquota / 100;
      piso = teto;
    }
    return imposto;
  }
  function liquidoAnual(D, bruto) {
    var P = D.parametros;
    var ss = Math.min(bruto, P.ss_base_max_anual) * P.ss_pct;
    var rend = Math.max(0, bruto - ss - P.irpf_gastos);
    var red = 0;
    if (rend <= P.irpf_red_lim1) red = P.irpf_red_max;
    else if (rend <= P.irpf_red_lim2) red = P.irpf_red_max - P.irpf_red_k1 * (rend - P.irpf_red_lim1);
    else if (rend <= P.irpf_red_lim3) red = P.irpf_red_v2 - P.irpf_red_k2 * (rend - P.irpf_red_lim2);
    var base = Math.max(0, rend - red);
    var cota = Math.max(0, escala(D, base) - escala(D, P.irpf_minimo_pessoal));
    return { bruto: bruto, ss: ss, irpf: cota, liquido: bruto - ss - cota };
  }
  // Bruto anual para atingir um líquido anual (bisseção)
  function brutoParaLiquido(D, alvo) {
    if (alvo <= 0) return liquidoAnual(D, 0);
    var lo = 0, hi = 1e6;
    for (var i = 0; i < 60; i++) {
      var m = (lo + hi) / 2;
      if (liquidoAnual(D, m).liquido < alvo) lo = m; else hi = m;
    }
    return liquidoAnual(D, hi);
  }

  function rendaNecessaria(cx, custoMensal, trabalhadores, efetivo) {
    var D = cx.D, P = cx.P;
    var porPessoa = custoMensal * 12 / trabalhadores;
    var r = brutoParaLiquido(D, porPessoa);
    var smiAnual = P.smi_mensal * P.smi_pagas;
    var smi12 = smiAnual / 12;
    var deps = cx.pessoas - 1;
    var nomade = smi12 * (P.nomade_pct_smi + (deps > 0 ? P.nomade_dep1 : 0) + Math.max(0, deps - 1) * P.nomade_depn);
    return {
      trabalhadores: trabalhadores, brutoAnual: r.bruto, bruto14: r.bruto / 14, bruto12: r.bruto / 12,
      liquidoMensal: r.liquido / 12, ss: r.ss, irpf: r.irpf, xSMI: r.bruto / smiAnual,
      remotoBRL: custoMensal * efetivo, nomadeMinimo: nomade, smiAnual: smiAnual
    };
  }

  // ---------- Runway da reserva ----------
  function runway(reservaEUR, chegadaTotal, custoMensal, renda, inicioRenda) {
    var saldo = reservaEUR - chegadaTotal, serie = [saldo], meses = null;
    if (saldo < 0) return { meses: 0, faltaNaChegada: -saldo, serie: serie, sustentavel: false };
    for (var m = 1; m <= 36; m++) {
      var queima = custoMensal - (m > inicioRenda ? renda : 0);
      var antes = saldo;
      saldo -= queima;
      serie.push(saldo);
      if (saldo < 0 && meses == null) { meses = m - 1 + antes / queima; break; }
    }
    var sustentavel = meses == null;
    return { meses: sustentavel ? Infinity : meses, serie: serie, sustentavel: sustentavel, faltaNaChegada: 0 };
  }

  function calcular(D, e) {
    var cx = contexto(D, e);
    var efetivo = cambioEfetivo(e.fx);
    var out = { cx: cx, efetivo: efetivo, camadas: {} };
    CAMADAS.forEach(function (c) {
      out.camadas[c] = { mensal: mensal(cx, c), chegada: chegada(cx, c) };
    });
    var sel = out.camadas[e.camada];
    out.renda = rendaNecessaria(cx, sel.mensal.total, e.trabalhadores || cx.adultos, efetivo);
    var reservaEUR = (e.reservaBRL || 0) / efetivo;
    out.reservaEUR = reservaEUR;
    out.runway = runway(reservaEUR, sel.chegada.total, sel.mensal.total, e.rendaEUR || 0, e.inicioRenda || 0);
    out.meta = sel.chegada.total + D.parametros.meses_meta_reserva * out.camadas.real.mensal.total;
    return out;
  }

  var Motor = { CAMADAS: CAMADAS, calcular: calcular, aluguel: aluguel, contexto: contexto, liquidoAnual: liquidoAnual,
    brutoParaLiquido: brutoParaLiquido, cambioEfetivo: cambioEfetivo, runway: runway };
  if (typeof module !== "undefined" && module.exports) module.exports = Motor;
  else raiz.Motor = Motor;
})(this);
