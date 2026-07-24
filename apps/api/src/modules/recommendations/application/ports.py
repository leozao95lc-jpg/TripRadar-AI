from abc import ABC, abstractmethod

from modules.recommendations.domain.entities import (
    HistoricalPricePoint,
    MileageValuation,
    TripScoreResult,
)


class PriceHistoryReader(ABC):
    """Porta possuída por `recommendations`; `price_monitoring` é quem fornece um
    adapter concreto que reusa seu próprio caso de uso público (GetPriceHistory) —
    `recommendations` nunca acessa a infraestrutura de `price_monitoring`."""

    @abstractmethod
    def history(
        self, origin_iata: str, destination_iata: str, cabin_class: str, range_days: int
    ) -> list[HistoricalPricePoint]: ...


class MileageValuationReader(ABC):
    @abstractmethod
    def list_all(self) -> list[MileageValuation]: ...


class ExchangeSignalReader(ABC):
    @abstractmethod
    def latest_signal(self) -> str:
        """'favorable' | 'unfavorable' | 'stable' | 'unknown'."""
        ...


class RecommendationRepository(ABC):
    @abstractmethod
    def add(self, result: TripScoreResult) -> None: ...
