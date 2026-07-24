from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.notifications.application.ports import NotificationPreferenceRepository, NotificationRepository
from modules.notifications.domain.entities import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationStatus,
)
from modules.notifications.infrastructure.models import NotificationModel, NotificationPreferenceModel


def _preference_to_domain(row: NotificationPreferenceModel) -> NotificationPreference:
    return NotificationPreference(
        id=UUID(str(row.id)),
        user_id=UUID(str(row.user_id)),
        channel=NotificationChannel(row.channel),
        destination=row.destination,
        enabled=row.enabled,
        verification_code_hash=row.verification_code_hash,
        verification_expires_at=row.verification_expires_at,
    )


def _notification_to_domain(row: NotificationModel) -> Notification:
    return Notification(
        id=UUID(str(row.id)),
        alert_trigger_id=UUID(str(row.alert_trigger_id)),
        channel=NotificationChannel(row.channel),
        status=NotificationStatus(row.status),
        sent_at=row.sent_at,
    )


class SqlAlchemyNotificationPreferenceRepository(NotificationPreferenceRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_enabled_for_user(self, user_id: UUID) -> list[NotificationPreference]:
        rows = (
            self._session.execute(
                select(NotificationPreferenceModel).where(
                    NotificationPreferenceModel.user_id == str(user_id),
                    NotificationPreferenceModel.enabled.is_(True),
                )
            )
            .scalars()
            .all()
        )
        return [_preference_to_domain(r) for r in rows]

    def list_for_user(self, user_id: UUID) -> list[NotificationPreference]:
        rows = (
            self._session.execute(
                select(NotificationPreferenceModel).where(NotificationPreferenceModel.user_id == str(user_id))
            )
            .scalars()
            .all()
        )
        return [_preference_to_domain(r) for r in rows]

    def get_for_user_and_channel(
        self, user_id: UUID, channel: NotificationChannel
    ) -> NotificationPreference | None:
        row = self._session.execute(
            select(NotificationPreferenceModel).where(
                NotificationPreferenceModel.user_id == str(user_id),
                NotificationPreferenceModel.channel == channel.value,
            )
        ).scalar_one_or_none()
        return _preference_to_domain(row) if row is not None else None

    def upsert(self, preference: NotificationPreference) -> None:
        existing = self._session.execute(
            select(NotificationPreferenceModel).where(
                NotificationPreferenceModel.user_id == str(preference.user_id),
                NotificationPreferenceModel.channel == preference.channel.value,
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.destination = preference.destination
            existing.enabled = preference.enabled
            existing.verification_code_hash = preference.verification_code_hash
            existing.verification_expires_at = preference.verification_expires_at
        else:
            self._session.add(
                NotificationPreferenceModel(
                    id=str(preference.id),
                    user_id=str(preference.user_id),
                    channel=preference.channel.value,
                    destination=preference.destination,
                    enabled=preference.enabled,
                    verification_code_hash=preference.verification_code_hash,
                    verification_expires_at=preference.verification_expires_at,
                )
            )
        self._session.flush()


class SqlAlchemyNotificationRepository(NotificationRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, notification: Notification) -> None:
        self._session.add(
            NotificationModel(
                id=str(notification.id),
                alert_trigger_id=str(notification.alert_trigger_id),
                channel=notification.channel.value,
                status=notification.status.value,
                sent_at=notification.sent_at,
            )
        )
        self._session.flush()

    def list_by_alert_trigger(self, alert_trigger_id: UUID) -> list[Notification]:
        rows = (
            self._session.execute(
                select(NotificationModel).where(NotificationModel.alert_trigger_id == str(alert_trigger_id))
            )
            .scalars()
            .all()
        )
        return [_notification_to_domain(r) for r in rows]

    def list_since(self, since: datetime) -> list[Notification]:
        rows = (
            self._session.execute(select(NotificationModel).where(NotificationModel.sent_at >= since))
            .scalars()
            .all()
        )
        return [_notification_to_domain(r) for r in rows]


class InMemoryNotificationPreferenceRepository(NotificationPreferenceRepository):
    def __init__(self) -> None:
        self._by_key: dict[tuple[UUID, NotificationChannel], NotificationPreference] = {}

    def list_enabled_for_user(self, user_id: UUID) -> list[NotificationPreference]:
        return [p for (uid, _), p in self._by_key.items() if uid == user_id and p.enabled]

    def list_for_user(self, user_id: UUID) -> list[NotificationPreference]:
        return [p for (uid, _), p in self._by_key.items() if uid == user_id]

    def get_for_user_and_channel(
        self, user_id: UUID, channel: NotificationChannel
    ) -> NotificationPreference | None:
        return self._by_key.get((user_id, channel))

    def upsert(self, preference: NotificationPreference) -> None:
        self._by_key[(preference.user_id, preference.channel)] = preference


class InMemoryNotificationRepository(NotificationRepository):
    def __init__(self) -> None:
        self._notifications: list[Notification] = []

    def add(self, notification: Notification) -> None:
        self._notifications.append(notification)

    def list_by_alert_trigger(self, alert_trigger_id: UUID) -> list[Notification]:
        return [n for n in self._notifications if n.alert_trigger_id == alert_trigger_id]

    def list_since(self, since: datetime) -> list[Notification]:
        return [n for n in self._notifications if n.sent_at >= since]
