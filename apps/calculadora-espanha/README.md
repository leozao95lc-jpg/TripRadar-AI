# Custo de Vida na Espanha — De Mala y Cuia

Calculadora de custo de vida **mensal** na Espanha (ex.: quanto custa um mês morando num quarto em Madri).
HTML + CSS + JavaScript puro. Sem build, sem dependências. Nenhum dado do usuário é salvo.

## Como funciona

1. **Perfil:** cidade, tipo de moradia (quarto compartilhado, estúdio, ap. 1 ou 2 quartos), nº de pessoas e estilo de vida.
2. **Gastos:** campos já vêm preenchidos com valores de referência e podem ser editados.
3. **Resultado:** total mensal em € e R$, valor por pessoa, projeção de 3/6/12 meses e distribuição por categoria.

## Regras de cálculo

- Itens "por pessoa" (mercado, transporte, celular, lazer, saúde, outros) × nº de pessoas.
- Aluguel e contas: total da casa. No quarto compartilhado, são por pessoa (um quarto para cada).
- Mercado, lazer e outros = base × índice da cidade × multiplicador do estilo (arredondado a €5).
- Valores editados pelo usuário não são sobrescritos quando ele muda o perfil.
- R$ = € × cotação (editável, não é tempo real).

## Valores de referência (`config.js`)

| Item | Fonte |
|------|-------|
| Quarto compartilhado | Idealista, relatórios de habitações 1º/2º tri 2026 |
| Transporte Madrid (€32,70) | CRTM 2026, com desconto de 40% válido até 31/12/2026 |
| Estúdio / apartamentos, demais transportes, mercado, lazer, contas | **Estimativas: validar antes de divulgar** |

Atualize os valores e `REFERENCIA_DATA` periodicamente (sugestão: a cada trimestre).

## Publicar

Arraste esta pasta em https://app.netlify.com/drop (ou Vercel com Root Directory = esta pasta).
Depois preencha `APP_URL` em `config.js` com o link final.
