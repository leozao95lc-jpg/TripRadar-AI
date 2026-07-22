# 7. Diagramas de Arquitetura

## 7.1 Diagrama de contexto (C4 — nível 1)

```mermaid
flowchart TB
    User[("Usuário<br/>(viajante)")]
    TripRadar["TripRadar AI<br/>(plataforma)"]
    Providers["Provedores de dados de voo<br/>(Amadeus, Duffel, Kiwi Tequila)"]
    Partner["Agência parceira licenciada<br/>(emissão de bilhete)"]
    Stripe["Stripe<br/>(pagamento de assinatura)"]
    Channels["Canais de notificação<br/>(SES, WhatsApp/Telegram API, Push)"]

    User -->|usa| TripRadar
    TripRadar -->|consulta preços| Providers
    TripRadar -->|redireciona compra| Partner
    TripRadar -->|cobra assinatura Premium| Stripe
    TripRadar -->|envia alertas| Channels
    Channels -->|entrega| User
```

## 7.2 Diagrama de contêineres (C4 — nível 2, monólito modular)

```mermaid
flowchart TB
    subgraph Client["Cliente"]
        Web["Web App (Next.js)"]
    end

    subgraph AWS["AWS"]
        subgraph API["API Monolítica Modular (FastAPI / ECS Fargate)"]
            Identity[["identity"]]
            Alerts[["alerts"]]
            PriceMon[["price_monitoring"]]
            Notif[["notifications"]]
            ProvIntegr[["providers (adapter)"]]
            Reco[["recommendations (IA)"]]
            Billing[["billing"]]
        end
        DB[("PostgreSQL / RDS")]
        Cache[("Redis / ElastiCache")]
        Queue[["SQS + EventBridge<br/>(filas e agendamento)"]]
        Worker["Workers assíncronos<br/>(polling de preço, envio de notificação)"]
    end

    ExtProviders["APIs externas de voo<br/>(Amadeus / Duffel / Kiwi)"]
    ExtNotif["Provedores de notificação<br/>(SES, WhatsApp, Telegram)"]
    ExtStripe["Stripe"]

    Web -->|HTTPS / REST| API
    API --> DB
    API --> Cache
    API -->|publica evento| Queue
    Queue -->|consome| Worker
    Worker --> DB
    ProvIntegr -->|chama| ExtProviders
    Notif -->|envia via| ExtNotif
    Billing -->|checkout/webhook| ExtStripe
```

## 7.3 Sequência — criação de alerta até notificação

```mermaid
sequenceDiagram
    actor U as Usuário
    participant W as Web App
    participant A as API (alerts)
    participant Q as Fila (SQS)
    participant WK as Worker (price_monitoring)
    participant P as Provider externo (Amadeus/Duffel)
    participant R as recommendations (IA)
    participant N as notifications
    participant C as Canal (e-mail/WhatsApp)

    U->>W: Cria alerta (origem, destino, preço-alvo)
    W->>A: POST /api/v1/alerts
    A->>A: Persiste alerta
    A-->>W: 201 Created

    Note over Q,WK: Agendado (EventBridge) periodicamente
    Q->>WK: Trigger de polling
    WK->>P: Busca preço atual da rota
    P-->>WK: Preço + metadados
    WK->>WK: Salva PRICE_SNAPSHOT
    WK->>R: Solicita avaliação do alerta
    R->>R: Compara com histórico/sazonalidade
    R-->>WK: Veredito + explicação

    alt Preço atingiu alvo ou queda relevante
        WK->>N: Publica ALERT_TRIGGERED
        N->>C: Envia notificação
        C-->>U: Recebe alerta com explicação
    else Sem gatilho
        WK->>WK: Apenas atualiza histórico
    end
```

## 7.4 Sequência — fluxo de compra (V1, com parceiro)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant W as Web App
    participant A as API
    participant Partner as Parceiro/Provedor de emissão

    U->>W: Clica em "Comprar"
    W->>A: GET oferta atual + deep link
    A->>Partner: Verifica disponibilidade/preço
    Partner-->>A: Confirma oferta
    A-->>W: Redireciona com deep link (ou inicia checkout via Duffel)
    W-->>U: Conclui compra no parceiro (ou dentro do app, se emissão própria)
    Partner-->>A: Webhook de confirmação (quando aplicável)
    A->>A: Registra BOOKING + fecha ALERT_TRIGGER associado
```
