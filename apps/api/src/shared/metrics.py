"""Métricas Prometheus do processo da API. O worker de polling roda como processo
curto (um cron job), então ele NÃO expõe `/metrics` diretamente — grava o resultado
de cada execução em `WorkerRunRepository` (módulo `observability`), e é a API (processo
de vida longa) que lê o último registro de cada worker e publica como gauge aqui. Ver
docs/11-provider-integration-strategy.md §7 para a convenção de nome de métrica por
provedor, que segue o mesmo padrão desta primeira leva de métricas gerais.

`/metrics` não tem autenticação própria — em produção, a exposição deve ser restrita
por rede (scrape só a partir da VPC/observability stack), não publicada como rota
pública comum."""

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

registry = CollectorRegistry()

http_requests_total = Counter(
    "http_requests_total",
    "Total de requisições HTTP concluídas",
    ["method", "path", "status_code"],
    registry=registry,
)
http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "Duração da requisição HTTP em segundos",
    ["method", "path"],
    registry=registry,
)
domain_events_dispatched_total = Counter(
    "domain_events_dispatched_total",
    "Total de eventos de domínio despachados pelo event bus",
    ["event_name"],
    registry=registry,
)
worker_last_run_timestamp_seconds = Gauge(
    "worker_last_run_timestamp_seconds",
    "Timestamp Unix (UTC) da última execução registrada do worker",
    ["worker_name"],
    registry=registry,
)
worker_last_run_success = Gauge(
    "worker_last_run_success",
    "1 se a última execução do worker terminou sem nenhuma rota falhando, 0 caso contrário",
    ["worker_name"],
    registry=registry,
)
worker_last_run_routes_failed = Gauge(
    "worker_last_run_routes_failed",
    "Quantidade de rotas que falharam na última execução do worker",
    ["worker_name"],
    registry=registry,
)


def refresh_worker_gauges(worker_runs: list) -> None:
    for run in worker_runs:
        worker_last_run_timestamp_seconds.labels(worker_name=run.worker_name).set(
            run.recorded_at.timestamp()
        )
        worker_last_run_success.labels(worker_name=run.worker_name).set(1 if run.success else 0)
        worker_last_run_routes_failed.labels(worker_name=run.worker_name).set(run.routes_failed)


def render_metrics() -> bytes:
    return generate_latest(registry)


__all__ = [
    "CONTENT_TYPE_LATEST",
    "domain_events_dispatched_total",
    "http_request_duration_seconds",
    "http_requests_total",
    "refresh_worker_gauges",
    "render_metrics",
]
