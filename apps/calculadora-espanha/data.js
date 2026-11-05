// GERADO por scripts/build-data.mjs a partir de data/*.csv. Não edite à mão.
window.CALC_DATA = {
 "fontes": {
  "idealista_quartos_2026": {
   "id": "idealista_quartos_2026",
   "titulo": "Idealista: habitações em apartamento compartilhado, 1º e 2º tri 2026",
   "url": "https://www.idealista.com/news/node/892181",
   "data": "2026-06",
   "tipo": "portal"
  },
  "idealista_alquiler_2026": {
   "id": "idealista_alquiler_2026",
   "titulo": "Idealista: informe de preços de aluguel (€/m², abr–jun 2026)",
   "url": "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/alquiler/report/",
   "data": "2026-06",
   "tipo": "portal"
  },
  "crtm_2026": {
   "id": "crtm_2026",
   "titulo": "CRTM Madrid: Abono 30 días, tarifas 2026 (desconto de 40% até 31/12/2026)",
   "url": "https://crtm.es/billetes-y-tarifas/buscador/abono-30-dias/",
   "data": "2026-01",
   "tipo": "oficial"
  },
  "boe_smi_2026": {
   "id": "boe_smi_2026",
   "titulo": "BOE: Real Decreto 126/2026, SMI 2026 (€ 1.221 × 14)",
   "url": "https://boe.es/buscar/pdf/2026/BOE-A-2026-3815-consolidado.pdf",
   "data": "2026-02",
   "tipo": "oficial"
  },
  "lau_fianza": {
   "id": "lau_fianza",
   "titulo": "LAU art. 36: fiança de 1 mês e garantia adicional de até 2 meses",
   "url": "https://www.boe.es/buscar/act.php?id=BOE-A-1994-26003",
   "data": "vigente",
   "tipo": "oficial"
  },
  "ley_vivienda": {
   "id": "ley_vivienda",
   "titulo": "Lei 12/2023 (Ley de Vivienda): honorários da imobiliária pagos pelo proprietário",
   "url": "https://www.boe.es/buscar/act.php?id=BOE-A-2023-12203",
   "data": "vigente",
   "tipo": "oficial"
  },
  "irpf_aeat": {
   "id": "irpf_aeat",
   "titulo": "AEAT: escala, mínimo pessoal e redução por rendimentos do trabalho (IRPF)",
   "url": "https://sede.agenciatributaria.gob.es/",
   "data": 2026,
   "tipo": "oficial"
  },
  "iof_2025": {
   "id": "iof_2025",
   "titulo": "IOF câmbio unificado em 3,5% (cartão, espécie, conta própria): confirmar na Receita",
   "url": "https://investnews.com.br/economia/fechou-o-cerco-iof-vai-a-35-para-cambio-com-cartoes-de-credito-debito-e-pre-pagos-internacionais/amp/",
   "data": "2025-07",
   "tipo": "imprensa"
  },
  "briefing_valencia": {
   "id": "briefing_valencia",
   "titulo": "Briefing de referência (Valência, set/2026)",
   "url": null,
   "data": "2026-09",
   "tipo": "terceiro"
  },
  "frankfurter": {
   "id": "frankfurter",
   "titulo": "Cotação comercial EUR/BRL: BCE via Frankfurter API",
   "url": "https://www.frankfurter.app",
   "data": "tempo real",
   "tipo": "oficial"
  },
  "estimativa_dmc": {
   "id": "estimativa_dmc",
   "titulo": "Estimativa De Mala y Cuia: validar com custos reais",
   "url": null,
   "data": "2026-11",
   "tipo": "estimativa"
  }
 },
 "parametros": {
  "data_atualizacao": "nov/2026",
  "cotacao_fallback": 6.3,
  "cotacao_fallback_data": "05/11/2026",
  "aluguel_fator_essencial": 0.9,
  "premio_recem_chegado": 0.12,
  "quarto_fator_casal": 1.2,
  "ss_pct": 0.065,
  "ss_base_max_anual": 61214,
  "irpf_gastos": 2000,
  "irpf_minimo_pessoal": 5550,
  "irpf_red_max": 7302,
  "irpf_red_lim1": 14852,
  "irpf_red_k1": 1.75,
  "irpf_red_lim2": 17673.52,
  "irpf_red_v2": 2364.34,
  "irpf_red_k2": 1.14,
  "irpf_red_lim3": 19747.5,
  "smi_mensal": 1221,
  "smi_pagas": 14,
  "nomade_pct_smi": 2,
  "nomade_dep1": 0.75,
  "nomade_depn": 0.25,
  "meses_meta_reserva": 6
 },
 "irpf": [
  {
   "ate": 12450,
   "aliquota": 19
  },
  {
   "ate": 20200,
   "aliquota": 24
  },
  {
   "ate": 35200,
   "aliquota": 30
  },
  {
   "ate": 60000,
   "aliquota": 37
  },
  {
   "ate": 300000,
   "aliquota": 45
  },
  {
   "ate": null,
   "aliquota": 47
  }
 ],
 "cidades": [
  {
   "id": "madrid",
   "nome": "Madrid",
   "aluguel_m2": 23.3,
   "fonte_aluguel_m2": "idealista_alquiler_2026",
   "quarto": 587,
   "fonte_quarto": "idealista_quartos_2026",
   "agua": 25,
   "transporte": 32.7,
   "transporte_nome": "Abono 30 dias zona A",
   "fonte_transporte": "crtm_2026",
   "fator_custo": 1,
   "fator_clima_luz": 1.1,
   "centro_fator": 1.2,
   "centro_ref": "Centro, Salamanca",
   "periferia_fator": 0.7,
   "periferia_ref": "Móstoles, Alcalá",
   "periferia_transporte_extra": 10.5,
   "fonte_zonas": "estimativa_dmc",
   "hospedagem_noite": 55,
   "atualizado": "2026-06"
  },
  {
   "id": "barcelona",
   "nome": "Barcelona",
   "aluguel_m2": 22,
   "fonte_aluguel_m2": "idealista_alquiler_2026",
   "quarto": 600,
   "fonte_quarto": "idealista_quartos_2026",
   "agua": 30,
   "transporte": 22,
   "transporte_nome": "T-usual zona 1",
   "fonte_transporte": "estimativa_dmc",
   "fator_custo": 1.05,
   "fator_clima_luz": 1,
   "centro_fator": 1.15,
   "centro_ref": "Eixample, Ciutat Vella",
   "periferia_fator": 0.72,
   "periferia_ref": "L'Hospitalet, Badalona",
   "periferia_transporte_extra": 12,
   "fonte_zonas": "estimativa_dmc",
   "hospedagem_noite": 60,
   "atualizado": "2026-06"
  },
  {
   "id": "valencia",
   "nome": "Valência",
   "aluguel_m2": 14.3,
   "fonte_aluguel_m2": "idealista_alquiler_2026",
   "quarto": 415,
   "fonte_quarto": "idealista_quartos_2026",
   "agua": 31,
   "transporte": 35,
   "transporte_nome": "SUMA mensal 1 zona",
   "fonte_transporte": "briefing_valencia",
   "fator_custo": 0.92,
   "fator_clima_luz": 1,
   "centro_fator": 1.21,
   "centro_ref": "Ciutat Vella",
   "periferia_fator": 0.66,
   "periferia_ref": "Aldaia",
   "periferia_transporte_extra": 12,
   "fonte_zonas": "briefing_valencia",
   "hospedagem_noite": 45,
   "atualizado": "2026-06"
  },
  {
   "id": "malaga",
   "nome": "Málaga",
   "aluguel_m2": 16.5,
   "fonte_aluguel_m2": "idealista_alquiler_2026",
   "quarto": 430,
   "fonte_quarto": "idealista_quartos_2026",
   "agua": 28,
   "transporte": 27,
   "transporte_nome": "Passe mensal EMT",
   "fonte_transporte": "estimativa_dmc",
   "fator_custo": 0.93,
   "fator_clima_luz": 0.95,
   "centro_fator": 1.25,
   "centro_ref": "Centro Histórico",
   "periferia_fator": 0.75,
   "periferia_ref": "Alhaurín de la Torre",
   "periferia_transporte_extra": 10,
   "fonte_zonas": "estimativa_dmc",
   "hospedagem_noite": 55,
   "atualizado": "2026-06"
  },
  {
   "id": "alicante",
   "nome": "Alicante",
   "aluguel_m2": 13,
   "fonte_aluguel_m2": "estimativa_dmc",
   "quarto": 390,
   "fonte_quarto": "idealista_quartos_2026",
   "agua": 26,
   "transporte": 30,
   "transporte_nome": "Passe mensal TAM",
   "fonte_transporte": "estimativa_dmc",
   "fator_custo": 0.88,
   "fator_clima_luz": 0.95,
   "centro_fator": 1.15,
   "centro_ref": "Centro",
   "periferia_fator": 0.78,
   "periferia_ref": "San Vicente del Raspeig",
   "periferia_transporte_extra": 8,
   "fonte_zonas": "estimativa_dmc",
   "hospedagem_noite": 45,
   "atualizado": "2026-06"
  }
 ],
 "tipologias": [
  {
   "id": "quarto",
   "nome": "Quarto compartilhado",
   "m2": null,
   "premio_m2": null,
   "enxoval_essencial": 150,
   "enxoval_confortavel": 250,
   "enxoval_real": 400,
   "fonte": "estimativa_dmc"
  },
  {
   "id": "estudio",
   "nome": "Estúdio",
   "m2": 40,
   "premio_m2": 1.15,
   "enxoval_essencial": 500,
   "enxoval_confortavel": 800,
   "enxoval_real": 1200,
   "fonte": "estimativa_dmc"
  },
  {
   "id": "ap1",
   "nome": "Apartamento 1 quarto",
   "m2": 55,
   "premio_m2": 1.05,
   "enxoval_essencial": 600,
   "enxoval_confortavel": 1000,
   "enxoval_real": 1500,
   "fonte": "estimativa_dmc"
  },
  {
   "id": "ap2",
   "nome": "Apartamento 2 quartos",
   "m2": 75,
   "premio_m2": 1,
   "enxoval_essencial": 900,
   "enxoval_confortavel": 1500,
   "enxoval_real": 2200,
   "fonte": "estimativa_dmc"
  }
 ],
 "perfis": [
  {
   "id": "solo",
   "nome": "Sozinho(a)",
   "adultos": 1,
   "criancas": 0,
   "fator_casa": 0.8
  },
  {
   "id": "casal",
   "nome": "Casal",
   "adultos": 2,
   "criancas": 0,
   "fator_casa": 1
  },
  {
   "id": "familia1",
   "nome": "Casal + 1 filho",
   "adultos": 2,
   "criancas": 1,
   "fator_casa": 1.2
  },
  {
   "id": "familia2",
   "nome": "Casal + 2 filhos",
   "adultos": 2,
   "criancas": 2,
   "fator_casa": 1.35
  },
  {
   "id": "familia3",
   "nome": "Casal + 3 filhos",
   "adultos": 2,
   "criancas": 3,
   "fator_casa": 1.5
  }
 ],
 "itens": [
  {
   "id": "aluguel",
   "nome": "Aluguel",
   "grupo": "Moradia",
   "unidade": "aluguel",
   "aplica": "todos",
   "opcional": null,
   "essencial": null,
   "confortavel": null,
   "real": null,
   "escala_cidade": "nao",
   "fonte": "idealista_alquiler_2026",
   "nota": "€/m² × m² da tipologia × zona × cenário"
  },
  {
   "id": "luz",
   "nome": "Luz",
   "grupo": "Moradia",
   "unidade": "casa",
   "aplica": "apto",
   "opcional": null,
   "essencial": 45,
   "confortavel": 50,
   "real": 60,
   "escala_cidade": "nao",
   "fonte": "estimativa_dmc",
   "nota": "Ajustada pelo clima da cidade"
  },
  {
   "id": "gas",
   "nome": "Gás",
   "grupo": "Moradia",
   "unidade": "casa",
   "aplica": "apto",
   "opcional": null,
   "essencial": 15,
   "confortavel": 20,
   "real": 25,
   "escala_cidade": "nao",
   "fonte": "estimativa_dmc",
   "nota": "Zero se o imóvel for 100% elétrico"
  },
  {
   "id": "agua",
   "nome": "Água",
   "grupo": "Moradia",
   "unidade": "casa",
   "aplica": "apto",
   "opcional": null,
   "essencial": "@agua",
   "confortavel": "@agua",
   "real": "@agua",
   "escala_cidade": "nao",
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "internet",
   "nome": "Internet fibra",
   "grupo": "Moradia",
   "unidade": "casa",
   "aplica": "apto",
   "opcional": null,
   "essencial": 30,
   "confortavel": 30,
   "real": 35,
   "escala_cidade": "nao",
   "fonte": "briefing_valencia",
   "nota": null
  },
  {
   "id": "contas_quarto",
   "nome": "Contas do quarto (luz, água, internet)",
   "grupo": "Moradia",
   "unidade": "adulto",
   "aplica": "quarto",
   "opcional": null,
   "essencial": 40,
   "confortavel": 50,
   "real": 60,
   "escala_cidade": "nao",
   "fonte": "estimativa_dmc",
   "nota": "Muitas vezes já incluídas no aluguel"
  },
  {
   "id": "mercado_adulto",
   "nome": "Supermercado (adultos)",
   "grupo": "Alimentação",
   "unidade": "adulto",
   "aplica": "todos",
   "opcional": null,
   "essencial": 200,
   "confortavel": 260,
   "real": 300,
   "escala_cidade": "sim",
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "mercado_crianca",
   "nome": "Supermercado (crianças)",
   "grupo": "Alimentação",
   "unidade": "crianca",
   "aplica": "todos",
   "opcional": null,
   "essencial": 120,
   "confortavel": 155,
   "real": 180,
   "escala_cidade": "sim",
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "transporte",
   "nome": "Transporte público",
   "grupo": "Transporte",
   "unidade": "adulto",
   "aplica": "todos",
   "opcional": null,
   "essencial": "@transporte",
   "confortavel": "@transporte",
   "real": "@transporte",
   "escala_cidade": "nao",
   "fonte": "@fonte_transporte",
   "nota": "Crianças: passe gratuito ou simbólico"
  },
  {
   "id": "celular",
   "nome": "Celular",
   "grupo": "Comunicação",
   "unidade": "adulto",
   "aplica": "todos",
   "opcional": null,
   "essencial": 12,
   "confortavel": 15,
   "real": 20,
   "escala_cidade": "nao",
   "fonte": "briefing_valencia",
   "nota": null
  },
  {
   "id": "saude",
   "nome": "Seguro saúde privado",
   "grupo": "Saúde",
   "unidade": "pessoa",
   "aplica": "todos",
   "opcional": "seguro",
   "essencial": 55,
   "confortavel": 55,
   "real": 70,
   "escala_cidade": "nao",
   "fonte": "briefing_valencia",
   "nota": "Varia muito com a idade"
  },
  {
   "id": "farmacia",
   "nome": "Higiene e farmácia",
   "grupo": "Saúde",
   "unidade": "pessoa",
   "aplica": "todos",
   "opcional": null,
   "essencial": 20,
   "confortavel": 30,
   "real": 40,
   "escala_cidade": "sim",
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "lazer",
   "nome": "Lazer e restaurantes",
   "grupo": "Lazer",
   "unidade": "adulto",
   "aplica": "todos",
   "opcional": null,
   "essencial": 30,
   "confortavel": 120,
   "real": 180,
   "escala_cidade": "sim",
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "roupas",
   "nome": "Roupas",
   "grupo": "Pessoal",
   "unidade": "pessoa",
   "aplica": "todos",
   "opcional": null,
   "essencial": 0,
   "confortavel": 40,
   "real": 50,
   "escala_cidade": "nao",
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "academia",
   "nome": "Academia e esporte",
   "grupo": "Pessoal",
   "unidade": "adulto",
   "aplica": "todos",
   "opcional": null,
   "essencial": 0,
   "confortavel": 35,
   "real": 40,
   "escala_cidade": "sim",
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "escola",
   "nome": "Escola pública (refeitório, material)",
   "grupo": "Educação",
   "unidade": "crianca",
   "aplica": "todos",
   "opcional": null,
   "essencial": 40,
   "confortavel": 110,
   "real": 160,
   "escala_cidade": "sim",
   "fonte": "estimativa_dmc",
   "nota": "Escola pública é gratuita. O briefing usa € 207 (provável concertada/creche)"
  },
  {
   "id": "viagem_brasil",
   "nome": "Passagem anual ao Brasil (mensalizada)",
   "grupo": "Irregulares",
   "unidade": "pessoa",
   "aplica": "todos",
   "opcional": null,
   "essencial": 0,
   "confortavel": 0,
   "real": 85,
   "escala_cidade": "nao",
   "fonte": "estimativa_dmc",
   "nota": "€ 1.000/ano ÷ 12"
  },
  {
   "id": "documentos",
   "nome": "Renovações e documentos (mensalizado)",
   "grupo": "Irregulares",
   "unidade": "pessoa",
   "aplica": "todos",
   "opcional": null,
   "essencial": 0,
   "confortavel": 0,
   "real": 10,
   "escala_cidade": "nao",
   "fonte": "estimativa_dmc",
   "nota": "TIE, certidões, apostilas"
  },
  {
   "id": "imprevistos",
   "nome": "Imprevistos",
   "grupo": "Irregulares",
   "unidade": "pct",
   "aplica": "todos",
   "opcional": null,
   "essencial": 0,
   "confortavel": 0,
   "real": 0.08,
   "escala_cidade": "nao",
   "fonte": "estimativa_dmc",
   "nota": "8% sobre o subtotal do cenário Real"
  }
 ],
 "chegada": [
  {
   "id": "fianza",
   "nome": "Fiança legal",
   "regra": "meses_aluguel",
   "aplica": "todos",
   "essencial": 1,
   "confortavel": 1,
   "real": 1,
   "fonte": "lau_fianza",
   "nota": "1 mês de aluguel, por lei"
  },
  {
   "id": "garantia",
   "nome": "Garantia adicional",
   "regra": "meses_aluguel",
   "aplica": "apto",
   "essencial": 0,
   "confortavel": 1,
   "real": 2,
   "fonte": "lau_fianza",
   "nota": "Máximo legal de 2 meses (residência habitual)"
  },
  {
   "id": "primeiro_mes",
   "nome": "Primeiro mês de aluguel",
   "regra": "meses_aluguel",
   "aplica": "todos",
   "essencial": 1,
   "confortavel": 1,
   "real": 1,
   "fonte": null,
   "nota": null
  },
  {
   "id": "honorarios",
   "nome": "Honorários da imobiliária",
   "regra": "fixo",
   "aplica": "apto",
   "essencial": 0,
   "confortavel": 0,
   "real": 0,
   "fonte": "ley_vivienda",
   "nota": "Por lei, pagos pelo proprietário. Não aceite cobrança."
  },
  {
   "id": "hospedagem",
   "nome": "Hospedagem até achar moradia",
   "regra": "noites",
   "aplica": "todos",
   "essencial": 10,
   "confortavel": 14,
   "real": 21,
   "fonte": "estimativa_dmc",
   "nota": "Noites × diária média da cidade"
  },
  {
   "id": "enxoval",
   "nome": "Móveis e enxoval",
   "regra": "enxoval",
   "aplica": "todos",
   "essencial": null,
   "confortavel": null,
   "real": null,
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "documentos_chegada",
   "nome": "Taxas e documentos (TIE, fotos, cópias)",
   "regra": "pessoa",
   "aplica": "todos",
   "essencial": 25,
   "confortavel": 30,
   "real": 40,
   "fonte": "estimativa_dmc",
   "nota": "Empadronamiento é gratuito"
  },
  {
   "id": "chip",
   "nome": "Chip e primeira recarga",
   "regra": "adulto",
   "aplica": "todos",
   "essencial": 10,
   "confortavel": 15,
   "real": 20,
   "fonte": "estimativa_dmc",
   "nota": null
  },
  {
   "id": "transporte_chegada",
   "nome": "Transporte de chegada",
   "regra": "fixo",
   "aplica": "todos",
   "essencial": 20,
   "confortavel": 40,
   "real": 60,
   "fonte": "estimativa_dmc",
   "nota": "Aeroporto e deslocamentos iniciais"
  }
 ],
 "cambio": [
  {
   "id": "conta_global",
   "nome": "Conta global (Wise, Nomad…)",
   "spread_pct": 1,
   "iof_pct": 3.5,
   "fonte": "iof_2025",
   "nota": "Spread típico estimado"
  },
  {
   "id": "cartao",
   "nome": "Cartão do banco",
   "spread_pct": 4,
   "iof_pct": 3.5,
   "fonte": "iof_2025",
   "nota": "Spread típico estimado"
  },
  {
   "id": "especie",
   "nome": "Papel-moeda",
   "spread_pct": 5,
   "iof_pct": 3.5,
   "fonte": "iof_2025",
   "nota": "Spread típico estimado"
  },
  {
   "id": "personalizado",
   "nome": "Personalizado",
   "spread_pct": 0,
   "iof_pct": 0,
   "fonte": null,
   "nota": "Informe o seu"
  }
 ]
};
