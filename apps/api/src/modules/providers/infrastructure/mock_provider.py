import hashlib
import math
import random
from datetime import date

from modules.providers.application.ports import FlightSearchProvider
from modules.providers.domain.entities import FlightOffer

_BASE_PRICE_CENTS_BY_CABIN = {
    "economy": 250_000,
    "premium_economy": 450_000,
    "business": 900_000,
    "first": 1_600_000,
}

_AIRLINES = ["LA", "G3", "AD", "AV", "TP", "IB"]


class MockFlightProvider(FlightSearchProvider):
    """Provedor determinístico para desenvolvimento/CI: gera preços plausíveis por
    rota+data (com sazonalidade e ruído), sem depender de nenhuma API externa ou
    credencial. Implementa a mesma porta `FlightSearchProvider` que o adapter real
    (Amadeus, Fase 6) — o motor de monitoramento não sabe qual dos dois está em uso.
    """

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
        seed_key = (
            f"{origin_iata}-{destination_iata}-{departure_date}-{return_date}"
            f"-{cabin_class}-{date.today().isoformat()}"
        )
        seed = int(hashlib.sha256(seed_key.encode()).hexdigest(), 16) % (2**32)
        rng = random.Random(seed)

        base = _BASE_PRICE_CENTS_BY_CABIN.get(cabin_class, _BASE_PRICE_CENTS_BY_CABIN["economy"])
        day_of_year = date.fromisoformat(departure_date).timetuple().tm_yday
        seasonality = 1 + 0.25 * math.sin(2 * math.pi * day_of_year / 365)
        noise = rng.uniform(0.85, 1.15)
        price_cents = int(base * seasonality * noise) * max(passengers, 1)

        offer = FlightOffer(
            origin_iata=origin_iata,
            destination_iata=destination_iata,
            departure_date=departure_date,
            return_date=return_date,
            cabin_class=cabin_class,
            price_cents=price_cents,
            currency="BRL",
            airline_iata=rng.choice(_AIRLINES),
            stops=rng.choice([0, 0, 1, 1, 2]),
        )
        return [offer]
