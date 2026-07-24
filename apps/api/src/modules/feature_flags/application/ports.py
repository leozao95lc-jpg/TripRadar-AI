from abc import ABC, abstractmethod

from modules.feature_flags.domain.entities import FeatureFlag


class FeatureFlagRepository(ABC):
    @abstractmethod
    def list_all(self) -> list[FeatureFlag]: ...

    @abstractmethod
    def get_by_key(self, key: str) -> FeatureFlag | None: ...

    @abstractmethod
    def upsert(self, flag: FeatureFlag) -> FeatureFlag: ...
