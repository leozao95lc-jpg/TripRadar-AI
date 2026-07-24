from dataclasses import dataclass
from datetime import date, timedelta

from modules.price_monitoring.application.ports import PriceSnapshotRepository
from modules.price_monitoring.domain.entities import PriceSnapshot
from modules.providers.application.ports import FlightSearchProvider
from shared.events import DomainEvent, event_bus

PRICE_SNAPSHOT_COLLECTED = "price_snapshot_collected"


@dataclass(frozen=True)
class RouteQuery:
    origin_iata: str
    destination_iata: str
    departure_date: str
    return_date: str | None
    cabin_class: str
    passengers: int = 1


class PollRoutePrice:
    """Caso de uso central do motor de monitoramento: busca o preço atual de uma rota no
    provedor configurado e persiste um snapshot. Publica `price_snapshot_collected` para
    que outros módulos (recommendations, alerts) reajam sem acoplamento direto — é essa
    publicação de evento, não uma chamada direta, que conecta o motor ao resto do sistema.

    Roda tanto a partir da API (uso administrativo) quanto de um worker standalone
    (`workers/price_polling_worker.py`), sem nenhuma dependência de FastAPI ou HTTP.
    """

    def __init__(self, provider: FlightSearchProvider, snapshots: PriceSnapshotRepository) -> None:
        self._provider = provider
        self._snapshots = snapshots

    def execute(self, query: RouteQuery, source_provider: str) -> list[PriceSnapshot]:
        offers = self._provider.search(
            origin_iata=query.origin_iata,
            destination_iata=query.destination_iata,
            departure_date=query.departure_date,
            return_date=query.return_date,
            cabin_class=query.cabin_class,
            passengers=query.passengers,
        )

        saved: list[PriceSnapshot] = []
        for offer in offers:
            snapshot = PriceSnapshot(
                origin_iata=offer.origin_iata,
                destination_iata=offer.destination_iata,
                departure_date=offer.departure_date,
                return_date=offer.return_date,
                price_cents=offer.price_cents,
                currency=offer.currency,
                cabin_class=offer.cabin_class,
                airline_iata=offer.airline_iata,
                source_provider=source_provider,
            )
            self._snapshots.add(snapshot)
            saved.append(snapshot)
            event_bus.publish(
                DomainEvent(
                    name=PRICE_SNAPSHOT_COLLECTED,
                    payload={
                        "origin_iata": snapshot.origin_iata,
                        "destination_iata": snapshot.destination_iata,
                        "departure_date": snapshot.departure_date,
                        "cabin_class": snapshot.cabin_class,
                        "price_cents": snapshot.price_cents,
                        "currency": snapshot.currency,
                    },
                )
            )
        return saved


class GetPriceHistory:
    def __init__(self, snapshots: PriceSnapshotRepository) -> None:
        self._snapshots = snapshots

    def execute(
        self, origin_iata: str, destination_iata: str, cabin_class: str, range_days: int
    ) -> list[PriceSnapshot]:
        since = date.today() - timedelta(days=range_days)
        history = self._snapshots.history(origin_iata, destination_iata, cabin_class, since)
        return sorted(history, key=lambda s: s.collected_at)
