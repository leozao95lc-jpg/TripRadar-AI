from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.identity.domain.entities import User
from modules.identity.interface.dependencies import get_current_user
from modules.notifications.application.use_cases import SetNotificationPreference
from modules.notifications.infrastructure.repository import SqlAlchemyNotificationPreferenceRepository
from modules.notifications.interface.schemas import (
    NotificationPreferenceRequest,
    NotificationPreferenceResponse,
)
from shared.database import get_db

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("/preferences", response_model=list[NotificationPreferenceResponse])
def list_preferences(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[NotificationPreferenceResponse]:
    repo = SqlAlchemyNotificationPreferenceRepository(db)
    preferences = repo.list_enabled_for_user(current_user.id)
    return [
        NotificationPreferenceResponse(channel=p.channel.value, destination=p.destination, enabled=p.enabled)
        for p in preferences
    ]


@router.put("/preferences", response_model=NotificationPreferenceResponse)
def set_preference(
    payload: NotificationPreferenceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPreferenceResponse:
    repo = SqlAlchemyNotificationPreferenceRepository(db)
    preference = SetNotificationPreference(repo).execute(
        current_user.id, payload.channel, payload.destination, payload.enabled
    )
    return NotificationPreferenceResponse(
        channel=preference.channel.value, destination=preference.destination, enabled=preference.enabled
    )
