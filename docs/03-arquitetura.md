# 4. Arquitetura do Sistema

## 4.1 Estilo arquitetural: monólito modular primeiro

**Decisão:** iniciar como **monólito modular** organizado por *bounded contexts* de
DDD, com Clean Architecture dentro de cada módulo, e extrair para microsserviço
apenas o(s) módulo(s) que realmente tiverem um perfil de escala/deploy diferente do
resto.

**Por que não microsserviços desde o início:**
- Custo operacional (observability, service discovery, tracing distribuído, CI/CD por
  serviço) não se paga com o volume de usuários de um MVP/Beta.
- Times pequenos (1–3 devs) perdem mais velocidade coordenando serviços do que ganham
  em isolamento.
- Boundaries de domínio ainda não estão 100% validados no início — extrair cedo demais
  costuma travar em fronteiras erradas.

**Por que preparar para extrair depois:** cada módulo (`identity`, `alerts`,
`price_monitoring`, `notifications`, `providers`, `recommendations`, `billing`) já
nasce com sua própria camada de domínio/aplicação/infraestrutura e se comunica com os
demais **apenas via interfaces e eventos de domínio** (nunca importando modelos
internos de outro módulo diretamente). Isso torna a extração futura um recorte de
pastas + troca de "chamada em processo" por "chamada de rede/fila", não uma
reescrita.

> **Atualização (revisão estratégica, `08-revisao-estrategica-latam.md`):** os
> módulos `notifications` e `recommendations` ganham capacidades novas já no MVP —
> detalhadas em 4.1.1 e 4.1.2 — e o `price_monitoring` passa a expor uma superfície
> pública de leitura para o feed de ofertas/SEO.
>
> **Atualização (Fase 6/7, `11-provider-integration-strategy.md` e
> `12-fase7-decisoes-pendentes.md` §7):** dentro de `providers`, busca de voo
> (`FlightSearchProvider`, implementado pela Fase 6) e emissão/compra (uma porta
> futura e separada, se o Modelo B de compra por parceiro for revisitado) são
> dois contratos que nunca devem se misturar numa mesma interface — mesmo
> princípio de fronteira de módulo desta seção, aplicado dentro do módulo
> `providers` entre duas responsabilidades que parecem próximas mas têm perfil
> de risco/dado sensível bem diferente.

### 4.1.1 `notifications` — WhatsApp desde o MVP

O canal WhatsApp deixa de ser uma feature de Beta e entra no MVP, por ser o principal
diferencial de canal frente a concorrentes globais (ver seção 9 da revisão
estratégica). Implementação deliberadamente simples para controlar custo/risco:
- Envio via **WhatsApp Cloud API** (Meta), usando templates de mensagem utilitária
  aprovados (alerta de queda de preço, confirmação de alerta criado).
- Criação/gestão de alerta por **bot de menu estruturado** (respostas de botão/lista,
  sem NLU livre) — evita custo e imprevisibilidade de um assistente conversacional
  aberto, que fica para a Fase de Escala (copiloto de viagem).
- Consumido via `interface/whatsapp_webhook.py` dentro do módulo, reaproveitando os
  mesmos casos de uso de `alerts` (`CreateAlert`, `UpdateAlert`) que a interface REST
  usa — o canal é só mais uma porta de entrada para o mesmo `application layer`.

### 4.1.2 `recommendations` — consultor de milhas e sinal de câmbio

Duas novas capacidades, ambas de baixo custo por dependerem de **dado de referência**,
não de integração em tempo real:
- **`mileage_advisor`**: consulta a tabela `mileage_valuations` (valor de referência
  de cents-per-mile por programa, atualizada manualmente/periodicamente) e devolve
  "pagar R$X vs. resgatar N milhas (~R$Y)" como parte da explicação da recomendação.
- **`currency_signal`**: consulta `exchange_rates` (ingestão diária via job simples)
  e adiciona ao `factors` da recomendação um sinal de câmbio favorável/desfavorável
  para rotas internacionais.

Ambas entram como **fatores adicionais no mesmo veredito explicável** já desenhado em
`AI_RECOMMENDATIONS.factors` (`04-modelo-dados.md`) — não exigem novo fluxo, só novas
fontes de dado.

### 4.1.3 `price_monitoring` — superfície pública para SEO/feed de ofertas

Um *read model* somente-leitura sobre `price_snapshots`, exposto em
`/api/v1/routes/{origin}/{destination}/deals` (ver `05-apis.md`) e renderizado como
páginas de rota no Next.js (SSG/ISR). Não introduz escrita nova — é uma projeção dos
dados que o monitoramento já coleta, mantendo o princípio de reaproveitar o core em
vez de construir um pipeline paralelo.

**Primeiros candidatos a virar serviço/worker independente (Fase 4):**
1. `price_monitoring` (jobs de polling contínuo em APIs externas — perfil de
   I/O e agendamento muito diferente do resto).
2. `notifications` (fan-out de envio, precisa escalar independentemente em picos de
   queda de preço).

## 4.2 Camadas (Clean Architecture) dentro de cada módulo

```
module/
├── domain/          # Entidades, value objects, regras de negócio puras, sem dependências externas
├── application/     # Casos de uso (use cases), portas (interfaces) de repositório e serviços externos
├── infrastructure/  # Implementação das portas: SQLAlchemy, clientes HTTP de provedores, fila
└── interface/       # Entradas: rotas FastAPI (REST), consumidores de eventos/fila
```

- **Repository Pattern**: `application` depende de interfaces (`AlertRepository`),
  `infrastructure` implementa com SQLAlchemy. Facilita testes com repositórios em
  memória e troca futura de banco/ORM.
- **Dependency Injection**: via `Depends` do FastAPI, com um container simples de
  bindings por ambiente (produção vs teste).
- **Eventos de domínio**: ex. `PriceDropped`, `AlertMatched`, `SubscriptionUpgraded`
  publicados internamente (em processo, no MVP, via um event bus simples em memória)
  e futuramente em uma fila real quando módulos forem extraídos.

## 4.3 Stack — comparação e justificativa

### Backend: FastAPI vs Django vs NestJS
| Critério | FastAPI (Python) | Django | NestJS (Node) |
|---|---|---|---|
| Async / I/O-bound (chamadas a APIs de voo) | Excelente | Fraco (sync por padrão) | Excelente |
| Tipagem e validação | Pydantic, muito forte | Fraca sem DRF+extras | Forte (TS) |
| Ecossistema de dados/IA | Excelente (pandas, scikit-learn, futura evolução de ML) | Bom | Fraco |
| Velocidade de desenvolvimento inicial | Alta | Alta (admin pronto) | Média |
| **Escolha** | ✅ | | |

FastAPI vence por equilibrar performance assíncrona (essencial ao orquestrar chamadas
a múltiplas APIs de provedores) com um ecossistema Python que facilita a evolução
futura da IA de recomendação para ML de verdade.

### Frontend: Next.js
SSR/SSG é importante para SEO programático (páginas de rota indexáveis — canal de
aquisição orgânico de baixo custo, crítico dado o CAC alto do setor). React +
TypeScript + Tailwind + Shadcn/UI dão velocidade de UI consistente; Framer Motion para
as transições que dão a sensação de "rápido e cuidado" (referência: Linear, Stripe).

### Banco de dados: PostgreSQL
Relacional por padrão (dados de usuário, alertas, assinaturas são fortemente
relacionais), com JSONB para campos semi-estruturados (ex. filtros avançados de
alerta) e possibilidade de habilitar **TimescaleDB** (extensão sobre Postgres) para a
tabela de série histórica de preços quando o volume justificar — evita introduzir um
banco de série temporal separado (ex. InfluxDB) antes de ser necessário.

### Cache: Redis
Cache de resultados de busca (TTL curto), rate limiting (contadores), e fila leve de
tarefas no MVP (`RQ`/Celery+Redis) antes de introduzir um broker dedicado.

### Mensageria: RabbitMQ vs Kafka vs SQS — justificativa da escolha

| Critério | RabbitMQ | Kafka | SQS (AWS gerenciado) |
|---|---|---|---|
| Complexidade operacional | Baixa–média | Alta | Muito baixa (gerenciado) |
| Caso de uso ideal | Filas de tarefa (job queue), roteamento | Streaming de eventos de alto volume, replay, analytics | Filas de tarefa gerenciadas, sem operar infra |
| Custo inicial | Self-host = infra própria | Self-host = infra própria e cara | Pay-per-use, baratíssimo em baixo volume |
| Replay de eventos / analytics de longo prazo | Não é o forte | Excelente | Não é o forte |

**Decisão:** começar com **Amazon SQS + EventBridge** (agendamento) no MVP/Beta —
zero infraestrutura própria para operar, custo desprezível no início, resolve tanto
fila de tarefas (envio de notificação, polling de preço) quanto agendamento
(cron de verificação de alertas). **Migrar para Kafka** na fase de Escala quando (a)
o volume de eventos de monitoramento de preço justificar streaming real e (b) surgir
necessidade de replay de eventos para alimentar o modelo de ML de recomendação com
histórico completo de eventos, não só o snapshot final em banco. RabbitMQ self-hosted
só entra em cena se em algum momento SQS não bastar tecnicamente mas Kafka ainda for
overkill — na prática, para este produto, o caminho mais provável é SQS → Kafka
direto, pulando RabbitMQ.

### Autenticação: JWT + OAuth
JWT de curta duração + refresh token, OAuth2 (Google e Apple Sign-In). No MVP,
implementação própria com bibliotecas maduras (`fastapi-users` ou equivalente) para
não gerar custo recorrente de um provedor terceirizado (Auth0/Clerk) enquanto a base
de usuários é pequena; reavaliar terceirizar se o time crescer e quiser trocar custo
de manutenção por velocidade.

### Infraestrutura e hospedagem (AWS)

| Serviço | Uso | Quando |
|---|---|---|
| **ECS Fargate** | Roda a API (FastAPI) e os workers, sem gerenciar servidor | Desde o MVP |
| **RDS PostgreSQL** | Banco principal, com backups automáticos e read replica futura | Desde o MVP |
| **ElastiCache (Redis)** | Cache e rate limiting | Desde o MVP |
| **S3** | Assets estáticos, exports, dumps de análise | Desde o MVP |
| **CloudFront** | CDN para o frontend/assets | Desde o MVP |
| **SES** | Envio de e-mail transacional/alerta | Desde o MVP |
| **SQS + EventBridge** | Fila de tarefas e agendamento de polling | Desde o MVP |
| **Secrets Manager** | Credenciais de API de terceiros (Amadeus, Duffel, etc.) | Desde o MVP |
| **CloudWatch (+ X-Ray)** | Logs, métricas, tracing | Desde o MVP |
| **WAF + Shield** | Proteção contra bots e DDoS na borda | Desde o MVP (camada básica), reforçado no Beta |
| **EKS (Kubernetes)** | Somente quando houver múltiplos serviços independentes de fato (Fase 4) e um time dedicado a operar isso | Fase de Escala |

**Cloudflare** fica na frente de tudo (DNS, WAF adicional, bot protection tipo
Turnstile, cache de borda) — combinação comum e custo-efetiva de Cloudflare (borda) +
AWS (compute/dados).

## 4.4 Observabilidade, qualidade e segurança operacional

- **Logs estruturados** (JSON) via `structlog`, correlação por `request_id`.
- **Testes**: `pytest` + `testcontainers` (Postgres/Redis reais em CI), cobertura
  mínima nos casos de uso de domínio (não em infraestrutura trivial).
- **Feature flags**: tabela própria no banco + cache Redis no MVP (simples, sem
  dependência externa); avaliar Unleash self-hosted na fase de Escala.
- **Rate limiting**: Redis + `slowapi`/middleware próprio nas rotas públicas e nas
  chamadas a provedores externos (para não estourar cota/custo de API).
- **Segurança**: HTTPS obrigatório (Cloudflare + ACM), criptografia em repouso (RDS/S3
  com KMS), MFA opcional via TOTP, proteção CSRF em cookies de sessão, sanitização e
  ORM parametrizado (SQLAlchemy) contra SQL Injection, CSP e escaping padrão do
  React/Next contra XSS, tabela de auditoria (`audit_logs`) para ações sensíveis
  (login, alteração de alerta, upgrade de plano, exclusão de conta — importante para
  LGPD), RBAC simples (roles `user`/`admin` no MVP).
