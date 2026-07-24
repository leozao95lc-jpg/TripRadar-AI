from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.price_monitoring.application.use_cases import GetPriceHistory
from modules.price_monitoring.infrastructure.repository import SqlAlchemyPriceSnapshotRepository
from modules.price_monitoring.interface.schemas import PriceHistoryResponse, PriceSnapshotResponse
from shared.database import get_db

router = APIRouter(prefix="/api/v1/routes", tags=["price_monitoring"])


@router.get("/{origin_iata}/{destination_iata}/history", response_model=PriceHistoryResponse)
def get_route_history(
    origin_iata: str,
    destination_iata: str,
    cabin_class: str = Query(default="economy"),
    range_days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
) -> PriceHistoryResponse:
    snapshots = GetPriceHistory(SqlAlchemyPriceSnapshotRepository(db)).execute(
        origin_iata.upper(), destination_iata.upper(), cabin_class, range_days
    )
    prices = [s.price_cents for s in snapshots]

    return PriceHistoryResponse(
        origin_iata=origin_iata.upper(),
        destination_iata=destination_iata.upper(),
        cabin_class=cabin_class,
        range_days=range_days,
        min_price_cents=min(prices) if prices else None,
        avg_price_cents=int(sum(prices) / len(prices)) if prices else None,
        max_price_cents=max(prices) if prices else None,
        snapshots=[
            PriceSnapshotResponse(
                departure_date=s.departure_date,
                return_date=s.return_date,
                price_cents=s.price_cents,
                currency=s.currency,
                airline_iata=s.airline_iata,
                collected_at=s.collected_at,
            )
            for s in snapshots
        ],
    )
