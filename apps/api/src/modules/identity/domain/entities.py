from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4


class UserRole(StrEnum):
    USER = "user"
    ADMIN = "admin"


class UserPlan(StrEnum):
    FREE = "free"
    PREMIUM = "premium"


@dataclass
class User:
    email: str
    password_hash: str | None
    full_name: str
    id: UUID = field(default_factory=uuid4)
    locale: str = "pt-BR"
    role: UserRole = UserRole.USER
    plan: UserPlan = UserPlan.FREE
    mfa_enabled: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class OAuthAccount:
    user_id: UUID
    provider: str
    provider_user_id: str
    id: UUID = field(default_factory=uuid4)
