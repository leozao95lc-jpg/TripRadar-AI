# Metodologia: Custo de Vida na Espanha (De Mala y Cuia)

Versão de referência: nov/2026.

> **v3.1 (simplificação):** a página publicada mostra só o custo mensal em 3 cenários e a conversão para reais. Custo de chegada, renda necessária e duração da reserva foram retirados da página; as seções 3 e 4 abaixo registram como eram calculados, caso voltem no futuro. Este documento registra a crítica ao briefing de referência, o modelo de dados, as fórmulas e o layout.

---

## 1. Crítica ao briefing de referência

| # | Ponto do briefing | Problema | Como tratamos |
|---|---|---|---|
| 1 | `apto1: 1190`, `apto2: 1370` (Valência) | Diferença de só 15% entre 1 e 2 quartos é atípica (o normal é 25–35%). Com Idealista a **14,3 €/m²** (jun/2026), 55 m² dá ~€ 830 e 75 m² ~€ 1.070. € 1.190 equivale a ~21,6 €/m², 50% acima da média. Provável viés de amostra: estoque de giro rápido, mobiliado ou de temporada. | Aluguel = €/m² × m² × prêmio para imóvel pequeno. O "preço de quem chega" vira um prêmio explícito (+12%) no cenário **Real**, em vez de ficar escondido na média. |
| 2 | `quarto: 380` | Abaixo do Idealista 2026 para Valência (~€ 415). | € 415, com fonte. |
| 3 | `around.factor 0.66` (Aldaia) com `transport` "1 zona" | Incoerente: quem mora na região metropolitana paga passe de mais zonas. A economia no aluguel é superestimada. | Periferia = fator de aluguel **+ custo extra de transporte por adulto** (Madrid: B2 € 43,20 − A € 32,70 = +€ 10,50, CRTM). |
| 4 | Fator de zona aplicado sem dizer a quê | Se incidir sobre o custo total, distorce mercado e lazer. | Fator incide **só no aluguel**. |
| 5 | `escola: 207` fixo | Escola pública na Espanha é gratuita. € 207 parece concertada ou creche (0–3 anos), não o caso geral. | Escola pública (refeitório + material): € 40 / 110 / 160 por criança, como estimativa e com nota. |
| 6 | `saudePorPessoa: 55` | Seguro privado varia muito com a idade (~€ 50 aos 30 anos, € 120+ aos 55) e só é obrigatório para alguns vistos. | Opcional (pergunta explícita), com nota de idade. Real = € 70 (cobertura sem copagamento, exigida em vistos). |
| 7 | `fx.spreadPct: 0` | **Maior erro do briefing.** O brasileiro paga spread (1–6%) + IOF (3,5% em cartão, espécie e conta própria no exterior). Subestima o custo em R$ em 5–9%. | Câmbio efetivo = comercial × (1 + spread) × (1 + IOF), com presets por meio de pagamento. |
| 8 | Transporte "SUMA mensal € 35" | Os preços de passe em 2026 têm **descontos temporários** (Madrid: −40% até 31/12/2026). Em 2027 o valor pode subir 60%+. | Fonte e vigência registradas na planilha. Revisar em janeiro. |
| 9 | Um único total | Precisão falsa: um número só, sem faixa, induz decisão errada. | 3 cenários (Essencial / Confortável / Real). |
| 10 | Ausências | Não tem custo de chegada (fiança, garantia, hospedagem, enxoval), gastos irregulares (passagem ao Brasil, renovações), imprevistos, nem conversão do custo em **salário bruto** (IRPF + Seguridade Social). | Todos incluídos. |
| 11 | `luz`/`gas` só por perfil | Ignora clima (aquecimento em Madrid × Málaga). | `fator_clima_luz` por cidade. |
| 12 | Pontos fortes a manter | Fonte e data por cidade (`updated`, `sources`), perfis familiares e referência nomeada de bairro. | Mantidos e ampliados: cada linha mostra um selo de fonte, estimativa ou terceiro. |

**Calibração com dados reais (nov/2026):** mercado, celular, seguro, farmácia, lazer, roupas, outros e contas do quarto foram calibrados com o orçamento comprovado do Café com Imigração (cap. 11 e 12): casal, quarto no centro de Valência, € 1.413 + seguro = € 1.522/mês planejados, € 1.472 gastos em outubro. A calculadora reproduz € 1.472 no cenário Confortável para esse perfil.

**Riscos remanescentes (nossos):** aluguel de apartamento em Alicante (€/m² ambíguo entre 12,6 e 13,6), transporte fora de Madrid, cesta de supermercado, lazer e enxoval são **estimativas** e aparecem como tal na página. Antes de divulgar, valide com gastos reais da comunidade.

---

## 2. Modelo de dados: planilha-mestre → JSON

A planilha fica em `data/*.csv`: uma aba por arquivo, separador `;` e decimal `,` (padrão do Excel pt-BR).
O comando `node scripts/build-data.mjs` valida tudo e gera `data.js`. Se alguma fonte citada não existir em `fontes.csv`, o build falha.

| Aba | Grão (1 linha =) | Colunas-chave |
|---|---|---|
| `cidades` | cidade | `aluguel_m2`, `quarto`, `agua`, `transporte`, `fator_custo`, `fator_clima_luz`, `centro_fator`, `periferia_fator`, `periferia_transporte_extra`, `hospedagem_noite`, `fonte_*`, `atualizado` |
| `tipologias` | tipo de moradia | `m2`, `premio_m2`, `enxoval_{essencial,confortavel,real}` |
| `perfis` | composição familiar | `adultos`, `criancas`, `fator_casa` (economia de escala da casa) |
| `itens` | linha de custo mensal | `unidade` (casa / adulto / crianca / pessoa / aluguel / pct), `aplica` (todos / apto / quarto), `opcional`, valores por cenário (`@campo` = vem da cidade), `escala_cidade`, `fonte`, `nota` |
| `chegada` | linha de custo único | `regra` (meses_aluguel / noites / enxoval / pessoa / adulto / fixo), valores por cenário |
| `cambio` | meio de conversão | `spread_pct`, `iof_pct` |
| `irpf` | faixa | `ate`, `aliquota` |
| `parametros` | premissa global | `chave`, `valor`, `fonte` (prêmios, SMI, IRPF, metas) |
| `fontes` | fonte | `titulo`, `url`, `data`, `tipo` (oficial / portal / imprensa / terceiro / estimativa) |

Para adicionar uma cidade, inclua uma linha em `cidades.csv`. Para um novo custo, uma linha em `itens.csv`. Nenhuma das duas mudanças exige alterar código.

---

## 3. Fórmulas

**Aluguel (mês)**
- Apartamento: `aluguel_m2 × m2 × premio_m2 × fator_zona × fator_cenário`
- Quarto: `quarto × (1,20 se casal) × fator_zona × fator_cenário`
- `fator_cenário`: Essencial 0,90 · Confortável 1,00 · Real 1,12

**Item mensal:** `valor_cenário × (fator_custo da cidade, se escala) × multiplicador da unidade`
- casa → `fator_casa` · adulto → nº de adultos · criança → nº de crianças · pessoa → total de pessoas
- Luz × `fator_clima_luz`. Transporte + extra de periferia.
- Imprevistos (Real) = 8% × subtotal.
- Um valor editado pelo usuário substitui o calculado nos três cenários e também alimenta a fiança e a garantia.

**Custo de chegada:** (fiança 1 + garantia 0/1/2 + 1º mês) × aluguel + noites × diária × escala da casa + enxoval + documentos por pessoa + chip por adulto + transporte inicial. Honorários da imobiliária = € 0, porque a Lei 12/2023 atribui esse custo ao proprietário.

**Câmbio efetivo:** `comercial × (1 + spread) × (1 + IOF)`. A cotação comercial vem do BCE (API Frankfurter), com valor de reserva da planilha se a API falhar.

**Renda necessária (reversa):** resolve por bisseção o bruto anual `B` tal que `líquido(B) = custo_mensal × 12 ÷ trabalhadores`.
- `SS = min(B, teto) × 6,5%`
- `rend = B − SS − 2.000`
- redução por rendimentos do trabalho (faixas da AEAT)
- `base = rend − redução`
- `IRPF = escala(base) − escala(5.550)`
- `líquido = B − SS − IRPF`

Simplificações: escala geral estatal + autonômica média, contribuinte sem filhos. Sanidade: € 30.000 brutos → ~€ 23.100 líquidos.

**Comparativos:** SMI 2026 = € 1.221 × 14 (BOE). Visto de nômade digital ≈ 200% do SMI mensalizado + 75% pelo 1º dependente + 25% por dependente adicional (conferir requisitos atuais).

**Duração da reserva (runway):** `saldo₀ = reserva_R$ ÷ câmbio_efetivo − chegada`. A cada mês `m`: `saldo −= custo − (m > início ? renda : 0)`. Os meses são contados até `saldo < 0` (com fração), com horizonte de 36 meses. A meta é `chegada + 6 × custo Real`.

---

## 4. Layout

1. **Hero**: a pergunta, a promessa (3 cenários, fontes) e a data de atualização.
2. **Painel de perfil** (fixo à esquerda no desktop; no topo, no celular): cidade, moradia, região, família, seguro.
3. **3 cenários**: cartões clicáveis. O cenário escolhido comanda todas as seções abaixo.
4. **Mês a mês**: tabela item × cenário, com selo de fonte por linha e edição em linha.
5. **Chegada**: total, equivalência em meses e alerta legal sobre honorários.
6. **Renda necessária**: bruto em 14 pagamentos, alternativa remota em R$ e barras comparando com o SMI e o visto de nômade.
7. **Reserva**: meses que a reserva dura, semáforo (crítico / atenção / saudável), linha do tempo e quanto falta para a meta.
8. **Câmbio**: meio de pagamento, spread e IOF editáveis e o "custo invisível" mensal.
9. **Captura de lead**: e-mail + WhatsApp + consentimento LGPD. Envia junto o resumo da simulação e as UTMs, para segmentar o lead.
10. **Fontes e metodologia**: lista com tipo e data de cada fonte.
11. **Barra fixa no celular** com o total do cenário escolhido.
