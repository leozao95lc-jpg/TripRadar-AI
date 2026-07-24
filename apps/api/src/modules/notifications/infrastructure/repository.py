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
        return [
            NotificationPreference(
                id=UUID(str(r.id)),
                user_id=UUID(str(r.user_id)),
                channel=NotificationChannel(r.channel),
                destination=r.destination,
                enabled=r.enabled,
            )
            for r in rows
        ]

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
        else:
            self._session.add(
                NotificationPreferenceModel(
                    id=str(preference.id),
                    user_id=str(preference.user_id),
                    channel=preference.channel.value,
                    destination=preference.destination,
                    enabled=preference.enabled,
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
        return [
            Notification(
                id=UUID(str(r.id)),
                alert_trigger_id=UUID(str(r.alert_trigger_id)),
                channel=NotificationChannel(r.channel),
                status=NotificationStatus(r.status),
                sent_at=r.sent_at,
            )
            for r in rows
        ]


class InMemoryNotificationPreferenceRepository(NotificationPreferenceRepository):
    def __init__(self) -> None:
        self._by_key: dict[tuple[UUID, NotificationChannel], NotificationPreference] = {}

    def list_enabled_for_user(self, user_id: UUID) -> list[NotificationPreference]:
        return [p for (uid, _), p in self._by_key.items() if uid == user_id and p.enabled]

    def upsert(self, preference: NotificationPreference) -> None:
        self._by_key[(preference.user_id, preference.channel)] = preference


class InMemoryNotificationRepository(NotificationRepository):
    def __init__(self) -> None:
        self._notifications: list[Notification] = []

    def add(self, notification: Notification) -> None:
        self._notifications.append(notification)

    def list_by_alert_trigger(self, alert_trigger_id: UUID) -> list[Notification]:
        return [n for n in self._notifications if n.alert_trigger_id == alert_trigger_id]
