from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.feature_flags.application.ports import FeatureFlagRepository
from modules.feature_flags.domain.entities import FeatureFlag
from modules.feature_flags.infrastructure.models import FeatureFlagModel


def _to_domain(row: FeatureFlagModel) -> FeatureFlag:
    return FeatureFlag(
        key=row.key,
        enabled=row.enabled,
        rollout_percentage=row.rollout_percentage,
        description=row.description,
        updated_at=row.updated_at,
    )


class SqlAlchemyFeatureFlagRepository(FeatureFlagRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_all(self) -> list[FeatureFlag]:
        rows = self._session.execute(select(FeatureFlagModel).order_by(FeatureFlagModel.key)).scalars().all()
        return [_to_domain(row) for row in rows]

    def get_by_key(self, key: str) -> FeatureFlag | None:
        row = self._session.get(FeatureFlagModel, key)
        return _to_domain(row) if row is not None else None

    def upsert(self, flag: FeatureFlag) -> FeatureFlag:
        existing = self._session.get(FeatureFlagModel, flag.key)
        if existing is not None:
            existing.enabled = flag.enabled
            existing.rollout_percentage = flag.rollout_percentage
            existing.description = flag.description
            existing.updated_at = flag.updated_at
        else:
            self._session.add(
                FeatureFlagModel(
                    key=flag.key,
                    enabled=flag.enabled,
                    rollout_percentage=flag.rollout_percentage,
                    description=flag.description,
                    updated_at=flag.updated_at,
                )
            )
        self._session.flush()
        return flag


class InMemoryFeatureFlagRepository(FeatureFlagRepository):
    def __init__(self) -> None:
        self._by_key: dict[str, FeatureFlag] = {}

    def list_all(self) -> list[FeatureFlag]:
        return list(self._by_key.values())

    def get_by_key(self, key: str) -> FeatureFlag | None:
        return self._by_key.get(key)

    def upsert(self, flag: FeatureFlag) -> FeatureFlag:
        self._by_key[flag.key] = flag
        return flag
