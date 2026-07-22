# 3. MVP e Roadmap

## 3.1 Princípio norteador

Lançar o menor produto que valida a hipótese central — **"usuários querem ser
avisados de quando comprar, não só de quanto custa agora"** — com o menor custo e
menor risco regulatório possível. Compra dentro da plataforma e canais pagos de
notificação vêm depois de validar isso.

## 3.2 Fase 0 — Discovery (2–4 semanas)

- Landing page com proposta de valor + lista de espera.
- Pesquisa com 15–20 usuários das personas-alvo.
- Validar: as pessoas confiam em uma recomendação automática de compra? Qual canal de
  notificação elas realmente usariam?
- **Critério de saída:** ≥ 200 e-mails na waitlist ou validação qualitativa forte.

## 3.3 Fase 1 — MVP (6–10 semanas)

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
- Notificação **somente por e-mail** (AWS SES).
- Dashboard com: alertas ativos, últimas quedas, histórico de busca.
- **Sem compra integrada** — botão "Ver oferta" redireciona a um parceiro/afiliado.
- **Sem cobrança** — tudo gratuito nesta fase (ou waitlist para Premium).

**Fora de escopo (explicitamente adiado):** múltiplos aeroportos por alerta, WhatsApp/
Telegram/SMS, IA com ML, comparação de aeroportos, multidestino, emissão própria.

**Critério de saída:** taxa de abertura/clique de e-mail de alerta > benchmark de
mercado (~20%+), retenção de usuários com pelo menos 1 alerta ativo após 30 dias.

## 3.4 Fase 2 — Beta fechado (4–8 semanas)

- Convites controlados (lista de espera da Fase 0).
- Múltiplos aeroportos de origem/destino por alerta.
- Telegram e WhatsApp (via provedor tipo Twilio/Meta Business API) como canais.
- Plano Premium pago via Stripe (alertas ilimitados, histórico completo, canais
  extras) — valida disposição a pagar.
- Melhoria da heurística de recomendação com mais sinais (tendência dos últimos N
  dias, comparação com médias por temporada).
- Observabilidade básica em produção (logs estruturados, métricas, alertas de erro).

**Critério de saída:** conversão free→Premium mensurável, custo de notificação por
usuário dentro do orçamento projetado.

## 3.5 Fase 3 — V1 pública

- Compra dentro da plataforma via provedor de emissão (Duffel é o mais rápido de
  integrar tecnicamente; avaliar parceiro/consolidador local para questão
  regulatória — ver `01-analise-e-riscos.md`).
- Comparação de aeroportos alternativos, multidestino, bagagem, escalas máximas,
  companhias preferidas/proibidas.
- Modelo de recomendação evoluído (features de sazonalidade, eventos, séries
  temporais) — primeira versão com ML supervisionado leve, não só heurística.
- App como PWA (mobile-first).
- SEO programático (páginas de rota: "voos de São Paulo para Lisboa").

## 3.6 Fase 4 — Escala

- Extração seletiva de microsserviços a partir dos módulos do monólito que tiverem
  perfil de escala diferente (ver `03-arquitetura.md`, seção de evolução).
- Expansão de produto: hotéis, aluguel de carro, seguro viagem, eSIM, sala VIP,
  programa de afiliados.
- Avaliação de acreditação IATA própria / operação como agência licenciada.
- Internacionalização (outros mercados além do Brasil).
- Migração de mensageria RabbitMQ/SQS → Kafka se o volume de eventos de
  monitoramento/analytics justificar (ver justificativa em `03-arquitetura.md`).

## 3.7 Métrica norte (North Star)

**Economia validada por usuário**: soma do (preço médio da rota no momento da criação
do alerta − preço no momento da compra ou clique de compra), agregada por usuário.
É a métrica que prova a proposta de valor central e deve ser exibida de volta ao
usuário no dashboard ("você economizou R$X este ano").
