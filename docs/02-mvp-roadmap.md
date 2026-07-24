# 3. MVP e Roadmap

> **Revisado após a análise estratégica de `08-revisao-estrategica-latam.md`.** O
> MVP abaixo já incorpora as quatro funcionalidades de baixo custo e alto impacto de
> diferenciação identificadas naquela revisão (WhatsApp, consultor de milhas-lite,
> sinal de câmbio, feed público de ofertas). O restante das ideias levantadas na
> revisão (comunidade, price freeze, planejamento em grupo, visto/documentação,
> copiloto de IA, produto de dados B2B) foi deliberadamente distribuído nas fases
> seguintes para não comprometer o prazo e o custo do primeiro lançamento.

## 3.1 Princípio norteador

Lançar o menor produto que valida a hipótese central — **"usuários querem ser
avisados de quando comprar, não só de quanto custa agora, e querem isso onde já
vivem (WhatsApp), com contexto que só faz sentido pra quem viaja da América
Latina (milhas, câmbio)"** — com o menor custo e menor risco regulatório possível.
Compra dentro da plataforma e canais pagos adicionais vêm depois de validar isso.

## 3.2 Fase 0 — Discovery (2–4 semanas)

- Landing page com proposta de valor + lista de espera.
- Pesquisa com 15–20 usuários das personas-alvo.
- Validar: as pessoas confiam em uma recomendação automática de compra? Qual canal de
  notificação elas realmente usariam?
- **Critério de saída:** ≥ 200 e-mails na waitlist ou validação qualitativa forte.

## 3.3 Fase 1 — MVP (8–12 semanas)

**Escopo incluído:**
- Cadastro/login (e-mail+senha e Google OAuth).
- Criar alerta: 1 origem, 1 destino, datas fixas OU flexíveis, preço máximo, classe,
  número de passageiros, ida/ida-e-volta.
- Monitoramento via **uma única API** (Amadeus Self-Service, tier gratuito/baixo
  custo) rodando em job agendado (a cada poucas horas, não em tempo real).
- Histórico de preço de 30 dias, gráfico simples.
- Heurística de recomendação (sem ML ainda): comparação do preço atual com
  média/mínimo histórico da própria rota + regra de sazonalidade básica (feriados
  nacionais).
- **Notificação por e-mail (AWS SES) e WhatsApp** (WhatsApp Cloud API, mensagens
  utilitárias): o alerta pode ser criado e gerenciado por um bot de **menu
  estruturado** no WhatsApp (sem NLU livre — mantém o custo/risco baixo), além do
  fluxo web.
- **Consultor de milhas "lite"**: tabela de referência estática de valor por milha
  (cents-per-mile) dos principais programas (Smiles, Latam Pass, TudoAzul, LifeMiles)
  exibida junto ao preço, respondendo "vale mais pagar ou resgatar?".
- **Sinal de câmbio**: ingestão diária de câmbio (USD/EUR → BRL) somado como fator na
  explicação da recomendação para rotas internacionais.
- **Feed público de ofertas + páginas de rota indexáveis** (SEO), alimentado pela
  própria tabela de histórico de preço — canal de aquisição orgânica desde o dia 1.
- Dashboard com: alertas ativos, últimas quedas, histórico de busca.
- **Sem compra integrada** — botão "Ver oferta" redireciona a um parceiro/afiliado.
- **Sem cobrança** — tudo gratuito nesta fase (ou waitlist para Premium).

**Fora de escopo (explicitamente adiado):** múltiplos aeroportos por alerta, Telegram/
SMS, IA com ML, comparação de aeroportos, multidestino, emissão própria, comunidade
de curadoria de ofertas, price freeze, planejamento em grupo, inteligência de
visto/documentação, copiloto conversacional livre.

**Critério de saída:** taxa de abertura/clique de alerta (e-mail + WhatsApp) acima do
benchmark de mercado (~20%+ para e-mail; WhatsApp tende a ser maior), retenção de
usuários com pelo menos 1 alerta ativo após 30 dias, tráfego orgânico mensurável
vindo das páginas de rota.

## 3.4 Fase 2 — Beta fechado (4–8 semanas)

- Convites controlados (lista de espera da Fase 0).
- Múltiplos aeroportos de origem/destino por alerta.
- Telegram como canal adicional.
- Plano Premium pago via Stripe (alertas ilimitados, histórico completo, canais
  extras) — valida disposição a pagar.
- Melhoria da heurística de recomendação com mais sinais (tendência dos últimos N
  dias, comparação com médias por temporada).
- Recomendação proativa sem alerta explícito (baseada em aeroportos/rotas
  pesquisados).
- Primeira versão do feed de ofertas com curadoria/validação de usuários (semente da
  comunidade de caçadores de promoção).
- Observabilidade básica em produção (logs estruturados, métricas, alertas de erro).

**Critério de saída:** conversão free→Premium mensurável, custo de notificação por
usuário dentro do orçamento projetado, engajamento mensurável no feed de ofertas.

## 3.5 Fase 3 — V1 pública

- Compra dentro da plataforma via provedor de emissão (Duffel é o mais rápido de
  integrar tecnicamente; avaliar parceiro/consolidador local para questão
  regulatória — ver `01-analise-e-riscos.md`).
- Comparação de aeroportos alternativos, multidestino, bagagem, escalas máximas,
  companhias preferidas/proibidas.
- Modelo de recomendação evoluído (features de sazonalidade, eventos, séries
  temporais) — primeira versão com ML supervisionado leve, não só heurística.
- Congelamento de preço (price freeze), condicionado à parceria de emissão já estar
  madura o suficiente para sustentar a garantia financeira da feature.
- Planejamento de viagem em grupo (alerta compartilhado, votação de datas).
- Inteligência de visto/documentação por nacionalidade de passaporte.
- App como PWA (mobile-first).

## 3.6 Fase 4 — Escala

- Extração seletiva de microsserviços a partir dos módulos do monólito que tiverem
  perfil de escala diferente (ver `03-arquitetura.md`, seção de evolução).
- Expansão de produto: hotéis, aluguel de carro, seguro viagem, eSIM, sala VIP,
  programa de afiliados. Modelo de hotel e seguro já decidido em
  `12-fase7-decisoes-pendentes.md` (cross-sell de afiliado, não busca própria)
  — falta só a escolha de parceiro comercial.
- Copiloto de viagem conversacional (IA livre) via WhatsApp, como capacidade Premium.
- Produto de dados B2B (tendências agregadas e anonimizadas de tarifa para
  companhias/agências), sujeito a revisão de compliance/LGPD.
- Avaliação de acreditação IATA própria / operação como agência licenciada.
- Internacionalização (outros mercados além do Brasil).
- Migração de mensageria SQS → Kafka se o volume de eventos de
  monitoramento/analytics justificar (ver justificativa em `03-arquitetura.md`).

## 3.7 Métrica norte (North Star)

**Economia validada por usuário**: soma do (preço médio da rota no momento da criação
do alerta − preço no momento da compra ou clique de compra), agregada por usuário.
É a métrica que prova a proposta de valor central e deve ser exibida de volta ao
usuário no dashboard ("você economizou R$X este ano").

> **Atualização (`12-fase7-decisoes-pendentes.md` §8):** com o reposicionamento
> para assistente de custo total da viagem, esta métrica permanece a North Star
> por enquanto (passagem continua o núcleo), mas deve ser revisitada quando
> hotel/seguro tiverem volume relevante — nesse momento, "economia validada"
> pode fazer mais sentido agregada por viagem (passagem + hotel + seguro) do que
> só por passagem. Não é uma mudança a fazer agora; é um lembrete para quando a
> Fase 7 tática avançar o suficiente para o dado existir.
