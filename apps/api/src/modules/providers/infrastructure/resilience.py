"""Decoradores de resiliência para qualquer `FlightSearchProvider` — cache,
circuit breaker e fallback. Nenhum deles sabe nada sobre Amadeus especificamente;
compõem-se em `provider_factory.py` em volta do adapter concreto. Ver
docs/11-provider-integration-strategy.md §3, §4 e §6."""

import json
import time
from dataclasses import asdict
from typing import Protocol

from modules.providers.application.ports import FlightSearchProvider
from modules.providers.domain.entities import FlightOffer
from modules.providers.domain.errors import (
    ProviderError,
    ProviderQuotaExceededError,
    ProviderUnavailableError,
)
from shared.circuit_breaker import CircuitOpenError, CircuitState, InMemoryCircuitBreaker
from shared.logging import get_logger
from shared.rate_limit import InMemoryRateLimiter

logger = get_logger(__name__)


class CacheClient(Protocol):
    def get(self, key: str) -> str | None: ...
    def setex(self, key: str, ttl_seconds: int, value: str) -> None: ...


class InMemoryCacheClient:
    """Fallback quando nenhum Redis está configurado, e usado em teste — mesmo
    contrato do `RedisCacheClient`, sem exigir um servidor de verdade."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[str, float]] = {}

    def get(self, key: str) -> str | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        return value

    def setex(self, key: str, ttl_seconds: int, value: str) -> None:
        self._store[key] = (value, time.monotonic() + ttl_seconds)


class RedisCacheClient:
    """Adapter fino sobre `redis-py`. Import de `redis` fica dentro do construtor —
    lazy — pra não pagar o custo/risco de importar o SDK em ambientes (ex.: testes
    unitários) que nunca instanciam esta classe."""

    def __init__(self, redis_url: str) -> None:
        import redis

        self._client = redis.Redis.from_url(redis_url, decode_responses=True)

    def get(self, key: str) -> str | None:
        return self._client.get(key)

    def setex(self, key: str, ttl_seconds: int, value: str) -> None:
        self._client.setex(key, ttl_seconds, value)


def _cache_key(
    provider_name: str,
    *,
    origin_iata: str,
    destination_iata: str,
    departure_date: str,
    return_date: str | None,
    cabin_class: str,
    passengers: int,
) -> str:
    return (
        f"flight_search:{provider_name}:{origin_iata}:{destination_iata}:"
        f"{departure_date}:{return_date or '-'}:{cabin_class}:{passengers}"
    )


class CachedFlightSearchProvider(FlightSearchProvider):
    """TTL curto, nunca cache eterno — e nunca usado no caminho de compra (ver
    docs/11 §3): esta camada só existe para o caminho de monitoramento/busca, onde
    um preço com alguns minutos de idade é aceitável e claramente rotulado como tal
    a jusante (o `collected_at` do snapshot)."""

    def __init__(
        self, wrapped: FlightSearchProvider, *, cache: CacheClient, provider_name: str, ttl_seconds: int
    ) -> None:
        self._wrapped = wrapped
        self._cache = cache
        self._provider_name = provider_name
        self._ttl_seconds = ttl_seconds
        self.cache_hits = 0
        self.cache_misses = 0

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
        key = _cache_key(
            self._provider_name,
            origin_iata=origin_iata,
            destination_iata=destination_iata,
            departure_date=departure_date,
            return_date=return_date,
            cabin_class=cabin_class,
            passengers=passengers,
        )
        cached = self._cache.get(key)
        if cached is not None:
            self.cache_hits += 1
            return [FlightOffer(**item) for item in json.loads(cached)]

        self.cache_misses += 1
        offers = self._wrapped.search(
            origin_iata=origin_iata,
            destination_iata=destination_iata,
            departure_date=departure_date,
            return_date=return_date,
            cabin_class=cabin_class,
            passengers=passengers,
        )
        self._cache.setex(key, self._ttl_seconds, json.dumps([asdict(o) for o in offers]))
        return offers


class RateLimitedFlightProvider(FlightSearchProvider):
    """Autolimitação do lado do cliente — protege o orçamento contratado de
    requisições/minuto independente do que o provedor decidir aceitar (ver
    docs/11-provider-integration-strategy.md §2). `max_requests_per_minute=None`
    desliga o limite (usado quando ainda não há valor de contrato configurado).
    Fica FORA do circuit breaker na composição: estourar o próprio orçamento não é
    sinal de "o provedor está com problema", não deve contar como falha do
    circuito."""

    def __init__(
        self,
        wrapped: FlightSearchProvider,
        *,
        provider_name: str,
        max_requests_per_minute: int | None,
        limiter: InMemoryRateLimiter | None = None,
    ) -> None:
        self._wrapped = wrapped
        self._provider_name = provider_name
        self._max_requests_per_minute = max_requests_per_minute
        self._limiter = limiter or InMemoryRateLimiter()

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
        if self._max_requests_per_minute is not None and not self._limiter.is_allowed(
            self._provider_name, self._max_requests_per_minute, 60
        ):
            logger.warning(
                "provider_quota_exceeded",
                provider=self._provider_name,
                limit_type="per_minute",
                route=f"{origin_iata}-{destination_iata}",
            )
            raise ProviderQuotaExceededError(
                f"Orçamento de {self._max_requests_per_minute} req/min excedido para {self._provider_name}"
            )
        return self._wrapped.search(
            origin_iata=origin_iata,
            destination_iata=destination_iata,
            departure_date=departure_date,
            return_date=return_date,
            cabin_class=cabin_class,
            passengers=passengers,
        )


class CircuitBreakerFlightProvider(FlightSearchProvider):
    """Um circuito por `provider_name`. `ProviderRateLimitedError` e erros não
    relacionados a indisponibilidade (auth/validação) NÃO contam como falha do
    circuito — só timeout e 5xx, que são o sinal real de "o provedor está com
    problema" (ver docs/11 §4)."""

    _BREAKER_TRIGGERING_ERRORS = ("ProviderTimeoutError", "ProviderServerError")

    def __init__(
        self,
        wrapped: FlightSearchProvider,
        *,
        provider_name: str,
        failure_threshold: int,
        cooldown_seconds: float,
        breaker: InMemoryCircuitBreaker | None = None,
    ) -> None:
        self._wrapped = wrapped
        self._provider_name = provider_name
        self._failure_threshold = failure_threshold
        self._cooldown_seconds = cooldown_seconds
        self._breaker = breaker or InMemoryCircuitBreaker()
        self.requests = 0
        self.requests_failed = 0

    @property
    def circuit_state(self) -> CircuitState:
        return self._breaker.get_state(self._provider_name)

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
        try:
            self._breaker.before_call(self._provider_name, self._failure_threshold, self._cooldown_seconds)
        except CircuitOpenError as exc:
            logger.warning("provider_circuit_open", provider=self._provider_name)
            raise ProviderUnavailableError(f"Circuito aberto para {self._provider_name}") from exc

        self.requests += 1
        try:
            offers = self._wrapped.search(
                origin_iata=origin_iata,
                destination_iata=destination_iata,
                departure_date=departure_date,
                return_date=return_date,
                cabin_class=cabin_class,
                passengers=passengers,
            )
        except ProviderError as exc:
            self.requests_failed += 1
            if type(exc).__name__ in self._BREAKER_TRIGGERING_ERRORS:
                new_state = self._breaker.record_failure(self._provider_name, self._failure_threshold)
                if new_state is not None:
                    logger.warning(
                        "provider_circuit_breaker_state_changed",
                        provider=self._provider_name,
                        to_state=new_state.value,
                    )
            raise

        new_state = self._breaker.record_success(self._provider_name)
        if new_state is not None:
            logger.info(
                "provider_circuit_breaker_state_changed",
                provider=self._provider_name,
                to_state=new_state.value,
            )
        return offers


class FallbackFlightProvider(FlightSearchProvider):
    """Último nível da cadeia de degradação (ver docs/11 §6): se o `primary` (já
    envolto em cache+circuit breaker) falhar, cai para `fallback` — hoje sempre o
    `MockFlightProvider`, mas a composição aceita qualquer `FlightSearchProvider`
    (ex.: um segundo provedor real no futuro). Cada acionamento é logado — nunca
    silencioso, principalmente quando o fallback é dado sintético sendo usado como
    se fosse mercado real."""

    def __init__(
        self,
        primary: FlightSearchProvider,
        fallback: FlightSearchProvider,
        *,
        primary_name: str,
        fallback_name: str = "mock",
    ) -> None:
        self._primary = primary
        self._fallback = fallback
        self._primary_name = primary_name
        self._fallback_name = fallback_name
        self.fallback_used = 0
        # `PollRoutePrice` lê este atributo (via getattr, com fallback pro nome
        # estático configurado) pra rotular `PriceSnapshot.source_provider`
        # corretamente quando o dado de UMA chamada específica veio do fallback —
        # sem isso, um snapshot sintético do MockFlightProvider ficaria marcado como
        # "amadeus" no banco, exatamente o tipo de rótulo enganoso que
        # docs/11-provider-integration-strategy.md §6 diz pra nunca deixar
        # acontecer silenciosamente.
        self.last_call_source_provider = primary_name

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
        try:
            offers = self._primary.search(
                origin_iata=origin_iata,
                destination_iata=destination_iata,
                departure_date=departure_date,
                return_date=return_date,
                cabin_class=cabin_class,
                passengers=passengers,
            )
            self.last_call_source_provider = self._primary_name
            return offers
        except ProviderError as exc:
            self.fallback_used += 1
            self.last_call_source_provider = self._fallback_name
            logger.warning(
                "provider_fallback_used",
                primary=self._primary_name,
                fallback=self._fallback_name,
                reason=type(exc).__name__,
                route=f"{origin_iata}-{destination_iata}",
            )
            return self._fallback.search(
                origin_iata=origin_iata,
                destination_iata=destination_iata,
                departure_date=departure_date,
                return_date=return_date,
                cabin_class=cabin_class,
                passengers=passengers,
            )
