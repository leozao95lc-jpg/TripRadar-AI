# Custo de Vida na Espanha (De Mala y Cuia)

Calculadora de custo de vida na Espanha para brasileiros: 3 cenários (Essencial, Confortável, Real), custo de chegada, salário bruto necessário, quanto dura a reserva e câmbio efetivo com spread e IOF. Mostra fonte e data de cada valor e tem captura de lead.

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

## Captura de leads

Escolha em `config.js` → `LEAD_MODO`:
- `"netlify"` (padrão): Netlify Forms, grátis e sem backend. Os leads aparecem no painel do Netlify em *Forms → leads*.
- `"endpoint"`: POST JSON para `LEAD_ENDPOINT` (Google Apps Script → Planilha, Make, n8n, RD Station).
- `"demo"`: não envia nada.

Cada lead traz a simulação (cidade, moradia, cenário, custo, chegada, salário, runway, reserva) e as UTMs.

## Publicar

Arraste a pasta em https://app.netlify.com/drop ou conecte o repositório no Netlify com *Base directory* = `apps/calculadora-espanha`, sem comando de build. Depois preencha `APP_URL` em `config.js`.
