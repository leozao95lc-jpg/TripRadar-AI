import pytest

from modules.identity.application.use_cases import (
    AuthenticateUser,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    RegisterUser,
)
from modules.identity.infrastructure.repository import InMemoryUserRepository


def test_register_user_creates_account():
    repo = InMemoryUserRepository()
    user = RegisterUser(repo).execute("user@example.com", "supersecret", "Ana Silva")

    assert repo.get_by_email("user@example.com") is user
    assert user.password_hash != "supersecret"


def test_register_user_rejects_duplicate_email():
    repo = InMemoryUserRepository()
    RegisterUser(repo).execute("user@example.com", "supersecret", "Ana Silva")

    with pytest.raises(EmailAlreadyRegisteredError):
        RegisterUser(repo).execute("user@example.com", "another-pass", "Outra Pessoa")


def test_authenticate_user_returns_tokens_for_valid_credentials():
    repo = InMemoryUserRepository()
    RegisterUser(repo).execute("user@example.com", "supersecret", "Ana Silva")

    tokens = AuthenticateUser(repo).execute("user@example.com", "supersecret")

    assert tokens.access_token
    assert tokens.refresh_token
    assert tokens.token_type == "bearer"


def test_authenticate_user_rejects_wrong_password():
    repo = InMemoryUserRepository()
    RegisterUser(repo).execute("user@example.com", "supersecret", "Ana Silva")

    with pytest.raises(InvalidCredentialsError):
        AuthenticateUser(repo).execute("user@example.com", "wrong-password")
