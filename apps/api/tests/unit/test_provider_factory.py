from modules.providers.infrastructure.mock_provider import MockFlightProvider
from modules.providers.infrastructure.provider_factory import build_flight_provider
from modules.providers.infrastructure.resilience import CachedFlightSearchProvider, FallbackFlightProvider
from shared.config import Settings


def test_mock_config_returns_bare_mock_provider_with_no_telemetry():
    config = Settings(flight_provider="mock")
    provider, telemetry = build_flight_provider(config)

    assert isinstance(provider, MockFlightProvider)
    assert telemetry is None


def test_amadeus_config_returns_full_resilience_chain_with_telemetry():
    config = Settings(
        flight_provider="amadeus",
        amadeus_api_key="key",
        amadeus_api_secret="secret",
        redis_url="",  # força InMemoryCacheClient, sem depender de um Redis de verdade no teste
    )
    provider, telemetry = build_flight_provider(config)

    assert isinstance(provider, FallbackFlightProvider)
    assert isinstance(provider._primary, CachedFlightSearchProvider)
    assert telemetry is not None
    assert telemetry.provider_name == "amadeus"
    snapshot = telemetry.snapshot()
    assert snapshot == {
        "provider_name": "amadeus",
        "provider_requests": 0,
        "provider_requests_failed": 0,
        "provider_cache_hits": 0,
        "provider_cache_misses": 0,
        "provider_fallback_used": 0,
        "provider_circuit_state": "closed",
    }
