from abc import ABC, abstractmethod
from datetime import date

from modules.price_monitoring.domain.entities import PriceSnapshot


class PriceSnapshotRepository(ABC):
    @abstractmethod
    def add(self, snapshot: PriceSnapshot) -> None: ...

    @abstractmethod
    def history(
        self, origin_iata: str, destination_iata: str, cabin_class: str, since: date
    ) -> list[PriceSnapshot]: ...
