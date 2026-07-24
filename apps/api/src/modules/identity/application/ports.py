from abc import ABC, abstractmethod
from uuid import UUID

from modules.identity.domain.entities import OAuthAccount, User


class UserRepository(ABC):
    @abstractmethod
    def get_by_email(self, email: str) -> User | None: ...

    @abstractmethod
    def get_by_id(self, user_id: UUID) -> User | None: ...

    @abstractmethod
    def add(self, user: User) -> None: ...


class OAuthAccountRepository(ABC):
    @abstractmethod
    def get_by_provider_id(self, provider: str, provider_user_id: str) -> OAuthAccount | None: ...

    @abstractmethod
    def add(self, account: OAuthAccount) -> None: ...
