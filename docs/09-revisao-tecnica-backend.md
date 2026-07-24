# 9. Revisão Técnica do Backend (Fases 1–4)

> Revisão feita na postura de um Tech Lead entrando no projeto agora, lendo o código
> como está no branch, não como pretendia ficar. Cada achado foi verificado no código
> (arquivo/função citados), não é uma impressão geral. Nenhum código foi alterado —
> isto é só o relatório, conforme pedido.

## Resumo executivo

| Severidade | Qtde |
|---|---|
| 🔴 Alta | 7 |
| 🟡 Média | 11 |
| 🟢 Baixa | 10 |

O core (Clean Architecture por módulo, comunicação só por evento, repository pattern)
está bem executado e os limites entre módulos são reais, não decorativos. Os problemas
sérios não estão na forma — estão em **um bug de correção funcional no coração do
produto** (matching de alerta ignora data), **um vetor de abuso não verificado**
(notificação para destino arbitrário) e **uma decisão de transação que não escala**
(todo o worker é uma transação só). Nenhum desses é difícil de corrigir, mas os três
juntos são o tipo de coisa que devia ter sido pega em code review antes do merge.

---

## 🔴 Alta

### 1. Alertas disparam por engano quando há mais de uma data para a mesma rota
**Arquivo:** `modules/alerts/application/use_cases.py:105-140`,
`modules/alerts/infrastructure/repository.py:101` (`list_active_matching_route`)

`EvaluateAlertsForRoute` casa um snapshot de preço com alertas ativos usando só
`origin_iata + destination_iata + cabin_class` — **`departure_date` nunca entra na
comparação**. Se dois usuários tiverem alerta para FLN→MAD econômica, um para
10/nov e outro para 25/dez, um snapshot barato para a data de um dispara o alerta do
outro também. O worker até poll-a cada data separadamente (o dedup em
`list_distinct_active_routes` inclui `departure_date` corretamente), mas a avaliação
do gatilho joga essa informação fora.

**Por que é Alta:** é um bug de corretude na funcionalidade central do produto — o
usuário recebe "seu preço caiu" para uma data que não é a dele. Isso é exatamente o
tipo de falha que corrói a confiança que a revisão estratégica (`08-revisao-estrategica-latam.md`)
aposta como diferencial.

**Correção:** incluir `departure_date` (e provavelmente `return_date`) no filtro de
`list_active_matching_route`, ou — melhor a médio prazo — casar por uma janela de
datas quando `flexible_dates=True`.

### 2. Preferência de notificação aceita qualquer destino, sem verificação de posse
**Arquivo:** `modules/notifications/interface/routes.py:29-42` (`set_preference`),
`modules/notifications/application/use_cases.py` (`SetNotificationPreference`)

`PUT /api/v1/notifications/preferences` deixa o usuário autenticado setar
`destination` (e-mail ou telefone) para **qualquer string**, sem confirmar que aquele
e-mail/telefone pertence a ele (nenhum fluxo de verificação, nenhum "confirme seu
e-mail"/OTP). Combinado com `POST /api/v1/alerts` sem rate limit e sem
`Idempotency-Key` (a API doc promete o header, o código não implementa — ver #9),
um usuário mal-intencionado pode criar um alerta com `max_price_cents` absurdamente
alto (dispara na próxima coleta) apontando o canal `whatsapp`/`email` para o contato de
terceiros. Isso vira um vetor de spam/harassment usando a infraestrutura de envio da
própria TripRadar (e risco real de a conta da WhatsApp Business API ser banida pela
Meta por abuso).

**Por que é Alta:** é um problema de abuso de plataforma com impacto reputacional e
operacional direto (banimento de conta de mensageria), não hipotético.

**Correção:** exigir confirmação de posse do destino (link de confirmação por
e-mail; código OTP por WhatsApp) antes de habilitar o canal, e rate-limit em
criação de alerta.

### 3. O worker é uma transação única — uma falha em qualquer evento reverte o lote inteiro
**Arquivo:** `workers/price_polling_worker.py:76-87` (`with session_scope() as db: for route in routes: ...`)

Toda a rodada de polling (potencialmente centenas/milhares de rotas quando o produto
crescer) roda dentro de **um único `session_scope()`**, e cada `event_bus.dispatch(...)`
reusa essa mesma sessão/transação (decisão tomada na Fase 3 para resolver um deadlock
de SQLite em teste — ver `shared/database.py`). Isso resolveu o problema de teste, mas
introduziu um problema de produção: se a avaliação de alerta ou o despacho de
notificação da rota #3 de 500 lançar uma exceção não tratada, o `except`/`rollback`
de `session_scope()` desfaz **todos os snapshots já coletados no lote**, inclusive os
das rotas #1 e #2 que tinham sido salvos com sucesso.

**Por que é Alta:** em escala, isso transforma uma falha pontual e localizada (um
alerta mal formado, um erro transitório de banco numa notificação) em perda de dados
de monitoramento de toda a rodada — o oposto do que "motor de monitoramento
desacoplado" deveria garantir.

**Correção:** ou (a) uma transação por rota, com commit incremental e log/skip de
falhas individuais, ou (b) manter uma transação por lote mas capturar exceções de
`event_bus.dispatch()` por evento, sem deixar uma falha de handler derrubar a
gravação do dado principal.

### 4. Direito de exclusão de conta (LGPD) não tem caminho de implementação
**Arquivo:** modelo de dados inteiro — nenhum endpoint `DELETE /me`, nenhuma FK entre
módulos (decisão deliberada, documentada em `alerts/infrastructure/models.py`)

A decisão de não usar FK entre bounded contexts (user_id em `search_alerts`,
`notification_preferences`, etc. são todos "soft references") é defensável em DDD e
evita o deadlock do achado #3 do relatório anterior — mas tem um custo que não foi
endereçado: **sem FK, não existe `ON DELETE CASCADE`**. Excluir uma conta hoje exigiria
código de limpeza escrito à mão tocando `search_alerts`, `alert_triggers`,
`notification_preferences`, `notifications`, `ai_recommendations`, `oauth_accounts` —
e esse código não existe, nem o endpoint que o chamaria. `docs/01-analise-e-riscos.md`
lista "direito de exclusão" como requisito de LGPD; hoje é inatingível sem uma
migração de dívida técnica.

**Correção:** decidir agora — ou um evento `user_deletion_requested` que cada módulo
assina e limpa seus próprios dados (consistente com o padrão de eventos já usado), ou
uma rotina administrativa centralizada. O importante é decidir antes de acumular mais
módulos com dados de usuário.

### 5. Tabela de auditoria existe, mas nunca é escrita
**Arquivo:** `modules/identity/infrastructure/models.py` (`AuditLogModel`) —
`grep` por `audit_log` no restante de `src/` não retorna nenhum uso.

`audit_logs` foi criada na Fase 1 com o comentário "ações sensíveis (login, alteração
de alerta, upgrade de plano, exclusão de conta) — LGPD", mas nenhuma linha de código
em nenhuma das quatro fases insere uma linha nela. É uma tabela morta.

**Por que é Alta e não Média:** porque os documentos de arquitetura (`03-arquitetura.md`)
e de riscos (`01-analise-e-riscos.md`) citam auditoria como parte do compromisso de
compliance — isso hoje é falso no código, não "ainda não priorizado". Qualquer
apresentação do sistema como "auditável" seria imprecisa.

**Correção:** ou implementar (mínimo: login, criação/exclusão de alerta, mudança de
preferência de notificação) ou remover a tabela e a alegação até que seja verdade.

### 6. Nenhum endpoint tem rate limiting — nem `/auth/login`
**Arquivo:** nenhum middleware de rate limit em `main.py`; `shared/config.py` não tem
nenhum parâmetro relacionado; `redis` está nas dependências mas não é importado em
lugar nenhum de `src/` (confirmado via grep).

`03-arquitetura.md` promete "Rate limiting: Redis + slowapi ... nas rotas públicas e
nas chamadas a provedores externos". Nada disso existe. `/api/v1/auth/login` aceita
tentativas ilimitadas — brute force e credential stuffing são triviais hoje. Também
não há limite de taxa nas chamadas ao futuro provedor de voo (quando a Fase 6 plugar
o Amadeus real, nada impede o worker de estourar cota/custo de API se o número de
alertas crescer rápido).

**Correção:** limiter básico (mesmo em memória, por IP+rota, antes de precisar do
Redis) em `/auth/login`, `/auth/register` e `/alerts` (POST) como prioridade
imediata; rate limit no `FlightSearchProvider` antes de plugar um provedor pago.

### 7. Refresh token de 30 dias sem rotação nem revogação — e sem endpoint pra usá-lo
**Arquivo:** `modules/identity/application/use_cases.py` (`AuthenticateUser` emite
`refresh_token`), `modules/identity/interface/routes.py` — **não existe** rota
`POST /auth/refresh` (confirmado: `grep -n refresh` só encontra a emissão do token no
login, nenhum consumidor).

Dois problemas empilhados: (a) o token é emitido mas não há como trocá-lo por um novo
access token — o cliente não tem uso real para ele hoje; (b) quando essa rota for
implementada, o design atual (JWT stateless, sem tabela de sessões/allowlist) não tem
como revogar um refresh token vazado por 30 dias. Comparado ao access token de 30
minutos (janela de exposição aceitável), 30 dias sem revogação é uma escolha que
merece reconsideração explícita, não silêncio.

**Correção:** implementar `/auth/refresh` com rotação (cada uso invalida o token
anterior, registrando o `jti` usado numa tabela/Redis) antes de expor isso a
usuários reais.

---

## 🟡 Média

### 8. FastAPI foi escolhido "pela performance assíncrona" — a implementação é 100% síncrona
`03-arquitetura.md` justifica FastAPI citando explicitamente
"Async / I/O-bound (chamadas a APIs de voo): Excelente" como diferencial sobre Django.
Na prática: sessões SQLAlchemy síncronas, rotas `def` (não `async def`), driver
`psycopg` síncrono, `httpx.post` síncrono no `WhatsAppNotificationSender`. Cada
requisição roda numa thread do threadpool do Starlette — funciona, mas não entrega
nenhuma vantagem sobre uma stack síncrona convencional, e quando a Fase 6 plugar
chamadas de rede reais e concorrentes ao Amadeus, essa limitação vai aparecer.
**Não é urgente corrigir agora** (reescrever pra async é trabalho real), mas a
contradição entre a justificativa arquitetural documentada e o código merece ser
resolvida — ou comprometer com async, ou atualizar o documento para "síncrono por
simplicidade no MVP, reavaliar na Fase 6".

### 9. Migrations nunca rodam contra Postgres em CI
Os testes usam `Base.metadata.create_all()` num SQLite in-memory (`tests/conftest.py`),
nunca `alembic upgrade head`. As 4 migrations hand-written (`0001`–`0004`) só foram
validadas pelo meu próprio raciocínio ao escrevê-las — nenhum processo automatizado
verifica que elas realmente aplicam, ou que `down_revision`/ordem estão corretos
contra um Postgres de verdade. Um erro de sintaxe SQL específico do Postgres (ex.:
`server_default=sa.false()` vs. sintaxe divergente) só seria descoberto no primeiro
deploy real.

**Correção:** job de CI com Postgres como service container rodando
`alembic upgrade head` do zero a cada PR.

### 10. `list_distinct_active_routes()` não escala
**Arquivo:** `modules/alerts/infrastructure/repository.py:129-150`

Carrega **todos** os alertas ativos do banco pra memória Python a cada rodada do
worker, e deduplica com um `set()` em Python (comentário no código já reconhece isso:
"volume de alertas ativos é baixo o suficiente no MVP"). Isso é aceitável hoje, mas é
uma bomba-relógio de performance conhecida e não rastreada — não há métrica, alerta
ou limite que avise quando o volume passar do aceitável.

### 11. `price_polling_batch_size` está no `Settings`, mas nunca é lido
**Arquivo:** `shared/config.py:43` — `grep` confirma zero uso no worker ou em
qualquer outro lugar. O worker processa TODAS as rotas de uma vez, sem lotes,
sem paralelismo, sem controle de taxa contra o provedor. Configuração morta que
sugere um controle que não existe.

### 12. Redis está provisionado e listado como dependência, mas não é usado em nenhuma linha de código
Docker-compose sobe um container Redis, `pyproject.toml` lista `redis` como
dependência, `REDIS_URL` está no `.env.example` — e `grep -rn "import redis"` em
`src/` e `workers/` não retorna nada. Cache, rate limiting e fila leve (todos
prometidos em `03-arquitetura.md`) simplesmente não existem. Infraestrutura paga e
mantida sem benefício atual.

### 13. Notificação falha e morre — sem retry, sem dead-letter
`DispatchAlertNotification` grava `status="failed"` e segue em frente. Não há fila de
retry, não há backoff, não há alerta operacional de "X% das notificações falharam
hoje". Num MVP com Mailhog isso não aparece; em produção, uma instabilidade
momentânea do SES/WhatsApp Cloud API perde a notificação permanentemente, e ninguém
fica sabendo — nem o time, nem o usuário.

### 14. Middleware de log não captura requisições que lançam exceção não tratada
**Arquivo:** `shared/middleware.py` — `response = await call_next(request)` não está
dentro de um `try/except`. Se a rota lançar uma exceção não tratada, a linha
`logger.info("http_request", ...)` **nunca executa** — a requisição que mais importa
logar (a que quebrou) é exatamente a que fica sem `request_id`, sem `duration_ms`,
sem entrada estruturada nenhuma no log. Isso mina diretamente o pilar de
observabilidade que os documentos de arquitetura prometem.

### 15. Sem paginação em nenhum endpoint de listagem
`GET /api/v1/alerts`, `GET /api/v1/routes/{o}/{d}/history` — todos retornam a lista
inteira. Aceitável hoje (poucos alertas por usuário, `range_days` limitado a 365),
mas `05-apis.md` já documenta paginação por cursor como convenção e nada foi
implementado — a lacuna entre documentado e real vai doer primeiro no endpoint de
histórico, que cresce sem limite (ver #16).

### 16. `price_snapshots` cresce para sempre, sem retenção nem rollup
Nenhum job de limpeza, nenhuma migração pra hypertable/particionamento, nenhum rollup
diário após N dias — tudo isso está em `docs/04-modelo-dados.md` como plano, zero
está implementado. Não é urgente com o volume atual (mock provider, poucas rotas),
mas também não há métrica de tamanho de tabela monitorada pra saber quando vira
urgente.

### 17. Dockerfile é um multi-stage build pela metade
**Arquivo:** `apps/api/Dockerfile` — `FROM python:3.11-slim AS base` nomeia um stage
que nunca é referenciado por um segundo `FROM base`. O resultado é uma imagem única
que carrega `build-essential` e o cache de apt (mesmo com `rm -rf`, o toolchain de
compilação continua na imagem final) — maior do que precisa ser, com superfície de
ataque desnecessária em produção.

### 18. Nenhuma migração roda automaticamente ao subir o container
`Dockerfile` `CMD` vai direto para `uvicorn`. Não há entrypoint script, não há passo
de `alembic upgrade head` em lugar nenhum (nem no `docker-compose.yml`, nem no
Dockerfile). Buildar e rodar este container hoje, contra um Postgres vazio, derruba a
aplicação na primeira query — não existe caminho automatizado de "build → run →
funciona".

---

## 🟢 Baixa

### 19. Registro de conta vaza se um e-mail já existe
`POST /auth/register` retorna 409 "Email already registered" — permite enumeração de
contas por força bruta de e-mails. Trade-off comum de UX vs. segurança, mas vale uma
decisão consciente (mensagem genérica + fluxo de "esqueci minha senha" em vez de
confirmação direta é a prática mais cautelosa).

### 20. RBAC decorativo
`UserRole.ADMIN` existe no domínio, mas nenhuma rota checa role — não há
`require_admin`, não há rota administrativa ainda. Sem risco hoje (nada depende
disso), mas quando a primeira rota admin for criada, o padrão de enforcement precisa
ser desenhado, não improvisado.

### 21. MFA decorativo
`mfa_enabled` existe na entidade e na tabela; nenhum fluxo de TOTP (setup, QR code,
verificação) existe. Mesma categoria do #20 — coluna sem função.

### 22. Sem cabeçalhos de segurança na aplicação
Nenhum CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS configurado no FastAPI
— a expectativa é que Cloudflare/borda cuide disso (`03-arquitetura.md` menciona),
mas a aplicação não deveria depender 100% da borda para isso; vale um middleware
mínimo mesmo com Cloudflare na frente (defesa em profundidade).

### 23. `DeleteAlert` é hard delete
Sem soft-delete, sem histórico do que foi excluído. Para uma métrica futura como
"quantos alertas foram criados vs. abandonados" ou para suporte ao cliente
("eu tinha um alerta, sumiu"), a exclusão física perde esse rastro.

### 24. Inconsistência de `created_at`/`updated_at` entre modelos
`UserModel` tem os dois; `SearchAlertModel`, `PriceSnapshotModel` etc. têm só
`created_at`. Quando `PATCH /alerts/{id}` for implementado (documentado, não feito —
ver #25), não há coluna pra registrar a última edição.

### 25. `PATCH /api/v1/alerts/{id}` está documentado, não implementado
`05-apis.md` lista o endpoint; só existem `POST`, `GET`, `DELETE`. Não é um bug (a
Fase 3 não prometia CRUD completo), só uma lacuna entre o contrato documentado e o
real que vale fechar antes do frontend assumir que ele existe.

### 26. `EventBus.dispatch` não tem proteção contra ciclo
**Arquivo:** `shared/events.py` — o loop `while queue: ... queue.extend(new_events)`
não tem limite de profundidade/iterações. Hoje o grafo de eventos é um DAG conhecido
(sem ciclos), mas nada no código impede que um handler futuro reintroduza um evento
já processado e cause um loop infinito síncrono dentro de uma requisição HTTP.

### 27. Sem mypy/type-checking em CI
`pyproject.toml` não lista `mypy`; CI roda só `ruff check`. O projeto usa tipagem
(`Mapped[...]`, dataclasses tipados) mas nada verifica se as anotações batem.

### 28. Cobertura de teste não é medida
`pytest-cov` está instalado (`pyproject.toml`, extras `dev`) mas o CI roda
`pytest -q` sem `--cov` — a ferramenta está lá, o número não existe.

## Observações que não classifiquei como achado, mas valem registrar

- **Regra de negócio hardcoded**: o limite de 3 alertas do plano Free está em
  `_MAX_ACTIVE_ALERTS_BY_PLAN` dentro de `alerts/infrastructure/identity_plan_adapter.py`
  — um dict Python, não uma feature flag/config. Mudar o limite hoje exige deploy.
  Os documentos de arquitetura citam feature flags como pilar; isso seria o primeiro
  candidato real a usar esse mecanismo.
- **Plano Premium é inatingível**: sem billing/Stripe (fora do escopo desta fase, por
  design), não existe nenhum caminho — nem manual — para um usuário sair do plano
  Free. Não é bug, mas dificulta testar/demonstrar o comportamento de limite
  desabilitado hoje.
- **Validação de entrada inconsistente**: `CreateAlertRequest.departure_date` é
  `str` livre (sem checagem de formato de data pelo Pydantic) — uma data inválida só
  falha lá na frente, dentro do repositório, com um `ValueError` não tratado
  (500 cru). Comparar com `range_days` no endpoint de histórico, que usa
  `Query(ge=1, le=365)` corretamente. O padrão bom existe no código; só não foi
  aplicado uniformemente.
- **Sem teste automatizado do fluxo OAuth Google**: compreensível sem credenciais
  reais, mas hoje um `oauth.py` quebrado só seria descoberto em produção.
- **Sem scan de vulnerabilidade de dependências** (`pip-audit`/Dependabot) no CI.

---

## Se eu tivesse que escolher só cinco para resolver antes do frontend

1. **#1 — matching de alerta por data.** É o bug que mais rápido gera desconfiança
   de usuário real, e o fix é pequeno (um parâmetro a mais na query).
2. **#3 — transação única do worker.** Vira dor operacional real assim que o volume
   de alertas passar de umas dezenas.
3. **#2 — verificação de destino de notificação.** Risco de abuso que só cresce
   com mais usuários; mais barato resolver agora do que depois de um ban da Meta.
4. **#6 — rate limit básico em `/auth/*` e `POST /alerts`.** Poucas linhas,
   fecha a lacuna de segurança mais óbvia.
5. **#14 — logging de exceção não tratada no middleware.** Sem isso, qualquer um
   dos outros bugs em produção vai ser mais difícil de diagnosticar do que precisa.

Os demais (#4, #5, #7 inclusive) são reais e importantes, mas dão pra sequenciar
depois desses cinco sem acumular mais dívida em cima.
