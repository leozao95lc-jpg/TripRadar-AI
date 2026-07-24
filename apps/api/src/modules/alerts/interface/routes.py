from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from modules.alerts.application.use_cases import (
    AlertLimitReachedError,
    AlertNotFoundError,
    AlertNotOwnedByUserError,
    CreateAlert,
    CreateAlertInput,
    DeleteAlert,
    ListUserAlerts,
)
from modules.alerts.domain.entities import SearchAlert
from modules.alerts.infrastructure.identity_plan_adapter import IdentityUserPlanAdapter
from modules.alerts.infrastructure.repository import SqlAlchemyAlertRepository
from modules.alerts.interface.schemas import AlertResponse, CreateAlertRequest
from modules.identity.domain.entities import User
from modules.identity.infrastructure.repository import SqlAlchemyUserRepository
from modules.identity.interface.dependencies import get_current_user
from shared.database import get_db
from shared.events import event_bus
from shared.rate_limit import rate_limit

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


def _to_response(alert: SearchAlert) -> AlertResponse:
    return AlertResponse(
        id=alert.id,
        origin_iata=alert.origin_iata,
        destination_iata=alert.destination_iata,
        trip_type=alert.trip_type.value,
        departure_date=alert.departure_date,
        return_date=alert.return_date,
        flexible_dates=alert.flexible_dates,
        max_price_cents=alert.max_price_cents,
        currency=alert.currency,
        cabin_class=alert.cabin_class.value,
        passengers=alert.passengers,
        max_stops=alert.max_stops,
        alternative_airports_ok=alert.alternative_airports_ok,
        status=alert.status.value,
        created_at=alert.created_at,
    )


@router.post(
    "",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(20, 3600))],
)
def create_alert(
    payload: CreateAlertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    plan_port = IdentityUserPlanAdapter(SqlAlchemyUserRepository(db))
    use_case = CreateAlert(SqlAlchemyAlertRepository(db), plan_port)
    try:
        alert = use_case.execute(
            CreateAlertInput(
                user_id=current_user.id,
                origin_iata=payload.origin_iata,
                destination_iata=payload.destination_iata,
                trip_type=payload.trip_type,
                departure_date=payload.departure_date,
                max_price_cents=payload.max_price_cents,
                return_date=payload.return_date,
                flexible_dates=payload.flexible_dates,
                currency=payload.currency,
                cabin_class=payload.cabin_class,
                passengers=payload.passengers,
                max_stops=payload.max_stops,
                alternative_airports_ok=payload.alternative_airports_ok,
            )
        )
    except AlertLimitReachedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    event_bus.dispatch(use_case.pending_events, db)
    return _to_response(alert)


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[AlertResponse]:
    alerts = ListUserAlerts(SqlAlchemyAlertRepository(db)).execute(current_user.id)
    return [_to_response(a) for a in alerts]


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    alert_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    try:
        DeleteAlert(SqlAlchemyAlertRepository(db)).execute(alert_id, current_user.id)
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found") from exc
    except AlertNotOwnedByUserError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your alert") from exc
