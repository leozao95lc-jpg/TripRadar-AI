from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4


@dataclass
class PriceSnapshot:
    """Um ponto da série histórica de preço de uma rota — a unidade fundamental sobre a
    qual o histórico, o TripScore e o feed público de ofertas são construídos."""

    origin_iata: str
    destination_iata: str
    departure_date: str  # ISO 8601 (YYYY-MM-DD)
    price_cents: int
    currency: str
    cabin_class: str
    source_provider: str
    id: UUID = field(default_factory=uuid4)
    return_date: str | None = None
    airline_iata: str | None = None
    collected_at: datetime = field(default_factory=lambda: datetime.now(UTC))
