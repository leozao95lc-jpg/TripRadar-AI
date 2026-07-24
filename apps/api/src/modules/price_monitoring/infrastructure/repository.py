from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.price_monitoring.application.ports import PriceSnapshotRepository
from modules.price_monitoring.domain.entities import PriceSnapshot
from modules.price_monitoring.infrastructure.models import PriceSnapshotModel


def _to_domain(row: PriceSnapshotModel) -> PriceSnapshot:
    return PriceSnapshot(
        id=UUID(str(row.id)),
        origin_iata=row.origin_iata,
        destination_iata=row.destination_iata,
        departure_date=row.departure_date.isoformat(),
        return_date=row.return_date.isoformat() if row.return_date else None,
        price_cents=row.price_cents,
        currency=row.currency,
        cabin_class=row.cabin_class,
        airline_iata=row.airline_iata,
        source_provider=row.source_provider,
        collected_at=row.collected_at,
    )


class SqlAlchemyPriceSnapshotRepository(PriceSnapshotRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, snapshot: PriceSnapshot) -> None:
        self._session.add(
            PriceSnapshotModel(
                id=str(snapshot.id),
                origin_iata=snapshot.origin_iata,
                destination_iata=snapshot.destination_iata,
                departure_date=date.fromisoformat(snapshot.departure_date),
                return_date=date.fromisoformat(snapshot.return_date) if snapshot.return_date else None,
                cabin_class=snapshot.cabin_class,
                price_cents=snapshot.price_cents,
                currency=snapshot.currency,
                airline_iata=snapshot.airline_iata,
                source_provider=snapshot.source_provider,
                collected_at=snapshot.collected_at,
            )
        )
        self._session.flush()

    def history(
        self, origin_iata: str, destination_iata: str, cabin_class: str, since: date
    ) -> list[PriceSnapshot]:
        since_dt = datetime.combine(since, datetime.min.time(), tzinfo=UTC)
        rows = (
            self._session.execute(
                select(PriceSnapshotModel).where(
                    PriceSnapshotModel.origin_iata == origin_iata,
                    PriceSnapshotModel.destination_iata == destination_iata,
                    PriceSnapshotModel.cabin_class == cabin_class,
                    PriceSnapshotModel.collected_at >= since_dt,
                )
            )
            .scalars()
            .all()
        )
        return [_to_domain(row) for row in rows]

    def count_since(self, since: datetime) -> int:
        return self._session.execute(
            select(func.count())
            .select_from(PriceSnapshotModel)
            .where(PriceSnapshotModel.collected_at >= since)
        ).scalar_one()


class InMemoryPriceSnapshotRepository(PriceSnapshotRepository):
    """Usada em testes de unidade do motor de monitoramento, sem tocar banco."""

    def __init__(self) -> None:
        self._snapshots: list[PriceSnapshot] = []

    def add(self, snapshot: PriceSnapshot) -> None:
        self._snapshots.append(snapshot)

    def history(
        self, origin_iata: str, destination_iata: str, cabin_class: str, since: date
    ) -> list[PriceSnapshot]:
        since_dt = datetime.combine(since, datetime.min.time(), tzinfo=UTC)
        return [
            s
            for s in self._snapshots
            if s.origin_iata == origin_iata
            and s.destination_iata == destination_iata
            and s.cabin_class == cabin_class
            and s.collected_at >= since_dt
        ]

    def count_since(self, since: datetime) -> int:
        return sum(1 for s in self._snapshots if s.collected_at >= since)
