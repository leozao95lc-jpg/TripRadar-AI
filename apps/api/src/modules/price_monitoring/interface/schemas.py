from datetime import datetime

from pydantic import BaseModel


class PriceSnapshotResponse(BaseModel):
    departure_date: str
    return_date: str | None
    price_cents: int
    currency: str
    airline_iata: str | None
    collected_at: datetime


class PriceHistoryResponse(BaseModel):
    origin_iata: str
    destination_iata: str
    cabin_class: str
    range_days: int
    min_price_cents: int | None
    avg_price_cents: int | None
    max_price_cents: int | None
    snapshots: list[PriceSnapshotResponse]
