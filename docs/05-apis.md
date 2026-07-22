# 6. Design de APIs

API REST versionada (`/api/v1`), documentada automaticamente via OpenAPI/Swagger
(nativo do FastAPI). Autenticação via `Authorization: Bearer <jwt>`.

## 6.1 Identity

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/auth/register` | Cria conta (e-mail/senha) |
| POST | `/api/v1/auth/login` | Login, retorna access+refresh token |
| POST | `/api/v1/auth/refresh` | Renova access token |
| GET | `/api/v1/auth/oauth/{provider}/callback` | Callback OAuth (Google/Apple) |
| GET | `/api/v1/me` | Perfil do usuário autenticado |
| PATCH | `/api/v1/me` | Atualiza perfil / preferências |
| POST | `/api/v1/me/mfa/enable` | Ativa MFA (TOTP) |

## 6.2 Alerts

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/alerts` | Lista alertas do usuário |
| POST | `/api/v1/alerts` | Cria alerta |
| GET | `/api/v1/alerts/{id}` | Detalhe do alerta |
| PATCH | `/api/v1/alerts/{id}` | Atualiza alerta |
| DELETE | `/api/v1/alerts/{id}` | Remove alerta |
| GET | `/api/v1/alerts/{id}/history` | Histórico de preço da rota do alerta (`?range=7d\|30d\|90d\|180d\|365d`) |
| GET | `/api/v1/alerts/{id}/recommendation` | Recomendação atual da IA para o alerta |

**Exemplo — criar alerta:**
```json
POST /api/v1/alerts
{
  "trip_type": "round_trip",
  "origins": ["FLN", "POA"],
  "destinations": ["MAD"],
  "flexible_dates": false,
  "departure_date": "2026-11-10",
  "return_date": "2026-11-24",
  "max_price_cents": 320000,
  "currency": "BRL",
  "cabin_class": "economy",
  "passengers": 1,
  "max_stops": 1,
  "alternative_airports_ok": true
}
```

**Exemplo — resposta de recomendação:**
```json
GET /api/v1/alerts/{id}/recommendation
{
  "verdict": "wait",
  "confidence": 0.82,
  "current_price_cents": 342000,
  "target_price_cents": 290000,
  "explanation": "Nos últimos 12 meses essa rota ficou abaixo deste valor apenas 4 vezes. Historicamente entra em promoção nas próximas semanas.",
  "factors": {
    "trend_7d": "down",
    "below_avg_pct": -6,
    "seasonality": "baixa temporada em 3 semanas"
  }
}
```

## 6.3 Price Monitoring / Providers (uso interno + admin)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/routes/{origin}/{destination}/price-history` | Histórico agregado por rota (usado também para SEO/páginas públicas) |
| POST | `/internal/v1/ingestion/poll` | Disparado pelo scheduler (EventBridge) para rodar polling de um lote de alertas |

## 6.4 Notifications

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/notifications/preferences` | Lista canais configurados |
| PUT | `/api/v1/notifications/preferences` | Atualiza canais (e-mail, push, WhatsApp, Telegram — WhatsApp/Telegram exigem Premium) |
| GET | `/api/v1/notifications` | Histórico de notificações enviadas |

## 6.5 Billing

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/billing/plans` | Lista planos (free/premium) |
| POST | `/api/v1/billing/checkout-session` | Cria sessão de checkout Stripe |
| POST | `/api/v1/billing/webhook` | Webhook do Stripe (atualiza `subscriptions`) |

## 6.6 Dashboard

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/dashboard/summary` | Alertas ativos, últimas quedas, disparos recentes, economia acumulada |

## 6.7 Convenções

- Erros no formato `{"error": {"code": "...", "message": "..."}}`, códigos HTTP
  semânticos.
- Paginação por cursor em listagens (`?cursor=...&limit=...`).
- Todos os preços trafegam em **centavos + moeda explícita**, nunca float.
- Idempotência via header `Idempotency-Key` nas rotas de criação (`POST /alerts`,
  `POST /billing/checkout-session`) para evitar duplicidade em retries.
