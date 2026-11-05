# Custo de Vida na Espanha (De Mala y Cuia)

Calculadora de custo de vida mensal na Espanha para brasileiros: 3 cenários (Essencial, Confortável, Real) e conversão para reais com câmbio atualizado automaticamente (spread e IOF incluídos). Mostra fonte e data de cada valor e captura leads para a amostra do Café com Imigração.

HTML + CSS + JavaScript puro. Sem build de front-end, sem dependências.

## Estrutura

| Caminho | O que é |
|---|---|
| `data/*.csv` | **Planilha-mestre** (uma aba por arquivo, `;` e decimal `,`). Aqui você atualiza os valores. |
| `scripts/build-data.mjs` | Converte e valida os CSVs e gera `data.js` |
| `data.js` | Gerado. Não edite à mão. |
| `engine.js` | Motor de cálculo (funções puras, testável no Node) |
| `app.js` | Interface |
| `config.js` | Links, câmbio ao vivo e destino dos leads |
| `METODOLOGIA.md` | Crítica ao briefing, modelo de dados, fórmulas e layout |

## Atualizar valores

1. Abra o CSV no Excel e edite. Salve como CSV com separador `;`.
2. Atualize `data_atualizacao` em `parametros.csv` e a data da fonte em `fontes.csv`.
3. Rode o build (requer Node 18+):

```bash
node scripts/build-data.mjs
```

Rotina sugerida: revisão trimestral; em janeiro, revisar o transporte (os descontos de 2026 vencem em 31/12).

Câmbio: a página consulta a cotação comercial ao abrir e a cada 5 minutos (AwesomeAPI; reserva: BCE via Frankfurter). Se as duas falharem, usa `cotacao_fallback` da planilha.

## Captura de leads

Escolha em `config.js` → `LEAD_MODO`:
- `"mailerlite"` (padrão): envia para um formulário do MailerLite, que dispara a automação com o capítulo 9. Passo a passo e textos dos e-mails em **`MAILERLITE.md`**. Sem os IDs preenchidos, os leads ficam guardados no Netlify.
- `"netlify"`: Netlify Forms, grátis e sem backend. Os leads aparecem no painel do Netlify em *Forms → leads*.
- `"endpoint"`: POST JSON para `LEAD_ENDPOINT` (Google Apps Script → Planilha, Make, n8n, RD Station).
- `"demo"`: não envia nada.

Cada lead traz a simulação (cidade, moradia, perfil, cenário, custo em € e R$), o material pedido e as UTMs.

Importante: o Netlify Forms só **guarda** o lead. Quem envia o capítulo é a automação do MailerLite.

## Publicar

Arraste a pasta em https://app.netlify.com/drop ou conecte o repositório no Netlify com *Base directory* = `apps/calculadora-espanha`, sem comando de build. Depois preencha `APP_URL` em `config.js`.
