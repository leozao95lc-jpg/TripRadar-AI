from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from modules.identity.domain.entities import OAuthAccount, User


class UserRepository(ABC):
    @abstractmethod
    def get_by_email(self, email: str) -> User | None: ...

    @abstractmethod
    def get_by_id(self, user_id: UUID) -> User | None: ...

    @abstractmethod
    def add(self, user: User) -> None: ...

    @abstractmethod
    def count_total(self) -> int: ...

    @abstractmethod
    def count_created_since(self, since: datetime) -> int: ...


class OAuthAccountRepository(ABC):
    @abstractmethod
    def get_by_provider_id(self, provider: str, provider_user_id: str) -> OAuthAccount | None: ...

    @abstractmethod
    def add(self, account: OAuthAccount) -> None: ...
