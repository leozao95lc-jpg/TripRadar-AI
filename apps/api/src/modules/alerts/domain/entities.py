from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4


class TripType(StrEnum):
    ONE_WAY = "one_way"
    ROUND_TRIP = "round_trip"


class CabinClass(StrEnum):
    ECONOMY = "economy"
    PREMIUM_ECONOMY = "premium_economy"
    BUSINESS = "business"
    FIRST = "first"


class AlertStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


@dataclass
class SearchAlert:
    user_id: UUID
    origin_iata: str
    destination_iata: str
    trip_type: TripType
    departure_date: str  # ISO 8601
    max_price_cents: int
    id: UUID = field(default_factory=uuid4)
    return_date: str | None = None
    flexible_dates: bool = False
    currency: str = "BRL"
    cabin_class: CabinClass = CabinClass.ECONOMY
    passengers: int = 1
    max_stops: int | None = None
    alternative_airports_ok: bool = False
    status: AlertStatus = AlertStatus.ACTIVE
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class AlertTrigger:
    """Registro imutável de um disparo — base para a métrica de economia validada
    (ver docs/02-mvp-roadmap.md, seção 3.7)."""

    alert_id: UUID
    price_snapshot_id: UUID
    price_at_trigger_cents: int
    reason: str
    id: UUID = field(default_factory=uuid4)
    triggered_at: datetime = field(default_factory=lambda: datetime.now(UTC))
