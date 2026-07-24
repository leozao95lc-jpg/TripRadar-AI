import httpx
import pytest

from modules.providers.domain.errors import (
    ProviderAuthError,
    ProviderError,
    ProviderServerError,
    ProviderValidationError,
)
from modules.providers.infrastructure.amadeus_provider import AmadeusFlightProvider

TOKEN_RESPONSE = {"access_token": "fake-token", "token_type": "Bearer", "expires_in": 1799}

QUERY = dict(
    origin_iata="GRU",
    destination_iata="LIS",
    departure_date="2026-11-10",
    return_date="2026-11-24",
    cabin_class="economy",
    passengers=1,
)


def _search_response(price: str = "1234.56", currency: str = "BRL", segments_count: int = 1) -> dict:
    segments = [
        {
            "carrierCode": "LA",
            "departure": {"iataCode": "GRU", "at": "2026-11-10T08:00:00"},
            "arrival": {"iataCode": "LIS", "at": "2026-11-11T08:00:00"},
        }
        for _ in range(segments_count)
    ]
    return {
        "data": [{"price": {"total": price, "currency": currency}, "itineraries": [{"segments": segments}]}]
    }


def _provider(handler, max_retries: int = 3) -> AmadeusFlightProvider:
    transport = httpx.MockTransport(handler)
    return AmadeusFlightProvider(
        api_key="key",
        api_secret="secret",
        base_url="https://test.api.amadeus.com",
        max_retries=max_retries,
        transport=transport,
    )


def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    # As esperas do tenacity usam `time.sleep` — sem isso, testes de retry
    # esperariam segundos de verdade a cada tentativa.
    monkeypatch.setattr("time.sleep", lambda seconds: None)


def test_successful_search_returns_offers(monkeypatch):
    _no_sleep(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json=TOKEN_RESPONSE)
        return httpx.Response(200, json=_search_response())

    offers = _provider(handler).search(**QUERY)

    assert len(offers) == 1
    assert offers[0].price_cents == 123_456
    assert offers[0].currency == "BRL"
    assert offers[0].origin_iata == "GRU"
    assert offers[0].destination_iata == "LIS"
    assert offers[0].airline_iata == "LA"
    assert offers[0].stops == 0


def test_multi_segment_itinerary_counts_stops_correctly(monkeypatch):
    _no_sleep(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json=TOKEN_RESPONSE)
        return httpx.Response(200, json=_search_response(segments_count=2))

    offers = _provider(handler).search(**QUERY)
    assert offers[0].stops == 1


def test_token_is_cached_across_searches(monkeypatch):
    _no_sleep(monkeypatch)
    auth_calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            auth_calls.append(1)
            return httpx.Response(200, json=TOKEN_RESPONSE)
        return httpx.Response(200, json=_search_response())

    provider = _provider(handler)
    provider.search(**QUERY)
    provider.search(**QUERY)

    assert len(auth_calls) == 1


def test_auth_error_is_never_retried(monkeypatch):
    _no_sleep(monkeypatch)
    search_calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(401, json={"error": "invalid_client"})
        search_calls.append(1)
        return httpx.Response(200, json=_search_response())

    with pytest.raises(ProviderAuthError):
        _provider(handler, max_retries=3).search(**QUERY)

    assert search_calls == []


def test_validation_error_is_never_retried(monkeypatch):
    _no_sleep(monkeypatch)
    attempts = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json=TOKEN_RESPONSE)
        attempts.append(1)
        return httpx.Response(400, json={"error": "bad request"})

    with pytest.raises(ProviderValidationError):
        _provider(handler, max_retries=3).search(**QUERY)

    assert len(attempts) == 1


def test_server_error_is_retried_and_eventually_succeeds(monkeypatch):
    _no_sleep(monkeypatch)
    attempt = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json=TOKEN_RESPONSE)
        attempt["n"] += 1
        if attempt["n"] < 2:
            return httpx.Response(500, text="server error")
        return httpx.Response(200, json=_search_response())

    offers = _provider(handler, max_retries=3).search(**QUERY)

    assert len(offers) == 1
    assert attempt["n"] == 2


def test_server_error_exhausts_retries_and_raises(monkeypatch):
    _no_sleep(monkeypatch)
    attempts = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json=TOKEN_RESPONSE)
        attempts.append(1)
        return httpx.Response(503, text="unavailable")

    with pytest.raises(ProviderServerError):
        _provider(handler, max_retries=2).search(**QUERY)

    assert len(attempts) == 2


def test_rate_limit_respects_retry_after_header(monkeypatch):
    sleep_calls = []
    monkeypatch.setattr("time.sleep", lambda seconds: sleep_calls.append(seconds))
    attempt = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json=TOKEN_RESPONSE)
        attempt["n"] += 1
        if attempt["n"] < 2:
            return httpx.Response(429, headers={"Retry-After": "5"}, text="slow down")
        return httpx.Response(200, json=_search_response())

    offers = _provider(handler, max_retries=3).search(**QUERY)

    assert len(offers) == 1
    assert 5.0 in sleep_calls


def test_timeout_is_retried(monkeypatch):
    _no_sleep(monkeypatch)
    attempt = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json=TOKEN_RESPONSE)
        attempt["n"] += 1
        if attempt["n"] < 2:
            raise httpx.ReadTimeout("timed out", request=request)
        return httpx.Response(200, json=_search_response())

    offers = _provider(handler, max_retries=3).search(**QUERY)
    assert len(offers) == 1


def test_missing_credentials_raises_auth_error_without_any_network_call():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(200, json=TOKEN_RESPONSE)

    provider = _provider(handler)
    provider._api_key = None  # simula credencial não configurada

    with pytest.raises(ProviderAuthError):
        provider.search(**QUERY)

    assert calls == []


def test_malformed_response_raises_provider_error_not_a_raw_exception(monkeypatch):
    _no_sleep(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json=TOKEN_RESPONSE)
        return httpx.Response(200, json={"data": [{"price": {}}]})  # sem "total"/"currency"

    with pytest.raises(ProviderError):
        _provider(handler).search(**QUERY)
