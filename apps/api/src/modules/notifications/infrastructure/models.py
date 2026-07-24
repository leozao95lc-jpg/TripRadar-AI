from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import GUID, Base


class NotificationPreferenceModel(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", "channel", name="uq_notification_pref_user_channel"),)

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(GUID, nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    verification_code_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class NotificationModel(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    alert_trigger_id: Mapped[str] = mapped_column(GUID, nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
