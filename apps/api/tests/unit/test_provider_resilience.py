import pytest

from modules.providers.application.ports import FlightSearchProvider
from modules.providers.domain.entities import FlightOffer
from modules.providers.domain.errors import (
    ProviderQuotaExceededError,
    ProviderServerError,
    ProviderTimeoutError,
    ProviderValidationError,
)
from modules.providers.infrastructure.resilience import (
    CachedFlightSearchProvider,
    CircuitBreakerFlightProvider,
    FallbackFlightProvider,
    InMemoryCacheClient,
    RateLimitedFlightProvider,
)
from shared.circuit_breaker import CircuitState, InMemoryCircuitBreaker
from shared.rate_limit import InMemoryRateLimiter

QUERY = dict(
    origin_iata="FLN",
    destination_iata="MAD",
    departure_date="2026-11-10",
    return_date="2026-11-24",
    cabin_class="economy",
    passengers=1,
)


def _offer(price_cents: int = 100_000) -> FlightOffer:
    return FlightOffer(
        origin_iata="FLN",
        destination_iata="MAD",
        departure_date="2026-11-10",
        return_date="2026-11-24",
        cabin_class="economy",
        price_cents=price_cents,
        currency="BRL",
        airline_iata="LA",
        stops=0,
    )


class FakeProvider(FlightSearchProvider):
    def __init__(self, *, raises: Exception | None = None, offers: list[FlightOffer] | None = None) -> None:
        self.raises = raises
        self.offers = offers if offers is not None else [_offer()]
        self.call_count = 0

    def search(self, **kwargs) -> list[FlightOffer]:
        self.call_count += 1
        if self.raises:
            raise self.raises
        return self.offers


# --- CachedFlightSearchProvider ---------------------------------------------------


def test_cache_miss_then_hit_only_calls_wrapped_once():
    wrapped = FakeProvider()
    cache = InMemoryCacheClient()
    provider = CachedFlightSearchProvider(wrapped, cache=cache, provider_name="amadeus", ttl_seconds=60)

    first = provider.search(**QUERY)
    second = provider.search(**QUERY)

    assert wrapped.call_count == 1
    assert provider.cache_misses == 1
    assert provider.cache_hits == 1
    assert first[0].price_cents == second[0].price_cents == 100_000


def test_different_queries_are_different_cache_keys():
    wrapped = FakeProvider()
    cache = InMemoryCacheClient()
    provider = CachedFlightSearchProvider(wrapped, cache=cache, provider_name="amadeus", ttl_seconds=60)

    provider.search(**QUERY)
    other_query = {**QUERY, "destination_iata": "LIS"}
    provider.search(**other_query)

    assert wrapped.call_count == 2
    assert provider.cache_misses == 2


def test_cache_ttl_expiry_forces_a_fresh_call():
    wrapped = FakeProvider()
    cache = InMemoryCacheClient()
    provider = CachedFlightSearchProvider(wrapped, cache=cache, provider_name="amadeus", ttl_seconds=0)

    provider.search(**QUERY)
    provider.search(**QUERY)

    assert wrapped.call_count == 2


# --- CircuitBreakerFlightProvider ---------------------------------------------------


def test_circuit_breaker_opens_after_threshold_of_server_errors():
    breaker = InMemoryCircuitBreaker()
    wrapped = FakeProvider(raises=ProviderServerError("boom"))
    provider = CircuitBreakerFlightProvider(
        wrapped, provider_name="amadeus", failure_threshold=2, cooldown_seconds=60, breaker=breaker
    )

    for _ in range(2):
        with pytest.raises(ProviderServerError):
            provider.search(**QUERY)

    assert provider.circuit_state == CircuitState.OPEN
    assert provider.requests_failed == 2

    # circuito aberto: nem chama mais o wrapped
    from modules.providers.domain.errors import ProviderUnavailableError

    with pytest.raises(ProviderUnavailableError):
        provider.search(**QUERY)
    assert wrapped.call_count == 2


def test_validation_errors_do_not_open_the_circuit():
    breaker = InMemoryCircuitBreaker()
    wrapped = FakeProvider(raises=ProviderValidationError("bad request"))
    provider = CircuitBreakerFlightProvider(
        wrapped, provider_name="amadeus", failure_threshold=1, cooldown_seconds=60, breaker=breaker
    )

    with pytest.raises(ProviderValidationError):
        provider.search(**QUERY)

    assert provider.circuit_state == CircuitState.CLOSED


def test_circuit_breaker_success_resets_failure_count():
    breaker = InMemoryCircuitBreaker()
    wrapped = FakeProvider()
    provider = CircuitBreakerFlightProvider(
        wrapped, provider_name="amadeus", failure_threshold=2, cooldown_seconds=60, breaker=breaker
    )

    provider.search(**QUERY)
    assert provider.circuit_state == CircuitState.CLOSED
    assert provider.requests == 1


# --- RateLimitedFlightProvider ---------------------------------------------------


def test_rate_limited_provider_blocks_after_budget_exhausted():
    limiter = InMemoryRateLimiter()
    wrapped = FakeProvider()
    provider = RateLimitedFlightProvider(
        wrapped, provider_name="amadeus", max_requests_per_minute=1, limiter=limiter
    )

    provider.search(**QUERY)
    with pytest.raises(ProviderQuotaExceededError):
        provider.search(**QUERY)
    assert wrapped.call_count == 1


def test_rate_limited_provider_with_no_limit_never_blocks():
    wrapped = FakeProvider()
    provider = RateLimitedFlightProvider(wrapped, provider_name="amadeus", max_requests_per_minute=None)

    for _ in range(10):
        provider.search(**QUERY)
    assert wrapped.call_count == 10


# --- FallbackFlightProvider ---------------------------------------------------


def test_fallback_used_when_primary_raises_provider_error():
    primary = FakeProvider(raises=ProviderTimeoutError("timeout"))
    fallback = FakeProvider(offers=[_offer(price_cents=1)])
    provider = FallbackFlightProvider(primary, fallback, primary_name="amadeus")

    offers = provider.search(**QUERY)

    assert offers[0].price_cents == 1
    assert provider.fallback_used == 1
    assert provider.last_call_source_provider == "mock"


def test_no_fallback_when_primary_succeeds():
    primary = FakeProvider(offers=[_offer(price_cents=42)])
    fallback = FakeProvider()
    provider = FallbackFlightProvider(primary, fallback, primary_name="amadeus")

    offers = provider.search(**QUERY)

    assert offers[0].price_cents == 42
    assert provider.fallback_used == 0
    assert provider.last_call_source_provider == "amadeus"
    assert fallback.call_count == 0


def test_fallback_source_label_reverts_to_primary_on_next_successful_call():
    primary = FakeProvider(raises=ProviderTimeoutError("timeout"))
    fallback = FakeProvider()
    provider = FallbackFlightProvider(primary, fallback, primary_name="amadeus")

    provider.search(**QUERY)
    assert provider.last_call_source_provider == "mock"

    primary.raises = None
    provider.search(**QUERY)
    assert provider.last_call_source_provider == "amadeus"
