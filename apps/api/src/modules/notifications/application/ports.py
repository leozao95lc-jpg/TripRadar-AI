from abc import ABC, abstractmethod
from datetime import datetime
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

    @abstractmethod
    def list_since(self, since: datetime) -> list[Notification]:
        """Usado só pelo dashboard administrativo para agregar por canal/status —
        volume baixo o suficiente no MVP para agregar em Python, mesmo raciocínio já
        aplicado em `AlertRepository.list_distinct_active_routes`."""
        ...
