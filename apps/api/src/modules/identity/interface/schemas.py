from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    # Só exigido quando `settings.beta_access_code` está configurado (beta
    # fechado com senha compartilhada) — ver docs/13-deploy-beta-privado.md.
    # Em dev/teste (sem a variável definida), este campo é ignorado.
    access_code: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserProfileResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    locale: str
    role: str
    plan: str
    mfa_enabled: bool
