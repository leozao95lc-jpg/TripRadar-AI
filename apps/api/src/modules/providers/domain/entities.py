from dataclasses import dataclass


@dataclass(frozen=True)
class FlightOffer:
    """Value object retornado por qualquer FlightSearchProvider — formato único e estável
    para o resto do sistema, independente de como cada fornecedor (Amadeus, Duffel, Kiwi,
    mock) representa a oferta internamente."""

    origin_iata: str
    destination_iata: str
    departure_date: str  # ISO 8601 (YYYY-MM-DD)
    return_date: str | None
    cabin_class: str
    price_cents: int
    currency: str
    airline_iata: str
    stops: int
