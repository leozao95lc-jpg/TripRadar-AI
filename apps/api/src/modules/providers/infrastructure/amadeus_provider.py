"""Adapter real para a Flight Offers Search API da Amadeus (sandbox por padrão —
`amadeus_base_url`). Ver docs/11-provider-integration-strategy.md.

Timeout e retry (só em erros transitórios) vivem aqui, porque são inerentes a
"falar HTTP com este provedor específico". Cache, circuit breaker e fallback NÃO
vivem aqui — são decoradores genéricos em `resilience.py`, reutilizáveis por
qualquer futuro `FlightSearchProvider`, compostos em `provider_factory.py`. Todo
erro sai daqui como um dos tipos de `modules.providers.domain.errors` — nunca um
`httpx.HTTPError` cru vazando para quem chama."""

import time

import httpx
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from modules.providers.application.ports import FlightSearchProvider
from modules.providers.domain.entities import FlightOffer
from modules.providers.domain.errors import (
    ProviderAuthError,
    ProviderError,
    ProviderRateLimitedError,
    ProviderServerError,
    ProviderTimeoutError,
    ProviderValidationError,
)
from shared.config import settings
from shared.logging import get_logger

logger = get_logger(__name__)

_CABIN_CLASS_MAP = {
    "economy": "ECONOMY",
    "premium_economy": "PREMIUM_ECONOMY",
    "business": "BUSINESS",
    "first": "FIRST",
}

# Só erros transitórios são elegíveis a retry — auth/validação nunca (ver
# docs/11-provider-integration-strategy.md §4: re-tentar um 401 só mascara uma
# credencial quebrada, re-tentar um 400 não torna o parâmetro válido).
_TRANSIENT_ERRORS = (ProviderTimeoutError, ProviderServerError, ProviderRateLimitedError)


def _wait_for_retry(retry_state: RetryCallState) -> float:
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    if isinstance(exc, ProviderRateLimitedError) and exc.retry_after_seconds is not None:
        return exc.retry_after_seconds
    return wait_exponential_jitter(initial=1, max=10)(retry_state)


def _raise_for_status(response: httpx.Response, *, context: str) -> None:
    if response.status_code < 400:
        return
    if response.status_code == 429:
        retry_after = response.headers.get("Retry-After")
        raise ProviderRateLimitedError(
            f"Rate limit da Amadeus atingido ({context})",
            retry_after_seconds=float(retry_after) if retry_after else None,
        )
    if response.status_code in (401, 403):
        raise ProviderAuthError(f"Falha de autenticação na Amadeus ({context}): {response.status_code}")
    if response.status_code in (400, 422):
        raise ProviderValidationError(f"Requisição rejeitada pela Amadeus ({context}): {response.text[:200]}")
    if response.status_code >= 500:
        raise ProviderServerError(f"Erro no servidor da Amadeus ({context}): {response.status_code}")
    raise ProviderError(f"Resposta inesperada da Amadeus ({context}): {response.status_code}")


def _to_flight_offer(
    item: dict,
    *,
    origin_iata: str,
    destination_iata: str,
    departure_date: str,
    return_date: str | None,
    cabin_class: str,
) -> FlightOffer:
    # Origem/destino/datas vêm dos parâmetros da própria busca (já sabemos o que
    # pedimos) — só preço, moeda, companhia e nº de conexões vêm de fato da resposta,
    # o que evita depender de parsing frágil da estrutura de itinerário pra dados que
    # já tínhamos.
    price = item["price"]
    itineraries = item.get("itineraries", [])
    first_segments = itineraries[0]["segments"] if itineraries else []
    stops = max(len(first_segments) - 1, 0)
    airline_iata = first_segments[0]["carrierCode"] if first_segments else "XX"
    return FlightOffer(
        origin_iata=origin_iata,
        destination_iata=destination_iata,
        departure_date=departure_date,
        return_date=return_date,
        cabin_class=cabin_class,
        price_cents=round(float(price["total"]) * 100),
        currency=price["currency"],
        airline_iata=airline_iata,
        stops=stops,
    )


class AmadeusFlightProvider(FlightSearchProvider):
    def __init__(
        self,
        *,
        api_key: str | None = None,
        api_secret: str | None = None,
        base_url: str | None = None,
        connect_timeout_seconds: float | None = None,
        read_timeout_seconds: float | None = None,
        max_retries: int | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._api_key = api_key if api_key is not None else settings.amadeus_api_key
        self._api_secret = api_secret if api_secret is not None else settings.amadeus_api_secret
        connect_timeout = connect_timeout_seconds or settings.amadeus_connect_timeout_seconds
        read_timeout = read_timeout_seconds or settings.amadeus_read_timeout_seconds
        self._max_retries = max_retries or settings.amadeus_max_retries
        timeout = httpx.Timeout(
            connect=connect_timeout, read=read_timeout, write=read_timeout, pool=connect_timeout
        )
        self._client = httpx.Client(
            base_url=base_url or settings.amadeus_base_url,
            timeout=timeout,
            transport=transport,
        )
        self._token: str | None = None
        self._token_expires_at: float | None = None

    def close(self) -> None:
        self._client.close()

    def _retrying(self):
        return retry(
            stop=stop_after_attempt(self._max_retries),
            wait=_wait_for_retry,
            retry=retry_if_exception_type(_TRANSIENT_ERRORS),
            reraise=True,
        )

    def _authenticate(self) -> str:
        if self._token and self._token_expires_at and time.monotonic() < self._token_expires_at:
            return self._token

        if not self._api_key or not self._api_secret:
            raise ProviderAuthError(
                "Credenciais da Amadeus não configuradas (amadeus_api_key/amadeus_api_secret)"
            )

        @self._retrying()
        def _do_auth() -> httpx.Response:
            try:
                response = self._client.post(
                    "/v1/security/oauth2/token",
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self._api_key,
                        "client_secret": self._api_secret,
                    },
                )
            except httpx.TimeoutException as exc:
                raise ProviderTimeoutError("Timeout autenticando na Amadeus") from exc
            except httpx.HTTPError as exc:
                raise ProviderTimeoutError(f"Erro de conexão autenticando na Amadeus: {exc}") from exc
            _raise_for_status(response, context="autenticação")
            return response

        response = _do_auth()
        payload = response.json()
        self._token = payload["access_token"]
        # Margem de segurança de 60s pra não usar um token que expira no meio de uma
        # chamada em andamento.
        self._token_expires_at = time.monotonic() + max(payload.get("expires_in", 1800) - 60, 0)
        return self._token

    def search(
        self,
        *,
        origin_iata: str,
        destination_iata: str,
        departure_date: str,
        return_date: str | None,
        cabin_class: str,
        passengers: int,
    ) -> list[FlightOffer]:
        token = self._authenticate()
        params: dict[str, str | int] = {
            "originLocationCode": origin_iata,
            "destinationLocationCode": destination_iata,
            "departureDate": departure_date,
            "adults": passengers,
            "travelClass": _CABIN_CLASS_MAP.get(cabin_class, "ECONOMY"),
            "currencyCode": "BRL",
            "max": 5,
        }
        if return_date:
            params["returnDate"] = return_date

        @self._retrying()
        def _do_search() -> httpx.Response:
            try:
                response = self._client.get(
                    "/v2/shopping/flight-offers",
                    params=params,
                    headers={"Authorization": f"Bearer {token}"},
                )
            except httpx.TimeoutException as exc:
                raise ProviderTimeoutError(
                    f"Timeout buscando {origin_iata}-{destination_iata} na Amadeus"
                ) from exc
            except httpx.HTTPError as exc:
                raise ProviderTimeoutError(f"Erro de conexão buscando na Amadeus: {exc}") from exc
            _raise_for_status(response, context="busca de voos")
            return response

        response = _do_search()
        payload = response.json()
        try:
            return [
                _to_flight_offer(
                    item,
                    origin_iata=origin_iata,
                    destination_iata=destination_iata,
                    departure_date=departure_date,
                    return_date=return_date,
                    cabin_class=cabin_class,
                )
                for item in payload.get("data", [])
            ]
        except (KeyError, IndexError, ValueError, TypeError) as exc:
            raise ProviderError(f"Resposta da Amadeus em formato inesperado: {exc}") from exc
