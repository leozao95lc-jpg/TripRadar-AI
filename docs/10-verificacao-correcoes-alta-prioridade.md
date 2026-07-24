# 10. Verificação — Achados de Alta Prioridade Resolvidos

> Follow-up de `09-revisao-tecnica-backend.md`. Cobre os 5 achados que eu havia
> priorizado como "resolver antes do frontend" (4 de Alta + 1 de Média, escolhidos
> ali pela razão explicada naquele documento). Cada item abaixo tem: o que mudou, o
> teste de regressão que prova que o problema específico não volta, e como foi
> validado manualmente contra um banco real (não só os testes automatizados). Os
> outros achados do relatório anterior (achados #4, #5, #7 e os de Média/Baixa)
> **continuam em aberto** — este documento não fecha o relatório inteiro, só os 5
> itens que entramos em acordo de corrigir agora.

## Resumo

| # no relatório original | Achado | Status |
|---|---|---|
| Alta #1 | Alertas disparavam por engano entre datas diferentes | ✅ Corrigido |
| Alta #3 | Worker com transação única por lote | ✅ Corrigido |
| Alta #2 | Destino de notificação sem verificação de posse | ✅ Corrigido |
| Alta #6 | Nenhum endpoint com rate limiting | ✅ Corrigido |
| Média #14 | Middleware não loga exceção não tratada | ✅ Corrigido |

Suíte de testes: **59 passando** (eram 38 antes desta rodada de correções — 21 novos,
todos cobrindo diretamente algum dos 5 achados). `ruff check` limpo. Validado também
manualmente contra um banco SQLite em arquivo real (não só os testes), rodando a API
e o worker como processos separados — o mesmo tipo de verificação que peguei o bug
original do achado #3.

---

## 1. Alertas não filtram mais por data errada

**O que mudou:** `AlertRepository.list_active_matching_route` (porta em
`modules/alerts/application/ports.py`) agora recebe `departure_date` e só retorna
alertas cuja data bate — exceto os com `flexible_dates=True`, que continuam casando
com qualquer data (essa era a intenção original do campo, que hoje passa a ter efeito
de verdade). Implementado tanto no repositório SQLAlchemy (`or_` com a comparação de
data) quanto no fake em memória usado nos testes de unidade.

```python
# modules/alerts/infrastructure/repository.py
or_(
    SearchAlertModel.flexible_dates.is_(True),
    SearchAlertModel.departure_date == date.fromisoformat(departure_date),
),
```

O payload do evento `price_snapshot_collected` já carregava `departure_date` desde a
Fase 2; só faltava `EvaluateAlertsForRoute` (e o handler em `bootstrap.py`) repassar
esse dado adiante — a mudança não exigiu nenhum novo dado, só parar de descartar um
que já existia.

**Teste de regressão** (`tests/unit/test_alerts_use_cases.py`):
- `test_evaluate_alerts_for_route_ignores_snapshot_for_a_different_departure_date` —
  cria um alerta para 10/nov, envia um snapshot de 25/dez com preço bem abaixo do
  alvo, confirma que **não** dispara.
- `test_evaluate_alerts_for_route_matches_any_date_when_flexible` — o mesmo cenário,
  mas com `flexible_dates=True`, confirma que dispara.

**Validação manual:** criei um alerta via API para FLN→MAD 10/nov com preço-alvo
absurdamente alto (dispara garantido), rodei o worker contra o mesmo banco, e
confirmei 1 `alert_trigger` — não testei o caso de múltiplas datas manualmente porque
os testes automatizados já cobrem exatamente esse cenário isoladamente.

## 2. Worker: uma transação por rota, não uma para o lote inteiro

**O que mudou:** `workers/price_polling_worker.py` extraiu `_poll_single_route()`,
que abre seu próprio `session_scope()` por rota (poll + `event_bus.dispatch` incluídos
nessa mesma transação). O loop principal (`run()`) chama isso dentro de um
`try/except` por rota — uma falha loga (`price_polling_route_failed`) e segue para a
próxima, sem derrubar o que já foi commitado.

```python
for route in routes:
    try:
        _poll_single_route(provider, route)
        routes_ok += 1
    except Exception:
        routes_failed += 1
        logger.exception("price_polling_route_failed", route=...)
```

**Teste de regressão** (`tests/integration/test_price_polling_worker.py`):
`test_a_failing_route_does_not_roll_back_previously_collected_snapshots` usa um
`FlakyProvider` que falha deliberadamente na 2ª de 3 rotas (contra um SQLite em
arquivo real, não em memória — precisa de persistência de verdade entre a falha e a
verificação) e confirma que os snapshots da 1ª e da 3ª rota **continuam no banco**,
só a 2ª foi perdida.

**Validação manual:** rodei o worker duas vezes contra o mesmo banco (uma vez sem
alerta nenhum, caindo nas rotas-semente; outra vez com um alerta real criado via API)
e conferi `routes_ok`/`routes_failed` no log estruturado em ambos os casos.

## 3. Notificação: e-mail sempre da própria conta, WhatsApp com verificação por código

**O que mudou:**
- **E-mail**: `SetNotificationPreference` ignora qualquer `destination` enviado pelo
  cliente quando `channel=email` e usa sempre `current_user.email` — não existe mais
  caminho para apontar o canal de e-mail para um terceiro.
- **WhatsApp/Telegram**: a preferência é criada com `enabled=False` e um código de
  6 dígitos (hash SHA-256, expira em 10 min) é enviado ao destino informado. Só
  depois de confirmar via `POST /api/v1/notifications/preferences/verify` o canal
  passa a `enabled=True` — e só então `DispatchAlertNotification` (que já filtrava
  por `enabled=True`) passa a enviar pra ele.
- Novo campo `pending_verification` na resposta de `GET/PUT /preferences`, pra tela
  de configurações mostrar o estado real em vez de um "habilitado" que ainda não é.

**Teste de regressão** (`tests/unit/test_notifications_use_cases.py` +
`tests/integration/test_notifications_api.py`):
- `test_set_preference_for_email_always_uses_account_email_ignoring_destination` —
  tenta setar `vitima@outrodominio.com`, confirma que o que fica salvo é o e-mail da
  conta.
- `test_set_preference_for_whatsapp_creates_pending_preference_and_sends_code`,
  `test_confirm_notification_channel_enables_after_correct_code`,
  `test_confirm_notification_channel_rejects_wrong_code`,
  `test_confirm_notification_channel_rejects_expired_code` — ciclo completo de
  verificação, incluindo os dois jeitos de falhar.
- `test_dispatch_ignores_unconfirmed_whatsapp_preference` — prova que um canal
  pendente (nunca confirmado) não recebe notificação de alerta disparado, mesmo que
  o `enabled=True` tenha sido pedido na criação.
- `test_email_preference_ignores_third_party_destination`,
  `test_whatsapp_preference_starts_pending_and_requires_verification` (integração,
  via API real) — mesmo comportamento validado na camada HTTP, não só no caso de uso.

**Bug encontrado e corrigido no processo:** o teste de integração revelou que
`verification_expires_at < datetime.now(UTC)` quebrava com `TypeError: can't compare
offset-naive and offset-aware datetimes` — SQLite não preserva timezone ao ler uma
coluna `DateTime(timezone=True)` de volta (volta *naive*); Postgres preserva. Corrigido
normalizando pra UTC-aware antes de comparar (`_as_aware_utc`), então o comportamento
não depende do dialeto do banco.

**Residual conhecido, não fechado por esta correção:** isso impede que um usuário
autenticado **use a própria conta** pra atingir um terceiro. Não impede que alguém
**registre uma conta nova usando o e-mail de outra pessoa** (a TripRadar não confirma
e-mail no registro) — esse é um problema de fluxo de cadastro, não de preferência de
notificação, e continua em aberto. Sinalizado explicitamente pra não passar a
impressão de que o vetor de abuso foi 100% eliminado.

## 4. Rate limiting em `/auth/register`, `/auth/login` e `POST /alerts`

**O que mudou:** `shared/rate_limit.py` — limitador de janela deslizante em memória,
por processo, aplicado via `dependencies=[Depends(rate_limit(N, janela))]` nas rotas:
- `POST /auth/register`: 5 por hora por IP
- `POST /auth/login`: 10 por 5 minutos por IP
- `POST /alerts`: 20 por hora por IP

**Limite explícito desta correção (documentado no próprio módulo):** é em memória,
por processo — não coordena entre réplicas da API. Com mais de uma instância atrás do
load balancer, o limite efetivo multiplica pelo número de réplicas. Fecha a lacuna
mais urgente (zero proteção) sem introduzir a dependência do Redis agora; trocar por
um backend compartilhado antes de rodar mais de uma réplica em produção continua
sendo um item do relatório original (achado #12, Redis provisionado e não usado).

**Teste de regressão:**
- `tests/unit/test_rate_limit.py` — 4 testes do limitador isolado (permite dentro do
  limite, bloqueia acima, chaves independentes, libera depois da janela expirar).
- `tests/integration/test_rate_limiting_api.py` — `test_register_endpoint_is_rate_limited`
  e `test_login_endpoint_is_rate_limited` batem os limites reais via API e confirmam
  o 429 na tentativa seguinte.

**Efeito colateral pego e corrigido:** o rate limiter é outro singleton de processo
(mesmo padrão do `event_bus`) — sem resetar entre testes, os ~15 testes existentes
que chamam `/auth/register` (helper `_register_and_login` usado em quase todo teste
de integração) teriam esbarrado umas nas outras e quebrado a suíte inteira por ordem
de execução. Adicionei um fixture `autouse` em `conftest.py` que reseta o limitador
antes/depois de cada teste, no mesmo padrão já usado para o event bus.

## 5. Middleware agora loga a requisição que quebrou

**O que mudou:** `RequestContextMiddleware.dispatch` (`shared/middleware.py`) envolve
`call_next(request)` num `try/except`. Em caso de exceção não tratada, loga
`http_request_failed` (com `request_id`, `method`, `path`, `duration_ms` e o
traceback via `logger.exception`) **antes** de repropagar — o comportamento de erro
pro cliente não muda (Starlette ainda devolve o 500 padrão), só o log deixa de
desaparecer.

**Teste de regressão** (`tests/unit/test_request_context_middleware.py`): monta uma
mini aplicação FastAPI isolada (não usa `main.py`, pra não poluir a app real com uma
rota só de teste), com uma rota `/boom` que lança `RuntimeError`, e confirma via
`capsys` que `http_request_failed` e o path aparecem no log antes da resposta 500
chegar ao cliente.

---

## O que não mudou (por decisão, não por esquecimento)

- Os achados de Média/Baixa do relatório original (Redis não utilizado,
  `price_polling_batch_size` morto, migrations não testadas em Postgres real,
  paginação ausente, Dockerfile multi-stage incompleto, etc.) **continuam abertos**
  — não fizeram parte do escopo combinado desta rodada.
- Os achados de Alta #4 (exclusão de conta / LGPD), #5 (audit log nunca escrito) e #7
  (refresh token sem rotação) **também continuam abertos**. Eram Alta no relatório
  original mas não entraram nos "5 escolhidos" — ver a seção final de
  `09-revisao-tecnica-backend.md` para a justificativa de por que esses cinco e não
  outros.
- O residual do achado #2 (registro de conta com e-mail de terceiro, sem confirmação
  de e-mail no cadastro) está documentado acima como conhecido e não resolvido.
