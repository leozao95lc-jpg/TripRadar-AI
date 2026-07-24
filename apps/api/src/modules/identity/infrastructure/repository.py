from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.identity.application.ports import OAuthAccountRepository, UserRepository
from modules.identity.domain.entities import OAuthAccount, User, UserPlan, UserRole
from modules.identity.infrastructure.models import OAuthAccountModel, UserModel


def _to_domain(row: UserModel) -> User:
    return User(
        id=UUID(str(row.id)),
        email=row.email,
        password_hash=row.password_hash,
        full_name=row.full_name,
        locale=row.locale,
        role=UserRole(row.role),
        plan=UserPlan(row.plan),
        mfa_enabled=row.mfa_enabled,
        created_at=row.created_at,
    )


class SqlAlchemyUserRepository(UserRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_email(self, email: str) -> User | None:
        row = self._session.execute(select(UserModel).where(UserModel.email == email)).scalar_one_or_none()
        return _to_domain(row) if row else None

    def get_by_id(self, user_id: UUID) -> User | None:
        row = self._session.get(UserModel, str(user_id))
        return _to_domain(row) if row else None

    def add(self, user: User) -> None:
        self._session.add(
            UserModel(
                id=str(user.id),
                email=user.email,
                password_hash=user.password_hash,
                full_name=user.full_name,
                locale=user.locale,
                role=user.role.value,
                plan=user.plan.value,
                mfa_enabled=user.mfa_enabled,
                created_at=user.created_at,
            )
        )
        self._session.flush()

    def count_total(self) -> int:
        return self._session.execute(select(func.count()).select_from(UserModel)).scalar_one()

    def count_created_since(self, since: datetime) -> int:
        return self._session.execute(
            select(func.count()).select_from(UserModel).where(UserModel.created_at >= since)
        ).scalar_one()


class InMemoryUserRepository(UserRepository):
    """Implementação em memória — usada em testes de unidade dos casos de uso, sem tocar banco."""

    def __init__(self) -> None:
        self._by_id: dict[UUID, User] = {}

    def get_by_email(self, email: str) -> User | None:
        return next((u for u in self._by_id.values() if u.email == email), None)

    def get_by_id(self, user_id: UUID) -> User | None:
        return self._by_id.get(user_id)

    def add(self, user: User) -> None:
        self._by_id[user.id] = user

    def count_total(self) -> int:
        return len(self._by_id)

    def count_created_since(self, since: datetime) -> int:
        return sum(1 for u in self._by_id.values() if u.created_at >= since)


class SqlAlchemyOAuthAccountRepository(OAuthAccountRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_provider_id(self, provider: str, provider_user_id: str) -> OAuthAccount | None:
        row = self._session.execute(
            select(OAuthAccountModel).where(
                OAuthAccountModel.provider == provider,
                OAuthAccountModel.provider_user_id == provider_user_id,
            )
        ).scalar_one_or_none()
        if row is None:
            return None
        return OAuthAccount(
            id=UUID(str(row.id)),
            user_id=UUID(str(row.user_id)),
            provider=row.provider,
            provider_user_id=row.provider_user_id,
        )

    def add(self, account: OAuthAccount) -> None:
        self._session.add(
            OAuthAccountModel(
                id=str(account.id),
                user_id=str(account.user_id),
                provider=account.provider,
                provider_user_id=account.provider_user_id,
            )
        )
        self._session.flush()
