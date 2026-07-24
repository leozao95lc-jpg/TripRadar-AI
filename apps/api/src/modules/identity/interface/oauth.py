from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from modules.identity.domain.entities import OAuthAccount, User
from modules.identity.infrastructure.repository import (
    SqlAlchemyOAuthAccountRepository,
    SqlAlchemyUserRepository,
)
from shared.config import settings
from shared.database import get_db
from shared.security import create_access_token, create_refresh_token

router = APIRouter(prefix="/api/v1/auth/oauth", tags=["identity"])

oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=settings.google_oauth_client_id,
    client_secret=settings.google_oauth_client_secret,
    client_kwargs={"scope": "openid email profile"},
)


def _require_configured() -> None:
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth não configurado (defina GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET).",
        )


@router.get("/google/login")
async def google_login(request: Request):
    _require_configured()
    return await oauth.google.authorize_redirect(request, settings.google_oauth_redirect_url)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Login/registro via Google: cria a conta local no primeiro acesso e vincula por provider_user_id."""
    _require_configured()
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or await oauth.google.userinfo(token=token)
    email = userinfo["email"].lower()
    provider_user_id = userinfo["sub"]

    oauth_repo = SqlAlchemyOAuthAccountRepository(db)
    user_repo = SqlAlchemyUserRepository(db)

    account = oauth_repo.get_by_provider_id("google", provider_user_id)
    if account is not None:
        user = user_repo.get_by_id(account.user_id)
    else:
        user = user_repo.get_by_email(email)
        if user is None:
            user = User(email=email, password_hash=None, full_name=userinfo.get("name", email))
            user_repo.add(user)
        oauth_repo.add(OAuthAccount(user_id=user.id, provider="google", provider_user_id=provider_user_id))

    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
    }
