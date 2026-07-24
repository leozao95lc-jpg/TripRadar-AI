"""Composition root do módulo `providers` — monta a cadeia de resiliência em volta
do provedor configurado (`settings.flight_provider`) e devolve, junto, um objeto de
telemetria que o worker lê ao final da execução pra persistir em `WorkerRun` (ver
docs/11-provider-integration-strategy.md §7 e `modules/observability`).

Trocar de provedor primário, ou adicionar um segundo, é mudar só esta função — nada
em `price_monitoring`, `alerts` ou no worker precisa saber que a cadeia por trás de
`FlightSearchProvider` mudou."""

from dataclasses import dataclass

from modules.providers.application.ports import FlightSearchProvider
from modules.providers.infrastructure.amadeus_provider import AmadeusFlightProvider
from modules.providers.infrastructure.mock_provider import MockFlightProvider
from modules.providers.infrastructure.resilience import (
    CacheClient,
    CachedFlightSearchProvider,
    CircuitBreakerFlightProvider,
    FallbackFlightProvider,
    InMemoryCacheClient,
    RateLimitedFlightProvider,
)
from shared.config import Settings
from shared.config import settings as default_settings


@dataclass
class ProviderRunTelemetry:
    provider_name: str
    circuit_breaker: CircuitBreakerFlightProvider
    cache: CachedFlightSearchProvider
    fallback: FallbackFlightProvider

    def snapshot(self) -> dict:
        return {
            "provider_name": self.provider_name,
            "provider_requests": self.circuit_breaker.requests,
            "provider_requests_failed": self.circuit_breaker.requests_failed,
            "provider_cache_hits": self.cache.cache_hits,
            "provider_cache_misses": self.cache.cache_misses,
            "provider_fallback_used": self.fallback.fallback_used,
            "provider_circuit_state": self.circuit_breaker.circuit_state.value,
        }


def _build_cache_client(config: Settings) -> CacheClient:
    if not config.redis_url:
        return InMemoryCacheClient()
    try:
        from modules.providers.infrastructure.resilience import RedisCacheClient

        return RedisCacheClient(config.redis_url)
    except Exception:
        # Redis configurado mas inalcançável não deve derrubar o worker inteiro —
        # cache é uma otimização, não um requisito. Cai para cache em memória (que
        # não sobrevive entre execuções do worker, mas não quebra nada).
        from shared.logging import get_logger

        get_logger(__name__).warning("provider_cache_redis_unavailable_falling_back_to_memory")
        return InMemoryCacheClient()


def build_flight_provider(
    config: Settings | None = None,
) -> tuple[FlightSearchProvider, ProviderRunTelemetry | None]:
    config = config or default_settings

    if config.flight_provider != "amadeus":
        return MockFlightProvider(), None

    amadeus = AmadeusFlightProvider(
        api_key=config.amadeus_api_key,
        api_secret=config.amadeus_api_secret,
        base_url=config.amadeus_base_url,
        connect_timeout_seconds=config.amadeus_connect_timeout_seconds,
        read_timeout_seconds=config.amadeus_read_timeout_seconds,
        max_retries=config.amadeus_max_retries,
    )
    rate_limited_provider = RateLimitedFlightProvider(
        amadeus,
        provider_name="amadeus",
        max_requests_per_minute=config.amadeus_max_requests_per_minute,
    )
    breaker_provider = CircuitBreakerFlightProvider(
        rate_limited_provider,
        provider_name="amadeus",
        failure_threshold=config.provider_circuit_breaker_failure_threshold,
        cooldown_seconds=config.provider_circuit_breaker_cooldown_seconds,
    )
    cached_provider = CachedFlightSearchProvider(
        breaker_provider,
        cache=_build_cache_client(config),
        provider_name="amadeus",
        ttl_seconds=config.amadeus_cache_ttl_seconds,
    )
    fallback_provider = FallbackFlightProvider(cached_provider, MockFlightProvider(), primary_name="amadeus")

    telemetry = ProviderRunTelemetry(
        provider_name="amadeus",
        circuit_breaker=breaker_provider,
        cache=cached_provider,
        fallback=fallback_provider,
    )
    return fallback_provider, telemetry
