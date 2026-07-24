from abc import ABC, abstractmethod
from uuid import UUID

from modules.notifications.domain.entities import Notification, NotificationChannel, NotificationPreference


class NotificationSender(ABC):
    """Porta única para qualquer canal de envio (e-mail, WhatsApp, Telegram...)."""

    @abstractmethod
    def send(self, *, destination: str, subject: str, message: str) -> bool: ...


class NotificationPreferenceRepository(ABC):
    @abstractmethod
    def list_enabled_for_user(self, user_id: UUID) -> list[NotificationPreference]: ...

    @abstractmethod
    def list_for_user(self, user_id: UUID) -> list[NotificationPreference]:
        """Todas as preferências do usuário, habilitadas ou não — usado pela tela de
        configurações pra mostrar canais pendentes de confirmação."""
        ...

    @abstractmethod
    def get_for_user_and_channel(
        self, user_id: UUID, channel: NotificationChannel
    ) -> NotificationPreference | None: ...

    @abstractmethod
    def upsert(self, preference: NotificationPreference) -> None: ...


class NotificationRepository(ABC):
    @abstractmethod
    def add(self, notification: Notification) -> None: ...

    @abstractmethod
    def list_by_alert_trigger(self, alert_trigger_id: UUID) -> list[Notification]: ...
