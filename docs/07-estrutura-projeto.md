# 8. Estrutura de Pastas do Projeto

Monorepo, para manter frontend/backend/infra versionados juntos no estágio atual
(equipe pequena, deploy coordenado). Reavaliar split em repositórios separados apenas
se times crescerem e passarem a ter ciclos de release independentes.

```
tripradar-ai/
├── apps/
│   ├── web/                          # Next.js (frontend)
│   │   ├── app/                      # App Router: rotas, layouts
│   │   ├── components/               # UI (Shadcn/UI based)
│   │   ├── features/                 # Componentes/hooks por domínio (alerts, dashboard, billing...)
│   │   ├── lib/                      # Client HTTP, utils, i18n
│   │   ├── styles/
│   │   └── tests/
│   │
│   └── api/                          # FastAPI (backend, monólito modular)
│       ├── src/
│       │   ├── modules/
│       │   │   ├── identity/
│       │   │   │   ├── domain/
│       │   │   │   ├── application/
│       │   │   │   ├── infrastructure/
│       │   │   │   └── interface/
│       │   │   ├── alerts/
│       │   │   │   ├── domain/
│       │   │   │   ├── application/
│       │   │   │   ├── infrastructure/
│       │   │   │   └── interface/
│       │   │   ├── price_monitoring/
│       │   │   ├── providers/        # Adapters: Amadeus, Duffel, Kiwi (interface comum)
│       │   │   ├── recommendations/  # Heurística/IA de recomendação
│       │   │   ├── notifications/    # E-mail, WhatsApp, Telegram, Push
│       │   │   └── billing/          # Stripe
│       │   ├── shared/
│       │   │   ├── config/
│       │   │   ├── database/         # Engine, sessão, migrations (Alembic)
│       │   │   ├── events/           # Event bus interno
│       │   │   ├── middleware/       # Auth, rate limiting, logging, CORS
│       │   │   └── observability/    # Logging estruturado, tracing
│       │   └── main.py               # Bootstrap FastAPI, registro de routers
│       ├── workers/                  # Entry points dos consumidores assíncronos (SQS)
│       │   ├── price_polling_worker.py
│       │   └── notification_worker.py
│       ├── migrations/               # Alembic
│       ├── tests/
│       │   ├── unit/                 # por módulo, testando domain/application
│       │   └── integration/          # testcontainers (Postgres/Redis reais)
│       └── pyproject.toml
│
├── packages/                         # Compartilhado entre apps (se necessário)
│   └── shared-types/                 # Tipos TS gerados a partir do OpenAPI da API
│
├── infra/
│   ├── docker-compose.yml            # Ambiente local (Postgres, Redis, LocalStack p/ SQS)
│   ├── terraform/                    # IaC da AWS (ECS, RDS, ElastiCache, S3, CloudFront, SQS...)
│   └── github-actions/               # Templates reutilizáveis de CI
│
├── docs/                             # Este diretório
│
├── .github/
│   └── workflows/                    # CI (lint, test, build), CD (deploy)
│
├── docker-compose.yml -> infra/docker-compose.yml (symlink de conveniência)
└── README.md
```

## 8.1 Regras de dependência entre módulos do backend

- Um módulo **nunca** importa `infrastructure` ou `domain` de outro módulo
  diretamente.
- Comunicação entre módulos acontece por:
  1. **Eventos de domínio** publicados no event bus interno (preferencial), ou
  2. **Interfaces explícitas** expostas em `application/ports` do módulo dono, quando
     uma chamada síncrona é realmente necessária (ex.: `billing` perguntando a
     `identity` se o usuário existe).
- `providers/` expõe uma interface única (`FlightSearchProvider`) implementada por
  cada integração (Amadeus, Duffel, Kiwi) — módulo `price_monitoring` e `alerts`
  dependem apenas dessa interface, nunca de um provedor específico. Isso é o que
  viabiliza suportar múltiplos fornecedores (requisito do produto) sem acoplar o
  domínio a nenhum deles.
