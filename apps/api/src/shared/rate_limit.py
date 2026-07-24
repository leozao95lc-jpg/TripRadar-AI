import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

# Limitador em memória, por processo — fecha a lacuna mais urgente (nenhum endpoint
# tinha limite algum, nem /auth/login — ver docs/09-revisao-tecnica-backend.md,
# achado #6) sem introduzir uma dependência nova agora. NÃO coordena entre réplicas:
# com mais de uma instância da API atrás do load balancer, cada uma tem seu próprio
# contador, então o limite efetivo multiplica pelo número de réplicas. Trocar por um
# backend compartilhado (Redis, já provisionado mas hoje sem nenhum uso — achado #12
# do mesmo relatório) antes de rodar mais de uma réplica em produção.


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str, max_requests: int, window_seconds: float) -> bool:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > window_seconds:
            hits.popleft()
        if len(hits) >= max_requests:
            return False
        hits.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


rate_limiter = InMemoryRateLimiter()


def rate_limit(max_requests: int, window_seconds: float):
    """Dependency factory: `dependencies=[Depends(rate_limit(10, 300))]` no decorator
    da rota. Chave = path + IP do cliente; cada rota que usa isso tem seu próprio
    orçamento, independente das demais."""

    def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{request.url.path}:{client_ip}"
        if not rate_limiter.is_allowed(key, max_requests, window_seconds):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")

    return dependency
