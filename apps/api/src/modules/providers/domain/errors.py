"""Taxonomia de erro de provedor — ver docs/11-provider-integration-strategy.md §4 e
§5. Todo `FlightSearchProvider` concreto (Amadeus, e qualquer futuro adapter) mapeia
seus próprios erros HTTP/SDK para um destes tipos; o resto do sistema (worker,
circuit breaker, métricas) nunca precisa conhecer o formato de erro específico de
cada fornecedor, só esta hierarquia."""


class ProviderError(Exception):
    """Base — falha em obter uma resposta válida do provedor. Uma lista vazia de
    ofertas NÃO é um `ProviderError` (é uma resposta válida "sem voos"); só chega
    aqui quando o provedor não respondeu de forma utilizável."""


class ProviderTimeoutError(ProviderError):
    """Timeout de conexão ou leitura — transitório, elegível a retry."""


class ProviderRateLimitedError(ProviderError):
    """HTTP 429 — transitório, elegível a retry (respeitando `retry_after_seconds`
    quando o provedor o informa), mas NUNCA deve abrir o circuit breaker sozinho no
    mesmo ritmo de um 5xx: rate limit é esperado sob carga alta, não indica que o
    provedor está fora do ar."""

    def __init__(self, message: str, retry_after_seconds: float | None = None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class ProviderAuthError(ProviderError):
    """Credencial inválida/expirada (401/403) — NÃO é transitório, nunca deve ser
    re-tentado automaticamente (re-tentar um 401 só mascara uma credencial quebrada)."""


class ProviderValidationError(ProviderError):
    """Requisição rejeitada por parâmetro inválido (400/422) — bug de quem chama,
    não do provedor. Nunca re-tentado."""


class ProviderServerError(ProviderError):
    """5xx do provedor — transitório, elegível a retry."""


class ProviderUnavailableError(ProviderError):
    """Levantado pelo `CircuitBreakerFlightProvider` quando o circuito está aberto —
    a chamada nem chega a sair pela rede."""


class ProviderQuotaExceededError(ProviderError):
    """Levantado pelo `RateLimitedFlightProvider` quando o próprio cliente decide
    não gastar mais do orçamento de requisições/minuto contratado — não é um erro
    devolvido pelo provedor, é autolimitação (ver docs/11 §2). Sempre elegível a
    cair no fallback, nunca ao retry (esperar e tentar de novo na mesma execução só
    atrasaria o worker sem mudar o resultado dentro da janela)."""
