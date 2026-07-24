import hashlib
from datetime import UTC, datetime
from uuid import UUID

from modules.feature_flags.application.ports import FeatureFlagRepository
from modules.feature_flags.domain.entities import FeatureFlag


def _rollout_bucket(key: str, user_id: UUID | str | None) -> int:
    """0-99, determinístico por (flag, usuário) — mesmo esquema de hash usado em
    `MockFlightProvider` para seed determinístico: o mesmo usuário sempre cai no
    mesmo bucket, então o rollout não "pisca" entre requisições consecutivas."""
    seed = f"{key}:{user_id or 'anonymous'}"
    digest = hashlib.sha256(seed.encode()).hexdigest()
    return int(digest, 16) % 100


class IsFeatureEnabled:
    def __init__(self, flags: FeatureFlagRepository) -> None:
        self._flags = flags

    def execute(self, key: str, user_id: UUID | str | None = None) -> bool:
        flag = self._flags.get_by_key(key)
        if flag is None or not flag.enabled:
            return False
        if flag.rollout_percentage >= 100:
            return True
        if flag.rollout_percentage <= 0:
            return False
        return _rollout_bucket(key, user_id) < flag.rollout_percentage


class ListFeatureFlags:
    def __init__(self, flags: FeatureFlagRepository) -> None:
        self._flags = flags

    def execute(self) -> list[FeatureFlag]:
        return self._flags.list_all()


class SetFeatureFlag:
    def __init__(self, flags: FeatureFlagRepository) -> None:
        self._flags = flags

    def execute(
        self, key: str, enabled: bool, rollout_percentage: int = 100, description: str | None = None
    ) -> FeatureFlag:
        existing = self._flags.get_by_key(key)
        if description is None:
            description = existing.description if existing else ""
        flag = FeatureFlag(
            key=key,
            enabled=enabled,
            rollout_percentage=max(0, min(100, rollout_percentage)),
            description=description,
            updated_at=datetime.now(UTC),
        )
        return self._flags.upsert(flag)
