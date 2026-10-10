# Espanha Planejada — v0.1

Ferramenta de consultoria financeira para brasileiros que querem se mudar para a Espanha.
Aplicação web (React + TypeScript + Tailwind) que roda 100% no navegador, sem backend.

## Como executar

```bash
cd apps/espanha-planejada
npm install
npm run dev        # desenvolvimento → http://localhost:5173
npm test           # testes do motor de cálculo (Vitest)
npm run build      # build estático em dist/ (pode ser hospedado em qualquer CDN/Netlify/Vercel)
npm run preview    # serve o build localmente
```

Na tela inicial, **Carregar 3 exemplos** cria três clientes ilustrativos (pessoa sozinha, casal, família).

## Arquitetura

```
src/
  domain/            ← regra de negócio pura, sem React (testável)
    types.ts         modelo de dados (cliente, cenário, custos, plano de poupança…)
    calc.ts          motor: custos por moeda, moradia, renda futura, meta, recursos, falta
    savings.ts       projeção mês a mês (36 meses + busca além do horizonte)
    analysis.ts      junta cálculo + projeção + alertas; comparação de cenários
    templates.ts     cenários-modelo por perfil × nível, checklist, cliente novo
    calc.test.ts     26 testes com resultados calculados à mão
  store/useStore.ts  estado (zustand) persistido em localStorage + backup JSON
  components/        UI reutilizável, gráficos (Recharts), editores
  pages/             clientes, espaço de trabalho, relatório (PDF), visão do cliente,
                     configurações, metodologia
  lib/               datas, formatação, exportadores (xlsx/csv/txt), textos gerados
```

- **Área do consultor**: lista de clientes → espaço de trabalho com abas Painel, Cadastro (4 etapas),
  Cenários e custos, Plano de poupança, Checklist, Anotações, Entrega.
- **Área de planejamento** (`#/plano/:id`): visão simplificada para apresentar ao cliente.
- **Relatório** (`#/clientes/:id/relatorio`): layout A4 para "Salvar como PDF" pelo navegador.
  `?modo=checklist` imprime só o checklist; `?versao=<id>` abre uma versão final congelada.

A metodologia completa (fórmulas) está na própria aplicação, em **Metodologia**.

## Regras de cálculo principais

- Somas separadas em EUR e BRL; conversão só no fim, pelo câmbio de compra
  (câmbio × (1 + custo de conversão)). Euros já guardados cobrem primeiro custos em euro.
- Itens escalam por regra explícita (fixo / por adulto / por criança / por pessoa / por animal):
  um casal não custa o dobro de uma pessoa.
- Depósitos reembolsáveis aparecem separados dos gastos definitivos; reserva de emergência é
  dinheiro que permanece disponível.
- Itens "já pagos" saem da meta e dos recursos; aluguel antecipado dentro do período financiado
  não é somado duas vezes.
- Renda futura só reduz a meta quando o cenário manda, e gera alerta se não estiver confirmada.
- Poupança zero/negativa → nenhuma data é inventada.
- Câmbio não informado bloqueia o cálculo (em vez de zerar os euros silenciosamente).

## Testes realizados

- `npm test`: 26 testes, incluindo os três casos obrigatórios com valores calculados à mão:
  1. Pessoa sozinha com reserva suficiente (meta R$ 44.180; disponível R$ 50.000; 0 meses).
  2. Casal com reserva insuficiente e poupança positiva (meta R$ 93.824,80; falta R$ 56.224,80;
     19 meses; poupança necessária R$ 4.685,40/mês para a data pretendida).
  3. Família com poupança zero (meta R$ 137.350; falta R$ 97.350; sem data, alerta crítico).
  Além de: contagem dupla, câmbio de venda do excedente, valor preservado, renda futura,
  aluguel antecipado, valores negativos, sensibilidade cambial, períodos/aportes, horizonte >36 meses,
  consistência Econômico ≤ Intermediário ≤ Conservador.
- Teste de ponta a ponta no Chromium (Playwright, fora do repositório): carregar exemplos, navegar todas
  as abas, editar aluguel e ver a meta recalculada, exportar xlsx/3 CSVs/txt, gerar versão final,
  gerar PDF do relatório e do checklist, visão do cliente, layout mobile (390 px sem rolagem lateral),
  validação de campo obrigatório e de número negativo. Sem erros de console.

## Limitações conhecidas (v0.1)

- **Dados só no navegador** (localStorage): sem backup automático, sem sincronização entre
  dispositivos. Use *Exportar backup* (JSON). Limpar dados do navegador apaga tudo.
- **Sem autenticação**: não use em computador compartilhado. A "visão do cliente" é para mostrar
  na tela/compartilhar o PDF — não é um link público.
- **PDF via impressão do navegador** ("Salvar como PDF"), não um gerador de PDF próprio.
- Sem cotação automática de câmbio ou preços: tudo é informado com fonte e data.
- Valores dos cenários-modelo são pontos de partida marcados como "sem cotação", não preços reais.
- Não avalia elegibilidade migratória nem define prazos legais.

## Evolução sugerida

1. Backend (ex.: Supabase/Postgres) com autenticação, multi-consultor e link seguro por cliente.
2. Biblioteca de preços por cidade com histórico de cotações (fonte + data) reaproveitada entre clientes.
3. Câmbio via API pública (PTAX/BCE) com registro da data.
4. Produto A: questionário público + checkout, gerando a planilha a partir do mesmo motor `domain/`.
