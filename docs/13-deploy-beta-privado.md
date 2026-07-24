# 13. Deploy da Versão Privada (Beta Fechado)

> Pesquisa feita em julho de 2026. Objetivo: recomendar onde colocar o
> TripRadar no ar para uso real com poucos usuários (item 4 das próximas
> prioridades), antes de qualquer expansão de funcionalidade — item 5,
> "medir antes de expandir", depende deste deploy existir. Nada foi
> provisionado ainda; isto é recomendação, não execução.

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

- [ ] Postgres real provisionado, migrações do Alembic rodadas contra ele
      (nunca testado fora de SQLite até agora — validar isso é, sozinho,
      um motivo pra fazer esse deploy cedo, não só "colocar no ar").
- [ ] Variáveis de ambiente de produção configuradas (JWT secret novo, não o
      default de dev; credenciais reais de SMTP/WhatsApp/Amadeus se
      aplicável nesta fase).
- [ ] `price_polling_worker.py` rodando no agendamento escolhido, com pelo
      menos uma execução real verificada via `/admin` (heartbeat visível).
- [ ] Domínio próprio apontado (mesmo que um subdomínio), HTTPS ativo.
- [ ] Lista de convidados definida — "poucos usuários" precisa de um
      mecanismo de convite/allowlist, que hoje não existe (registro é
      aberto) — decisão de produto simples a tomar antes do deploy, não
      depois.
- [ ] Confirmação de que o `CORS_ALLOW_ORIGINS` de produção aponta pro
      domínio real do frontend, não `localhost`.

## 7. Próximo passo

Este documento é recomendação, não execução — nenhuma conta foi criada,
nenhum recurso foi provisionado. Confirmar a escolha de plataforma (Render +
Vercel, ou outra) antes de eu prosseguir com a configuração de deploy
(Dockerfile/build config, variáveis de ambiente documentadas, checklist de
migração) — provisionar credenciais de verdade e colocar algo no ar é uma
ação que vale confirmar explicitamente antes de agir, mesmo sendo um beta
pequeno.
