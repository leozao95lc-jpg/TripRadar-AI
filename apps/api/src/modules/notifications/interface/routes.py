from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from modules.identity.domain.entities import User
from modules.identity.interface.dependencies import get_current_user
from modules.notifications.application.use_cases import (
    ConfirmNotificationChannel,
    InvalidVerificationCodeError,
    SetNotificationPreference,
)
from modules.notifications.infrastructure.email_channel import EmailNotificationSender
from modules.notifications.infrastructure.repository import SqlAlchemyNotificationPreferenceRepository
from modules.notifications.infrastructure.whatsapp_channel import WhatsAppNotificationSender
from modules.notifications.interface.schemas import (
    NotificationPreferenceRequest,
    NotificationPreferenceResponse,
    VerifyChannelRequest,
)
from shared.database import get_db

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


def _senders() -> dict:
    return {"email": EmailNotificationSender(), "whatsapp": WhatsAppNotificationSender()}


def _to_response(preference) -> NotificationPreferenceResponse:
    return NotificationPreferenceResponse(
        channel=preference.channel.value,
        destination=preference.destination,
        enabled=preference.enabled,
        pending_verification=(not preference.enabled and preference.verification_code_hash is not None),
    )


@router.get("/preferences", response_model=list[NotificationPreferenceResponse])
def list_preferences(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[NotificationPreferenceResponse]:
    repo = SqlAlchemyNotificationPreferenceRepository(db)
    return [_to_response(p) for p in repo.list_for_user(current_user.id)]


@router.put("/preferences", response_model=NotificationPreferenceResponse)
def set_preference(
    payload: NotificationPreferenceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPreferenceResponse:
    repo = SqlAlchemyNotificationPreferenceRepository(db)
    preference = SetNotificationPreference(repo, _senders()).execute(
        current_user.id, current_user.email, payload.channel, payload.destination, payload.enabled
    )
    return _to_response(preference)


@router.post("/preferences/verify", response_model=NotificationPreferenceResponse)
def verify_preference(
    payload: VerifyChannelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPreferenceResponse:
    repo = SqlAlchemyNotificationPreferenceRepository(db)
    try:
        preference = ConfirmNotificationChannel(repo).execute(current_user.id, payload.channel, payload.code)
    except InvalidVerificationCodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code"
        ) from exc
    return _to_response(preference)
