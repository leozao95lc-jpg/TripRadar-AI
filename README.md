# TripRadar AI

Plataforma de monitoramento inteligente de preços de passagens aéreas, com alertas
personalizados, IA explicável de recomendação de compra e (futuramente) emissão de
passagens, hotéis, carros, seguro viagem e eSIM dentro do próprio produto.

> **Status atual: fase de planejamento/arquitetura.** Nenhum código de produto foi
> escrito ainda — este repositório contém a análise, o roadmap e o desenho técnico
> que precisam ser aprovados antes do início da implementação (ver
> [`docs/README.md`](docs/README.md)).

## Por que TripRadar AI

Diferente de metabuscadores tradicionais (Google Flights, Skyscanner, Kayak), o
TripRadar não se limita a comparar preços no momento da busca: ele **monitora rotas
continuamente**, aprende o comportamento histórico de preço de cada rota e diz ao
usuário, em linguagem simples e com justificativa, se vale a pena comprar agora ou
esperar.

## Documentação

Toda a análise de produto, riscos, roadmap e arquitetura técnica está em
[`docs/`](docs/). Comece por [`docs/README.md`](docs/README.md).

## Stack (proposta, sujeita à aprovação)

- **Frontend:** Next.js, React, TypeScript, Tailwind, Shadcn/UI, Framer Motion
- **Backend:** FastAPI (Python), monólito modular com Clean Architecture / DDD
- **Dados:** PostgreSQL (+ extensão de série temporal para histórico de preços), Redis
- **Mensageria:** SQS/RabbitMQ no MVP, migração para Kafka quando o volume justificar
- **Infra:** Docker → AWS ECS Fargate → EKS quando necessário, Cloudflare na borda
