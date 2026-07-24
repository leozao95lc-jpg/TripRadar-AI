from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreateAlertRequest(BaseModel):
    origin_iata: str = Field(min_length=3, max_length=3)
    destination_iata: str = Field(min_length=3, max_length=3)
    trip_type: str = Field(default="round_trip", pattern="^(one_way|round_trip)$")
    departure_date: str
    return_date: str | None = None
    flexible_dates: bool = False
    max_price_cents: int = Field(gt=0)
    currency: str = "BRL"
    cabin_class: str = Field(default="economy", pattern="^(economy|premium_economy|business|first)$")
    passengers: int = Field(default=1, ge=1, le=9)
    max_stops: int | None = Field(default=None, ge=0)
    alternative_airports_ok: bool = False


class AlertResponse(BaseModel):
    id: UUID
    origin_iata: str
    destination_iata: str
    trip_type: str
    departure_date: str
    return_date: str | None
    flexible_dates: bool
    max_price_cents: int
    currency: str
    cabin_class: str
    passengers: int
    max_stops: int | None
    alternative_airports_ok: bool
    status: str
    created_at: datetime
