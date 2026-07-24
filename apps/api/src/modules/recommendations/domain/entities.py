from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4


@dataclass(frozen=True)
class HistoricalPricePoint:
    price_cents: int
    collected_at: str  # ISO 8601


@dataclass(frozen=True)
class MileageValuation:
    program_code: str
    program_name: str
    reference_cents_per_mile: float


@dataclass(frozen=True)
class MileageComparison:
    program_code: str
    program_name: str
    estimated_miles_needed: int


@dataclass
class TripScoreResult:
    """O "TripScore": veredito explicável sobre se vale comprar agora ou esperar,
    junto dos fatores que embasaram a decisão — nunca uma resposta caixa-preta."""

    origin_iata: str
    destination_iata: str
    cabin_class: str
    verdict: str  # "buy" | "wait" | "insufficient_data"
    confidence: float
    current_price_cents: int
    target_price_cents: int
    explanation: str
    factors: dict
    id: UUID = field(default_factory=uuid4)
    generated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
