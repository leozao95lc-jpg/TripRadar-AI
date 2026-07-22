# 9. Revisão Estratégica — Rumo à Melhor Plataforma de Viagens da América Latina

Este documento revisa a arquitetura e o roadmap originais (`02-mvp-roadmap.md` e
`03-arquitetura.md`) sob uma pergunta mais ambiciosa: **o que faria do TripRadar a
melhor plataforma de descoberta, monitoramento e compra inteligente de viagens da
América Latina** — não só um clone regional do Google Flights?

## 9.1 Onde os concorrentes são estruturalmente fracos

| Concorrente | Forte em | Fraco em (para o usuário latino-americano) |
|---|---|---|
| **Google Flights** | Velocidade de busca, cobertura global | Zero localização real: não entende milhas/pontos brasileiros, não fala com o usuário por WhatsApp, feriados/sazonalidade tratados de forma genérica |
| **Kayak / Skyscanner** | Comparação ampla de OTAs | Mesmo problema de localização; "price forecast" é uma feature secundária, não o produto |
| **Hopper** | IA de previsão de preço, price freeze — a referência global mais próxima | Não tem presença relevante no Brasil/LatAm, não integra milhas de programas locais, canal de notificação é o app próprio (não WhatsApp) |
| **Decolar (Despegar)** | Marca conhecida, inventário amplo de pacotes/hotéis | Reputação de confiança fraca (alto volume de reclamações), UX datada, é uma OTA de transação, não uma plataforma de inteligência — não diz "quando" comprar, só vende |

**A leitura estratégica:** os players globais não vão investir engenharia em
integração profunda com WhatsApp Business API, programas de milhas brasileiros
(Smiles, Latam Pass, TudoAzul, LifeMiles) ou feriados/sazonalidade regional — isso é
baixa prioridade pra eles e alta prioridade pra nós. E a Decolar compete em
inventário/transação, não em inteligência e confiança. **O espaço em aberto é
"inteligência de compra + confiança + canal nativo do brasileiro"**, não "mais uma
busca de voo".

## 9.2 Funcionalidades difíceis de copiar (moats)

Ordenadas por dificuldade de replicação por um concorrente global:

1. **Consultor de milhas/pontos** (dinheiro vs. milhas, "vale mais resgatar ou
   pagar?"). Exige conhecimento profundo de programas de fidelidade locais
   (Smiles, Latam Pass, TudoAzul, Livelo, Esfera) — não é prioridade de roadmap de
   nenhum concorrente global e a Decolar não faz isso bem.
2. **WhatsApp como canal nativo de interação** (não só recebimento de alerta, mas
   criação/gestão de alerta por chat). WhatsApp tem penetração > 95% no Brasil;
   nenhum concorrente relevante construiu a experiência em torno dele.
3. **Sinal de câmbio combinado ao preço** (alerta considera "preço caiu" *e*
   "câmbio está favorável" para viagem internacional) — relevante especificamente
   para quem compra em BRL/ARS/MXN e paga em USD/EUR; irrelevante para o design de
   produto de um Google Flights.
4. **Dado histórico proprietário de rotas LatAm**: quanto mais tempo rodamos,
   melhor o modelo de sazonalidade fica para rotas como GRU-LIS, FLN-MAD, GIG-MCO —
   isso é um efeito de rede de dados que um concorrente não compra, precisa
   acumular no tempo. Cada mês de atraso do concorrente em entrar nesse nicho é
   vantagem nossa.
5. **Confiança radical** (mostrar o porquê de cada recomendação e de cada variação
   de preço) como contraponto direto à reputação fraca da Decolar — isso é uma
   escolha de produto e comunicação, difícil de copiar rapidamente por quem já tem
   reputação formada.
6. **Feed de ofertas + páginas de rota indexáveis**, alimentado pelos nossos
   próprios dados de monitoramento — vira motor de aquisição orgânica (SEO) e,
   depois, efeito de comunidade (usuários compartilhando/validando ofertas), difícil
   de copiar porque depende de volume de dado próprio acumulado, não de um único
   lançamento de feature.

Fora do top desta lista, mas registradas para fases futuras por serem valiosas e
comprovadas (Hopper) — porém **não são moats defensáveis por si só** (são copiáveis):
congelamento de preço (price freeze), planejamento de viagem em grupo, inteligência
de visto/documentação por passaporte.

## 9.3 Oportunidades de retenção

- **Economia acumulada visível** (já previsto) + **gamificação leve**: marcos de
  economia, "você é do grupo dos 10% que mais economiza nesta rota" — reforça o
  hábito de voltar ao produto.
- **Recomendação proativa sem alerta explícito**: usar aeroportos/rotas
  pesquisados (mesmo sem alerta criado) para sugerir "vimos que você pesquisou
  isso — quer que a gente monitore?". Reduz fricção de criação de alerta.
- **WhatsApp como loop de reengajamento**: taxa de abertura de WhatsApp é
  estruturalmente maior que e-mail — cada notificação bem calibrada (sem excesso,
  sem spam) é reforço de retenção, não só de conversão.
- **Conteúdo vivo no dashboard**: mesmo sem alerta disparado, mostrar tendência da
  rota favorita do usuário mantém o produto relevante entre viagens.

## 9.4 Oportunidades de monetização (além do original)

- **Comissão de afiliado em milhas/produtos financeiros relacionados** (cartões com
  pontos de milhagem, clubes de assinatura de milhas) — audiência já qualificada
  pelo consultor de milhas.
- **Conteúdo patrocinado transparente** no feed de ofertas (claramente identificado
  como patrocinado, para não corroer a confiança que é o diferencial central).
- **Produto de dados B2B** (fase de Escala): tendências agregadas e anonimizadas de
  tarifa por rota, vendidas a companhias aéreas/agências — só depois de volume de
  dado relevante e revisão de compliance (anonimização, LGPD).
- Mantido do plano original: assinatura Premium, comissão de emissão via parceiro,
  cross-sell contextual de hotel/carro/seguro/eSIM.

## 9.5 Priorização — o que entra no MVP

Critério: **alto impacto de diferenciação + baixo custo/risco de implementar agora**
entram no MVP; o resto é adiado deliberadamente para não inflar escopo, custo ou
risco regulatório do primeiro lançamento.

| Funcionalidade | Impacto de diferenciação | Custo/risco de entrar agora | Decisão |
|---|---|---|---|
| WhatsApp como canal (saída **e** criação de alerta via menu estruturado) | Muito alto | Baixo (WhatsApp Cloud API tem tier gratuito para mensagens utilitárias; bot de menu, sem NLU livre, é simples) | **Entra no MVP** |
| Consultor de milhas (versão "lite": tabela de referência estática de cents-per-mile por programa + comparação) | Alto | Baixo (dado de referência mantido manualmente, sem integração em tempo real com programas) | **Entra no MVP** |
| Sinal de câmbio favorável | Médio-alto | Baixo (ingestão diária de uma API de câmbio gratuita/barata) | **Entra no MVP** |
| Feed público de ofertas + páginas de rota (SEO) | Alto (aquisição orgânica) | Baixo (reaproveita a tabela `price_snapshots` já desenhada) | **Entra no MVP** |
| Recomendação proativa sem alerta explícito | Médio | Médio (precisa de volume mínimo de dado comportamental) | Beta |
| Comunidade/curadoria social de ofertas | Alto no médio prazo | Médio (precisa de massa crítica de usuários) | Beta/V1 |
| Congelamento de preço (price freeze) | Alto, mas copiável | Alto (exige garantia financeira/parceria de emissão) | V1, condicionado à decisão de fornecedor de emissão |
| Planejamento de viagem em grupo | Médio-alto | Médio-alto (UX complexa: votação, rateio) | V1 |
| Inteligência de visto/documentação | Médio (confiança) | Baixo-médio (dado de referência por nacionalidade) | V1 |
| Copiloto de viagem via WhatsApp (IA conversacional livre) | Muito alto no longo prazo | Alto (exige IA madura e controle de custo de LLM em escala) | Escala |
| Produto de dados B2B | Alto (receita nova) | Alto (compliance, volume de dado) | Escala |

**Resultado:** o MVP ganha 4 funcionalidades novas (WhatsApp, milhas-lite, sinal de
câmbio, feed público) além do que já estava definido — todas de baixo custo marginal
porque reaproveitam a base de dados já desenhada (`price_snapshots`) ou dependem de
dado de referência estático, não de integrações pesadas. Isso é o que muda a
percepção do produto de "mais um comparador" para "a plataforma que entende o
viajante latino-americano" já no primeiro lançamento, sem comprometer o princípio de
MVP enxuto.

## 9.6 O que NÃO muda

A disciplina original se mantém: **sem emissão própria de bilhete no MVP** (ver
riscos regulatórios em `01-analise-e-riscos.md`), **sem cobrança no MVP**, **um único
provedor de dados de voo no MVP**. A ambição de ser a melhor plataforma da América
Latina se constrói em cima de um monitoramento de preço confiável primeiro — as
funcionalidades diferenciadas acima *reforçam* o core, não o substituem.

## 9.7 Impacto nos documentos existentes

- `02-mvp-roadmap.md` — Fase 1 (MVP) atualizada com as 4 funcionalidades priorizadas
  acima; Fases 2–4 atualizadas com os itens adiados (comunidade, price freeze, grupo,
  visto, copiloto, dados B2B).
- `03-arquitetura.md` — módulo `notifications` passa a incluir WhatsApp desde o MVP;
  módulo `recommendations` ganha as capacidades `mileage_advisor` e
  `currency_signal`; nova superfície pública de leitura (`deals`) para SEO.
- `04-modelo-dados.md` — novas tabelas de referência: `mileage_programs`,
  `mileage_valuations`, `exchange_rates`.
