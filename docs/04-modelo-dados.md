# 5. Modelo de Dados

Modelo relacional (PostgreSQL). Convenção: `id` como UUID, timestamps
`created_at`/`updated_at` em todas as tabelas (omitidos abaixo por brevidade).

## 5.1 Diagrama de entidades (visão MVP + Beta)

```mermaid
erDiagram
    USERS ||--o{ SEARCH_ALERTS : cria
    USERS ||--o{ OAUTH_ACCOUNTS : possui
    USERS ||--|| SUBSCRIPTIONS : assina
    USERS ||--o{ NOTIFICATION_PREFERENCES : configura
    USERS ||--o{ AUDIT_LOGS : gera
    SEARCH_ALERTS ||--o{ ALERT_AIRPORTS : referencia
    SEARCH_ALERTS ||--o{ ALERT_TRIGGERS : dispara
    SEARCH_ALERTS ||--o{ AI_RECOMMENDATIONS : recebe
    ALERT_TRIGGERS ||--o{ NOTIFICATIONS : gera
    AIRPORTS ||--o{ ALERT_AIRPORTS : usado_em
    AIRPORTS ||--o{ PRICE_SNAPSHOTS : origem_destino
    AIRLINES ||--o{ PRICE_SNAPSHOTS : opera

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string locale
        bool mfa_enabled
        string role
    }
    OAUTH_ACCOUNTS {
        uuid id PK
        uuid user_id FK
        string provider
        string provider_user_id
    }
    SUBSCRIPTIONS {
        uuid id PK
        uuid user_id FK
        string plan
        string status
        string stripe_customer_id
        string stripe_subscription_id
        timestamp current_period_end
    }
    AIRPORTS {
        string iata_code PK
        string name
        string city
        string country
        float latitude
        float longitude
    }
    AIRLINES {
        string iata_code PK
        string name
    }
    SEARCH_ALERTS {
        uuid id PK
        uuid user_id FK
        string trip_type
        date departure_date_start
        date departure_date_end
        date return_date_start
        date return_date_end
        bool flexible_dates
        int max_price_cents
        string currency
        string cabin_class
        int passengers
        string baggage_option
        int max_stops
        int max_duration_minutes
        bool alternative_airports_ok
        jsonb preferred_airlines
        jsonb blocked_airlines
        string status
    }
    ALERT_AIRPORTS {
        uuid id PK
        uuid alert_id FK
        string airport_iata FK
        string role
    }
    PRICE_SNAPSHOTS {
        uuid id PK
        string origin_iata FK
        string destination_iata FK
        date departure_date
        date return_date
        string cabin_class
        int price_cents
        string currency
        string airline_iata FK
        string source_provider
        timestamp collected_at
    }
    ALERT_TRIGGERS {
        uuid id PK
        uuid alert_id FK
        uuid price_snapshot_id FK
        int price_at_trigger_cents
        string reason
        timestamp triggered_at
    }
    AI_RECOMMENDATIONS {
        uuid id PK
        uuid alert_id FK
        string verdict
        float confidence
        jsonb factors
        string explanation_text
        timestamp generated_at
    }
    NOTIFICATION_PREFERENCES {
        uuid id PK
        uuid user_id FK
        string channel
        bool enabled
        string destination
    }
    NOTIFICATIONS {
        uuid id PK
        uuid alert_trigger_id FK
        string channel
        string status
        timestamp sent_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        string action
        jsonb metadata
        timestamp occurred_at
    }
```

## 5.2 Notas de modelagem

- **`SEARCH_ALERTS` × `ALERT_AIRPORTS`**: um alerta pode ter múltiplos aeroportos de
  origem e/ou destino (campo `role` = `origin`/`destination`), atendendo ao requisito
  de múltiplos aeroportos desde o desenho do schema — mesmo que o MVP restrinja isso
  na camada de aplicação (1 origem, 1 destino) para reduzir escopo.
- **`PRICE_SNAPSHOTS`**: candidata natural a virar *hypertable* do TimescaleDB
  (particionada por `collected_at`) quando o volume crescer; índice composto em
  `(origin_iata, destination_iata, departure_date, cabin_class, collected_at)` para
  as consultas de histórico. Rollup diário/semanal após 90 dias para conter o
  crescimento (guarda `min/avg/max` agregados; MVP mantém granularidade fina só nos
  primeiros 30–90 dias, conforme plano do usuário).
- **`AI_RECOMMENDATIONS`**: `factors` guarda os dados que embasaram a explicação
  (ex.: `{"below_avg_pct": 18, "historical_min_hits_last_year": 4, "trend_7d": "down"}`)
  — é o que permite a IA "explicar o motivo", não só dar um veredito.
- **`ALERT_TRIGGERS`**: histórico imutável de disparos — base para calcular a métrica
  de "economia validada" do roadmap (`02-mvp-roadmap.md`, seção 3.7).
- Tabela de **`BOOKINGS`** (reserva/emissão) é adiada para a Fase 3 (V1), quando a
  decisão de fornecedor de emissão estiver definida — ver `01-analise-e-riscos.md`.
