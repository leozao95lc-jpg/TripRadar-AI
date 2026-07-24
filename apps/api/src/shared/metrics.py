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

# Métricas por provedor de voo (Amadeus, mock, ...) — ver
# docs/11-provider-integration-strategy.md §7. Como o único chamador de
# `FlightSearchProvider` hoje é o worker de polling (processo curto, sem `/metrics`
# próprio), estas são Gauges de "última execução", preenchidas a partir do
# `WorkerRun` persistido — mesmo padrão dos `worker_last_run_*` acima, não uma
# segunda convenção. Se um caminho síncrono (ex.: busca ao vivo dentro de uma
# requisição HTTP) passar a chamar um provider, ele roda no processo de vida longa
# da API e pode incrementar Counters de verdade diretamente — mas isso não existe
# ainda, então não construímos esse caminho especulativamente.
provider_last_run_requests = Gauge(
    "provider_last_run_requests",
    "Requisições ao provedor na última execução do worker",
    ["provider", "worker_name"],
    registry=registry,
)
provider_last_run_requests_failed = Gauge(
    "provider_last_run_requests_failed",
    "Requisições ao provedor que falharam na última execução do worker",
    ["provider", "worker_name"],
    registry=registry,
)
provider_last_run_cache_hits = Gauge(
    "provider_last_run_cache_hits",
    "Acertos de cache na última execução do worker",
    ["provider", "worker_name"],
    registry=registry,
)
provider_last_run_cache_misses = Gauge(
    "provider_last_run_cache_misses",
    "Erros de cache (miss) na última execução do worker",
    ["provider", "worker_name"],
    registry=registry,
)
provider_last_run_fallback_used = Gauge(
    "provider_last_run_fallback_used",
    "Quantas vezes o fallback (cache/provedor secundário/mock) foi acionado na última execução",
    ["provider", "worker_name"],
    registry=registry,
)
provider_circuit_breaker_state = Gauge(
    "provider_circuit_breaker_state",
    "Estado do circuit breaker ao final da última execução (0=closed, 1=half_open, 2=open)",
    ["provider", "worker_name"],
    registry=registry,
)

_CIRCUIT_STATE_TO_NUMBER = {"closed": 0, "half_open": 1, "open": 2}


def refresh_worker_gauges(worker_runs: list) -> None:
    for run in worker_runs:
        worker_last_run_timestamp_seconds.labels(worker_name=run.worker_name).set(
            run.recorded_at.timestamp()
        )
        worker_last_run_success.labels(worker_name=run.worker_name).set(1 if run.success else 0)
        worker_last_run_routes_failed.labels(worker_name=run.worker_name).set(run.routes_failed)

        if not run.provider_name:
            continue
        labels = {"provider": run.provider_name, "worker_name": run.worker_name}
        provider_last_run_requests.labels(**labels).set(run.provider_requests)
        provider_last_run_requests_failed.labels(**labels).set(run.provider_requests_failed)
        provider_last_run_cache_hits.labels(**labels).set(run.provider_cache_hits)
        provider_last_run_cache_misses.labels(**labels).set(run.provider_cache_misses)
        provider_last_run_fallback_used.labels(**labels).set(run.provider_fallback_used)
        if run.provider_circuit_state is not None:
            provider_circuit_breaker_state.labels(**labels).set(
                _CIRCUIT_STATE_TO_NUMBER.get(run.provider_circuit_state, 0)
            )


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
