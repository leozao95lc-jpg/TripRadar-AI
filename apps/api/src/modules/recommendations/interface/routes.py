from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from modules.alerts.infrastructure.repository import SqlAlchemyAlertRepository
from modules.identity.domain.entities import User
from modules.identity.interface.dependencies import get_current_user
from modules.price_monitoring.infrastructure.repository import SqlAlchemyPriceSnapshotRepository
from modules.recommendations.application.trip_score import CalculateTripScore, NoPriceDataError
from modules.recommendations.infrastructure.price_history_adapter import PriceMonitoringHistoryAdapter
from modules.recommendations.infrastructure.repository import (
    SqlAlchemyExchangeSignalReader,
    SqlAlchemyMileageValuationReader,
    SqlAlchemyRecommendationRepository,
)
from modules.recommendations.interface.schemas import TripScoreResponse
from shared.database import get_db

router = APIRouter(prefix="/api/v1/alerts", tags=["recommendations"])


def _build_use_case(db: Session) -> CalculateTripScore:
    return CalculateTripScore(
        PriceMonitoringHistoryAdapter(SqlAlchemyPriceSnapshotRepository(db)),
        SqlAlchemyMileageValuationReader(db),
        SqlAlchemyExchangeSignalReader(db),
        SqlAlchemyRecommendationRepository(db),
    )


@router.get("/{alert_id}/recommendation", response_model=TripScoreResponse)
def get_alert_recommendation(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TripScoreResponse:
    alert = SqlAlchemyAlertRepository(db).get_by_id(alert_id)
    if alert is None or alert.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    try:
        use_case = _build_use_case(db)
        result = use_case.execute(alert.origin_iata, alert.destination_iata, alert.cabin_class.value)
    except NoPriceDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No price data yet for this route"
        ) from exc

    return TripScoreResponse(
        origin_iata=result.origin_iata,
        destination_iata=result.destination_iata,
        cabin_class=result.cabin_class,
        verdict=result.verdict,
        confidence=result.confidence,
        current_price_cents=result.current_price_cents,
        target_price_cents=result.target_price_cents,
        explanation=result.explanation,
        factors=result.factors,
        generated_at=result.generated_at,
    )
