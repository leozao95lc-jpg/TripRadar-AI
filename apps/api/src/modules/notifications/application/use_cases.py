from uuid import UUID

from modules.notifications.application.ports import (
    NotificationPreferenceRepository,
    NotificationRepository,
    NotificationSender,
)
from modules.notifications.domain.entities import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationStatus,
)


class CreateDefaultEmailPreference:
    """Reage ao evento `user_registered` (publicado por `identity`) criando a
    preferência de e-mail padrão — é assim que `notifications` conhece o e-mail do
    usuário sem importar o módulo `identity`."""

    def __init__(self, preferences: NotificationPreferenceRepository) -> None:
        self._preferences = preferences

    def execute(self, user_id: UUID, email: str) -> NotificationPreference:
        preference = NotificationPreference(
            user_id=user_id, channel=NotificationChannel.EMAIL, destination=email, enabled=True
        )
        self._preferences.upsert(preference)
        return preference


class SetNotificationPreference:
    def __init__(self, preferences: NotificationPreferenceRepository) -> None:
        self._preferences = preferences

    def execute(self, user_id: UUID, channel: str, destination: str, enabled: bool) -> NotificationPreference:
        preference = NotificationPreference(
            user_id=user_id, channel=NotificationChannel(channel), destination=destination, enabled=enabled
        )
        self._preferences.upsert(preference)
        return preference


class DispatchAlertNotification:
    """Reage ao evento `alert_triggered` (publicado por `alerts`): envia por cada canal
    habilitado do usuário e registra o resultado. Canal sem sender configurado (ex.:
    WhatsApp sem credencial) é ignorado, não derruba o processo."""

    def __init__(
        self,
        preferences: NotificationPreferenceRepository,
        notifications: NotificationRepository,
        senders: dict[str, NotificationSender],
    ) -> None:
        self._preferences = preferences
        self._notifications = notifications
        self._senders = senders

    def execute(
        self, *, user_id: UUID, alert_trigger_id: UUID, subject: str, message: str
    ) -> list[Notification]:
        preferences = [p for p in self._preferences.list_enabled_for_user(user_id) if p.enabled]
        sent: list[Notification] = []

        for preference in preferences:
            sender = self._senders.get(preference.channel.value)
            if sender is None:
                status = NotificationStatus.SKIPPED
            else:
                status = NotificationStatus.SENT if sender.send(
                    destination=preference.destination, subject=subject, message=message
                ) else NotificationStatus.FAILED

            notification = Notification(
                alert_trigger_id=alert_trigger_id, channel=preference.channel, status=status
            )
            self._notifications.add(notification)
            sent.append(notification)

        return sent
