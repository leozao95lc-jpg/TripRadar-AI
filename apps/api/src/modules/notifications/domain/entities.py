from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4


class NotificationChannel(StrEnum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"


class NotificationStatus(StrEnum):
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class NotificationPreference:
    """`enabled=False` com `verification_code_hash` preenchido significa "aguardando
    confirmação": o canal só passa a receber notificações (e só aparece como
    habilitado) depois que o dono confirma que controla aquele destino. O canal
    `email` é exceção — sempre usa o e-mail da própria conta e fica habilitado na
    hora, sem código (ver `SetNotificationPreference` e docs/09-revisao-tecnica-backend.md,
    achado #2)."""

    user_id: UUID
    channel: NotificationChannel
    destination: str
    id: UUID = field(default_factory=uuid4)
    enabled: bool = True
    verification_code_hash: str | None = None
    verification_expires_at: datetime | None = None


@dataclass
class Notification:
    alert_trigger_id: UUID
    channel: NotificationChannel
    status: NotificationStatus
    id: UUID = field(default_factory=uuid4)
    sent_at: datetime = field(default_factory=lambda: datetime.now(UTC))
