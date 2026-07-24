from dataclasses import dataclass
from uuid import UUID

from modules.identity.application.ports import UserRepository
from modules.identity.domain.entities import User
from shared.events import DomainEvent
from shared.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)

USER_REGISTERED = "user_registered"


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


@dataclass
class AuthTokens:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterUser:
    """Caso de uso: cria uma conta nova por e-mail/senha. Levanta erro de domínio se o
    e-mail já existe. Não publica eventos diretamente — acumula em `pending_events`;
    quem chama (composition root) decide quando e com qual sessão despachá-los."""

    def __init__(self, users: UserRepository) -> None:
        self._users = users
        self.pending_events: list[DomainEvent] = []

    def execute(self, email: str, password: str, full_name: str) -> User:
        self.pending_events = []
        email = email.strip().lower()
        if self._users.get_by_email(email) is not None:
            raise EmailAlreadyRegisteredError(email)
        user = User(email=email, password_hash=hash_password(password), full_name=full_name)
        self._users.add(user)
        self.pending_events.append(
            DomainEvent(name=USER_REGISTERED, payload={"user_id": str(user.id), "email": user.email})
        )
        return user


class AuthenticateUser:
    """Caso de uso: valida credenciais e emite par de tokens JWT (access + refresh)."""

    def __init__(self, users: UserRepository) -> None:
        self._users = users

    def execute(self, email: str, password: str) -> AuthTokens:
        user = self._users.get_by_email(email.strip().lower())
        if user is None or user.password_hash is None or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError(email)
        return AuthTokens(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )


class GetUserProfile:
    def __init__(self, users: UserRepository) -> None:
        self._users = users

    def execute(self, user_id: UUID) -> User:
        user = self._users.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError(str(user_id))
        return user
