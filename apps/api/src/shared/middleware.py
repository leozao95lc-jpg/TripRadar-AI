import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from shared.metrics import http_request_duration_seconds, http_requests_total

logger = structlog.get_logger("http")


def _path_label(request: Request) -> str:
    """Template da rota (ex.: `/api/v1/alerts/{alert_id}`), não a URL literal — sem
    isso, cada UUID de alerta viraria uma série temporal própria no Prometheus
    (cardinalidade sem limite). `request.scope["route"]` só existe depois que o
    router resolveu a rota, o que já aconteceu quando `call_next` retorna."""
    route = request.scope.get("route")
    if route is not None and getattr(route, "path", None):
        return route.path
    return request.url.path


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Injeta um request_id de correlação em todos os logs emitidos durante a
    requisição — inclusive quando ela termina em exceção não tratada. Antes desta
    correção (docs/09-revisao-tecnica-backend.md, achado #14), uma exceção lançada
    dentro de `call_next` pulava a chamada de log inteira: a requisição que mais
    importava logar (a que quebrou) era exatamente a que ficava sem request_id, sem
    duration_ms e sem nenhuma entrada estruturada no log.

    Também emite as métricas Prometheus de HTTP (`shared/metrics.py`) — a mesma
    medição de duração já feita para o log alimenta o histograma, sem duplicar a
    instrumentação em dois lugares."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_s = time.perf_counter() - start
            duration_ms = round(duration_s * 1000, 2)
            logger.exception(
                "http_request_failed",
                method=request.method,
                path=request.url.path,
                duration_ms=duration_ms,
            )
            path_label = _path_label(request)
            http_request_duration_seconds.labels(method=request.method, path=path_label).observe(duration_s)
            http_requests_total.labels(method=request.method, path=path_label, status_code="500").inc()
            raise

        duration_s = time.perf_counter() - start
        duration_ms = round(duration_s * 1000, 2)
        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        path_label = _path_label(request)
        http_request_duration_seconds.labels(method=request.method, path=path_label).observe(duration_s)
        http_requests_total.labels(
            method=request.method, path=path_label, status_code=str(response.status_code)
        ).inc()
        response.headers["x-request-id"] = request_id
        return response
