from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from modules.identity.application.use_cases import (
    AuthenticateUser,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    RegisterUser,
)
from modules.identity.domain.entities import User
from modules.identity.infrastructure.repository import SqlAlchemyUserRepository
from modules.identity.interface.dependencies import get_current_user
from modules.identity.interface.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserProfileResponse,
)
from shared.database import get_db
from shared.events import event_bus
from shared.rate_limit import rate_limit

router = APIRouter(prefix="/api/v1/auth", tags=["identity"])
me_router = APIRouter(prefix="/api/v1/me", tags=["identity"])


@router.post(
    "/register",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(5, 3600))],
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> UserProfileResponse:
    use_case = RegisterUser(SqlAlchemyUserRepository(db))
    try:
        user = use_case.execute(payload.email, payload.password, payload.full_name)
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from exc
    event_bus.dispatch(use_case.pending_events, db)
    return UserProfileResponse(
        id=user.id, email=user.email, full_name=user.full_name, locale=user.locale,
        role=user.role.value, plan=user.plan.value, mfa_enabled=user.mfa_enabled,
    )


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit(10, 300))])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    use_case = AuthenticateUser(SqlAlchemyUserRepository(db))
    try:
        tokens = use_case.execute(payload.email, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials") from exc
    return TokenResponse(access_token=tokens.access_token, refresh_token=tokens.refresh_token)


@me_router.get("", response_model=UserProfileResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse(
        id=current_user.id, email=current_user.email, full_name=current_user.full_name,
        locale=current_user.locale, role=current_user.role.value, plan=current_user.plan.value,
        mfa_enabled=current_user.mfa_enabled,
    )
