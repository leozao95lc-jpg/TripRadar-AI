from datetime import datetime

from pydantic import BaseModel


class TripScoreResponse(BaseModel):
    origin_iata: str
    destination_iata: str
    cabin_class: str
    verdict: str
    confidence: float
    current_price_cents: int
    target_price_cents: int
    explanation: str
    factors: dict
    generated_at: datetime
