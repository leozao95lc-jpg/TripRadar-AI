# 13. Deploy da Versão Privada (Beta Fechado)

> Pesquisa feita em julho de 2026. Objetivo: recomendar onde colocar o
> TripRadar no ar para uso real com poucos usuários (item 4 das próximas
> prioridades), antes de qualquer expansão de funcionalidade — item 5,
> "medir antes de expandir", depende deste deploy existir.

**✅ Aprovado: Render + Vercel.** A configuração de deploy (§8) já está pronta
no repositório — `render.yaml`, Dockerfile atualizado, `.env.example`
completo. O que falta são só ações que só você pode fazer (criar as contas,
gerar secrets reais, decidir a lista de convidados) — ver §9.

## 1. Por que isto diverge do que `03-arquitetura.md` já diz

`03-arquitetura.md` §4.3 já especifica uma stack AWS completa — ECS Fargate,
RDS, ElastiCache, S3, CloudFront, SES, SQS+EventBridge, Secrets Manager,
CloudWatch, WAF+Shield — tudo marcado "Desde o MVP". Isso continua certo
como destino, mas "Desde o MVP" foi escrito pensando em lançamento público,
não neste beta fechado com poucos usuários convidados. Montar a stack AWS
inteira agora custa tempo de setup (todos esses serviços configurados,
IAM, VPC, secrets) e dinheiro (mesmo em baixo tráfego, um ECS Fargate +
RDS + ElastiCache + NAT Gateway sozinhos já passam de US$100/mês só de
"estar ligado") por um público que ainda não existe.

**Recomendação:** tratar o deploy como duas etapas, não uma:

1. **Agora — beta privado**: plataforma gerenciada mais simples e barata,
   builds de minutos, sem operar infraestrutura própria.
2. **Depois — lançamento público / Fase de Escala**: migrar para a stack AWS
   já desenhada em `03-arquitetura.md`, quando houver tráfego/receita real
   que justifique o investimento operacional.

Isso não é uma mudança de arquitetura da aplicação — o código não sabe nem
precisa saber onde está rodando (é por isso que `FlightSearchProvider`,
`NotificationSender`, `CacheClient` etc. são todos portas/interfaces desde o
início). É só uma sequência diferente de *onde* rodar o mesmo código.

## 2. O que a aplicação realmente precisa, hoje

| Peça | Necessário agora? | Observação |
|---|---|---|
| Servir a API (FastAPI) | Sim | Web service com HTTPS público |
| Rodar `price_polling_worker.py` periodicamente | Sim | Precisa de agendamento (cron), não de processo sempre ligado |
| Banco Postgres real | Sim | Hoje só testado em SQLite (dev/CI) — nunca rodou contra Postgres de verdade, vale validar isso *antes* de haver dado real de usuário nele |
| Redis | **Não, ainda** | `CachedFlightSearchProvider` já cai para cache em memória quando `redis_url` está vazio (ver `modules/providers/infrastructure/resilience.py`); com uma única instância rodando (que é o caso aqui), isso é equivalente na prática. Adicionar Redis só quando houver mais de uma réplica ou o cache em memória se mostrar insuficiente |
| Servir o frontend (Next.js) | Sim | Tem páginas ISR (`/voos/[origin]/[destination]`) que se beneficiam de um host com suporte nativo a isso |
| Webhook do WhatsApp Cloud API | Sim, se o canal WhatsApp for testado no beta | Precisa de URL HTTPS pública estável |
| Secrets (JWT, SMTP, WhatsApp, Amadeus) | Sim | Qualquer plataforma com variável de ambiente gerenciada resolve nesta fase — Secrets Manager fica pra Fase de Escala |
| WAF / proteção DDoS dedicada | Não | Não faz sentido pra um beta fechado com lista de convidados |

## 3. Comparação de plataformas para o backend (API + worker + Postgres)

| | **Render** | **Railway** | **Fly.io** |
|---|---|---|---|
| Web service | Sim, plano fixo (Starter ~US$7/mês) | Sim, cobrança por uso (CPU/memória/rede por minuto) | Sim, cobrança por uso |
| Worker/cron agendado | **Tipo de serviço dedicado**, com UI própria — é exatamente o que `price_polling_worker.py` precisa | Suporte a cron existe mas é via plugin, menos nativo | Precisa configurar manualmente (`fly.toml` + agendador externo ou Fly Machines com schedule) |
| Postgres gerenciado | Nativo (Render Postgres), backups automáticos | Nativo (template Postgres) | Fly Postgres existe, mas a própria Fly.io é explícita que **não é totalmente gerenciado** (você opera mais coisa) |
| Redis gerenciado | Nativo (Render Key Value), se/quando precisar | Nativo (template Redis) | Não nativo |
| Previsibilidade de custo | Alta — plano fixo por serviço | Média — varia com uso real | Média — varia com uso real |
| Curva de operação | Baixa — tudo dentro do painel, pouco YAML | Baixa-média | Média-alta — mais próximo de operar containers de verdade |
| Estimativa mensal (web + worker/cron + Postgres, sem Redis) | **~US$15–20/mês** (Starter web + Cron Job cobrado por minuto de execução, já que o worker roda em lotes curtos, não fica ligado + Postgres básico) | Variável, potencialmente mais barato se o uso for baixo, mas menos previsível | Similar, com mais esforço de configuração |

**Recomendação: Render.** O motivo decisivo não é preço (os três são
próximos nesta escala), é que `price_polling_worker.py` já é desenhado como
um job em lote, curto, agendado (documentado no próprio arquivo: "entry
point de um job agendado... não de um processo de longa duração") — e
Render é a única das três com um tipo de serviço "Cron Job" de primeira
classe pra exatamente isso, com UI própria e cobrança só pelo tempo rodando
(não por estar ligado o mês inteiro). Railway exigiria configuração via
plugin; Fly.io exigiria montar o agendamento por fora. Menos peça pra
manter funcionando é o critério certo numa fase em que ninguém está
operando isso em tempo integral.

## 4. Frontend: Vercel, separado do backend

O Next.js (`apps/web`) já usa `generateMetadata`, ISR (`export const
revalidate`) e as convenções de `sitemap.ts`/`robots.ts` — tudo desenhado
para a plataforma que o próprio framework assume por padrão. Vercel tem
tier gratuito generoso o suficiente pra um beta fechado, deploy automático
por push, e zero configuração pras páginas ISR que já existem
(`/voos/[origin]/[destination]`). Não há motivo pra servir o frontend do
mesmo lugar que o backend — são preocupações independentes, e a
`NEXT_PUBLIC_API_URL` já é a única costura entre os dois.

## 5. O que fica de fora deste primeiro deploy, deliberadamente

- **Cloudflare na frente** (WAF, bot protection) — útil pro lançamento
  público, desnecessário pra uma lista de convidados. Adicionar antes de
  abrir cadastro público, não antes.
- **Redis** — ver tabela da Seção 2; só entra quando o cache em memória se
  mostrar insuficiente ou houver mais de uma réplica.
- **Observability externa paga** (Datadog, Sentry) — `structlog` +
  `/metrics` (Prometheus, já implementado na Fase 5.5) e o dashboard
  administrativo (`/admin`) já dão visibilidade suficiente pra um beta
  fechado; um scraper Prometheus gratuito (ex.: Grafana Cloud free tier)
  resolve se quiser gráfico, sem custo.
- **Fila de mensageria real (SQS)** — o event bus em processo já documentado
  em `shared/events.py` continua servindo; extrair pra fila real só faz
  sentido junto com a extração de serviço, que é item de Fase de Escala.

## 6. Definition of done deste deploy

- [x] **Postgres real validado** — nunca tinha rodado fora de SQLite até
      agora. Testado de ponta a ponta contra Postgres 16 real localmente:
      `alembic upgrade head`, registro de usuário, worker de polling,
      dashboard administrativo, `/metrics` — todos funcionando. No processo,
      encontrado e corrigido um gap real: três tabelas (Fase 5.5) nunca
      tinham migração Alembic, só existiam via `create_all()` em teste — ver
      `apps/api/migrations/versions/0006_obs_analytics_flags.py`. Sem essa
      validação, o primeiro deploy real quebraria na primeira chamada ao
      worker ou ao `/admin`.
- [x] **Configuração de deploy pronta** — `render.yaml`, Dockerfile
      atualizado (incluía `src/` mas não `workers/`), `.env.example`
      completo (11 variáveis que existiam no código mas não estavam
      documentadas foram adicionadas). Ver §8.
- [ ] Variáveis de ambiente de produção com valores **reais** preenchidas —
      o `render.yaml` já lista exatamente quais (`sync: false`), mas os
      valores em si (JWT secret novo, credenciais de SMTP/WhatsApp/Amadeus)
      só você pode gerar/fornecer.
- [ ] `price_polling_worker.py` rodando no agendamento configurado, com pelo
      menos uma execução real verificada via `/admin` (heartbeat visível) —
      depende do deploy acontecer de verdade.
- [ ] Domínio próprio apontado (mesmo que um subdomínio), HTTPS ativo.
- [ ] **Lista de convidados / allowlist — ainda sem decisão.** Hoje o
      registro (`POST /api/v1/auth/register`) é aberto para qualquer um; um
      "beta privado com poucos usuários" normalmente implica algum tipo de
      controle de quem entra. Isso não foi implementado ainda porque é uma
      decisão de produto, não técnica — ver §9, pergunta 3.
- [ ] Confirmação de que o `CORS_ALLOW_ORIGINS` de produção aponta pro
      domínio real do frontend (Vercel), não `localhost` — campo já existe
      no `render.yaml` como `sync: false`, só falta o valor real.

## 7. Limitação desta sessão: build do Docker não pôde ser validado

Tentei validar o `Dockerfile` com um build real (`docker build`) antes de
recomendar o `render.yaml` — o daemon Docker está disponível neste ambiente,
mas o pull da imagem base (`python:3.11-slim`) foi bloqueado pela política de
rede da sessão (`403` da política de egress ao tentar alcançar o registry do
Docker Hub, não um erro transitório — conferido em
`http://127.0.0.1:42145/__agentproxy/status`). Não tentei contornar isso.

Isso não bloqueia o deploy: o **build de verdade vai acontecer do lado da
Render**, que não tem essa restrição. A mudança no Dockerfile foi mínima e de
baixo risco (uma linha, `COPY workers ./workers`, para o cron job conseguir
rodar `price_polling_worker.py` a partir da mesma imagem) — mas vale
observar o primeiro build real no painel da Render (ou rodar `docker build`
localmente na sua máquina, se preferir validar antes) antes de considerar o
deploy 100% liso.

## 8. Configuração já pronta no repositório

- **`render.yaml`** (raiz do repo) — Blueprint completo: banco Postgres,
  web service da API (com `preDeployCommand: alembic upgrade head` — migração
  roda em todo deploy, automaticamente, nunca à mão), e o cron job do worker
  (agendado de hora em hora por padrão, ajustável). Cada secret está marcado
  `sync: false` com um comentário explicando o que preencher.
- **`apps/api/Dockerfile`** — corrigido para incluir `workers/` (faltava;
  sem isso o cron job não teria o script pra rodar).
- **`apps/api/.env.example`** — completo: 11 variáveis que já existiam em
  `shared/config.py` desde a Fase 6 (timeouts, retries, circuit breaker,
  cache TTL da Amadeus) não estavam documentadas aqui; adicionadas com os
  mesmos defaults do código.
- **`apps/web/.env.example`** (novo — não existia) — as duas variáveis que o
  frontend de fato usa (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`).

## 9. O que só você pode fazer a partir daqui

1. **Criar as contas** — Render e Vercel, conectadas ao repositório GitHub.
2. **Gerar/fornecer os secrets reais** — a lista exata está no `render.yaml`
   (todo campo `sync: false`); o Render pede cada um no momento de aprovar o
   Blueprint.
3. **Decidir o mecanismo de allowlist** (DoD §6) — três opções, do mais simples
   ao mais robusto: (a) nenhum controle técnico, só não divulgar a URL
   amplamente; (b) uma senha/código de acesso compartilhado exigido no
   registro; (c) convites individuais (token único por pessoa). Nenhuma foi
   implementada — confirmar qual antes de eu construir alguma.
4. **No Vercel**, configurar o projeto com *Root Directory* = `apps/web`
   (é ajuste do painel do Vercel, não algo que um arquivo no repo resolva
   sozinho, por ser um monorepo).
5. **Confirmar a região** `ohio` no `render.yaml` — ou trocar por outra, se o
   dashboard da Render oferecer algo com latência melhor pro Brasil no
   momento do deploy.

Depois dessas cinco coisas, o deploy é literalmente aprovar o Blueprint no
painel da Render e importar o projeto no Vercel — a configuração para isso
já está no repositório.
