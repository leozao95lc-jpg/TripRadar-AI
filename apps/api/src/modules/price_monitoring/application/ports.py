from abc import ABC, abstractmethod
from datetime import date, datetime

from modules.price_monitoring.domain.entities import PriceSnapshot


class PriceSnapshotRepository(ABC):
    @abstractmethod
    def add(self, snapshot: PriceSnapshot) -> None: ...

    @abstractmethod
    def history(
        self, origin_iata: str, destination_iata: str, cabin_class: str, since: date
    ) -> list[PriceSnapshot]: ...

    @abstractmethod
    def count_since(self, since: datetime) -> int: ...
