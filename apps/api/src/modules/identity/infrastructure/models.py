from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from shared.database import GUID, Base


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    locale: Mapped[str] = mapped_column(String(10), default="pt-BR")
    role: Mapped[str] = mapped_column(String(20), default="user")
    plan: Mapped[str] = mapped_column(String(20), default="free")
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )


class OAuthAccountModel(Base):
    __tablename__ = "oauth_accounts"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class AuditLogModel(Base):
    """Auditoria de ações sensíveis (login, alteração de alerta, upgrade de plano, exclusão de conta)."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    user_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    event_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
