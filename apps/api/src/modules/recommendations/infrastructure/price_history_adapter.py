from modules.price_monitoring.application.ports import PriceSnapshotRepository
from modules.price_monitoring.application.use_cases import GetPriceHistory
from modules.recommendations.application.ports import PriceHistoryReader
from modules.recommendations.domain.entities import HistoricalPricePoint


class PriceMonitoringHistoryAdapter(PriceHistoryReader):
    """Implementa a porta de leitura de histórico (definida por `recommendations`)
    reusando o caso de uso já público de `price_monitoring` (`GetPriceHistory`) — nunca
    acessa a infraestrutura daquele módulo diretamente, só a application layer dele."""

    def __init__(self, snapshots: PriceSnapshotRepository) -> None:
        self._get_history = GetPriceHistory(snapshots)

    def history(
        self, origin_iata: str, destination_iata: str, cabin_class: str, range_days: int
    ) -> list[HistoricalPricePoint]:
        snapshots = self._get_history.execute(origin_iata, destination_iata, cabin_class, range_days)
        return [
            HistoricalPricePoint(price_cents=s.price_cents, collected_at=s.collected_at.isoformat())
            for s in snapshots
        ]
