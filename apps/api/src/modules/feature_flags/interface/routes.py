from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.feature_flags.application.use_cases import ListFeatureFlags, SetFeatureFlag
from modules.feature_flags.domain.entities import FeatureFlag
from modules.feature_flags.infrastructure.repository import SqlAlchemyFeatureFlagRepository
from modules.feature_flags.interface.schemas import FeatureFlagResponse, SetFeatureFlagRequest
from modules.identity.domain.entities import User
from modules.identity.interface.dependencies import require_admin
from shared.database import get_db

router = APIRouter(prefix="/api/v1/admin/feature-flags", tags=["admin"])


def _to_response(flag: FeatureFlag) -> FeatureFlagResponse:
    return FeatureFlagResponse(
        key=flag.key,
        enabled=flag.enabled,
        rollout_percentage=flag.rollout_percentage,
        description=flag.description,
        updated_at=flag.updated_at,
    )


@router.get("", response_model=list[FeatureFlagResponse])
def list_feature_flags(
    _admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[FeatureFlagResponse]:
    flags = ListFeatureFlags(SqlAlchemyFeatureFlagRepository(db)).execute()
    return [_to_response(f) for f in flags]


@router.put("/{key}", response_model=FeatureFlagResponse)
def set_feature_flag(
    key: str,
    payload: SetFeatureFlagRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> FeatureFlagResponse:
    flag = SetFeatureFlag(SqlAlchemyFeatureFlagRepository(db)).execute(
        key, payload.enabled, payload.rollout_percentage, payload.description
    )
    return _to_response(flag)
