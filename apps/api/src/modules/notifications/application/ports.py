from abc import ABC, abstractmethod
from uuid import UUID

from modules.notifications.domain.entities import Notification, NotificationPreference


class NotificationSender(ABC):
    """Porta única para qualquer canal de envio (e-mail, WhatsApp, Telegram...)."""

    @abstractmethod
    def send(self, *, destination: str, subject: str, message: str) -> bool: ...


class NotificationPreferenceRepository(ABC):
    @abstractmethod
    def list_enabled_for_user(self, user_id: UUID) -> list[NotificationPreference]: ...

    @abstractmethod
    def upsert(self, preference: NotificationPreference) -> None: ...


class NotificationRepository(ABC):
    @abstractmethod
    def add(self, notification: Notification) -> None: ...

    @abstractmethod
    def list_by_alert_trigger(self, alert_trigger_id: UUID) -> list[Notification]: ...
