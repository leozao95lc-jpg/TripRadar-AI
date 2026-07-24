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
    user_id: UUID
    channel: NotificationChannel
    destination: str
    id: UUID = field(default_factory=uuid4)
    enabled: bool = True


@dataclass
class Notification:
    alert_trigger_id: UUID
    channel: NotificationChannel
    status: NotificationStatus
    id: UUID = field(default_factory=uuid4)
    sent_at: datetime = field(default_factory=lambda: datetime.now(UTC))
