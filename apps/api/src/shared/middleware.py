import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = structlog.get_logger("http")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Injeta um request_id de correlação em todos os logs emitidos durante a
    requisição — inclusive quando ela termina em exceção não tratada. Antes desta
    correção (docs/09-revisao-tecnica-backend.md, achado #14), uma exceção lançada
    dentro de `call_next` pulava a chamada de log inteira: a requisição que mais
    importava logar (a que quebrou) era exatamente a que ficava sem request_id, sem
    duration_ms e sem nenhuma entrada estruturada no log."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.exception(
                "http_request_failed",
                method=request.method,
                path=request.url.path,
                duration_ms=duration_ms,
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        response.headers["x-request-id"] = request_id
        return response
