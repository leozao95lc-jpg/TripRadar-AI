from datetime import date
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.alerts.application.ports import AlertRepository, AlertTriggerRepository
from modules.alerts.domain.entities import AlertStatus, AlertTrigger, CabinClass, SearchAlert, TripType
from modules.alerts.infrastructure.models import AlertTriggerModel, SearchAlertModel


def _to_domain(row: SearchAlertModel) -> SearchAlert:
    return SearchAlert(
        id=UUID(str(row.id)),
        user_id=UUID(str(row.user_id)),
        origin_iata=row.origin_iata,
        destination_iata=row.destination_iata,
        trip_type=TripType(row.trip_type),
        departure_date=row.departure_date.isoformat(),
        max_price_cents=row.max_price_cents,
        return_date=row.return_date.isoformat() if row.return_date else None,
        flexible_dates=row.flexible_dates,
        currency=row.currency,
        cabin_class=CabinClass(row.cabin_class),
        passengers=row.passengers,
        max_stops=row.max_stops,
        alternative_airports_ok=row.alternative_airports_ok,
        status=AlertStatus(row.status),
        created_at=row.created_at,
    )


def _trigger_to_domain(row: AlertTriggerModel) -> AlertTrigger:
    return AlertTrigger(
        id=UUID(str(row.id)),
        alert_id=UUID(str(row.alert_id)),
        price_snapshot_id=UUID(str(row.price_snapshot_id)),
        price_at_trigger_cents=row.price_at_trigger_cents,
        reason=row.reason,
        triggered_at=row.triggered_at,
    )


class SqlAlchemyAlertRepository(AlertRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, alert: SearchAlert) -> None:
        self._session.add(
            SearchAlertModel(
                id=str(alert.id),
                user_id=str(alert.user_id),
                origin_iata=alert.origin_iata,
                destination_iata=alert.destination_iata,
                trip_type=alert.trip_type.value,
                departure_date=date.fromisoformat(alert.departure_date),
                return_date=date.fromisoformat(alert.return_date) if alert.return_date else None,
                flexible_dates=alert.flexible_dates,
                max_price_cents=alert.max_price_cents,
                currency=alert.currency,
                cabin_class=alert.cabin_class.value,
                passengers=alert.passengers,
                max_stops=alert.max_stops,
                alternative_airports_ok=alert.alternative_airports_ok,
                status=alert.status.value,
                created_at=alert.created_at,
            )
        )
        self._session.flush()

    def get_by_id(self, alert_id: UUID) -> SearchAlert | None:
        row = self._session.get(SearchAlertModel, str(alert_id))
        return _to_domain(row) if row else None

    def list_by_user(self, user_id: UUID) -> list[SearchAlert]:
        rows = (
            self._session.execute(select(SearchAlertModel).where(SearchAlertModel.user_id == str(user_id)))
            .scalars()
            .all()
        )
        return [_to_domain(row) for row in rows]

    def count_active_by_user(self, user_id: UUID) -> int:
        return (
            self._session.execute(
                select(func.count())
                .select_from(SearchAlertModel)
                .where(
                    SearchAlertModel.user_id == str(user_id),
                    SearchAlertModel.status == AlertStatus.ACTIVE.value,
                )
            ).scalar_one()
        )

    def delete(self, alert_id: UUID) -> None:
        row = self._session.get(SearchAlertModel, str(alert_id))
        if row is not None:
            self._session.delete(row)
            self._session.flush()

    def list_active_matching_route(
        self, origin_iata: str, destination_iata: str, cabin_class: str, departure_date: str
    ) -> list[SearchAlert]:
        rows = (
            self._session.execute(
                select(SearchAlertModel).where(
                    SearchAlertModel.origin_iata == origin_iata,
                    SearchAlertModel.destination_iata == destination_iata,
                    SearchAlertModel.cabin_class == cabin_class,
                    SearchAlertModel.status == AlertStatus.ACTIVE.value,
                    or_(
                        SearchAlertModel.flexible_dates.is_(True),
                        SearchAlertModel.departure_date == date.fromisoformat(departure_date),
                    ),
                )
            )
            .scalars()
            .all()
        )
        return [_to_domain(row) for row in rows]

    def list_distinct_active_routes(self) -> list[SearchAlert]:
        # DISTINCT ON é específico do Postgres; deduplicamos em Python para continuar
        # portátil (testes rodam em SQLite) — volume de alertas ativos é baixo o
        # suficiente no MVP para isso não ser um problema de performance.
        rows = (
            self._session.execute(
                select(SearchAlertModel).where(SearchAlertModel.status == AlertStatus.ACTIVE.value)
            )
            .scalars()
            .all()
        )
        seen: set[tuple[str, str, str, str]] = set()
        unique: list[SearchAlert] = []
        for row in rows:
            key = (row.origin_iata, row.destination_iata, row.cabin_class, row.departure_date.isoformat())
            if key in seen:
                continue
            seen.add(key)
            unique.append(_to_domain(row))
        return unique


class SqlAlchemyAlertTriggerRepository(AlertTriggerRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, trigger: AlertTrigger) -> None:
        self._session.add(
            AlertTriggerModel(
                id=str(trigger.id),
                alert_id=str(trigger.alert_id),
                price_snapshot_id=str(trigger.price_snapshot_id),
                price_at_trigger_cents=trigger.price_at_trigger_cents,
                reason=trigger.reason,
                triggered_at=trigger.triggered_at,
            )
        )
        self._session.flush()

    def list_by_alert(self, alert_id: UUID) -> list[AlertTrigger]:
        rows = (
            self._session.execute(
                select(AlertTriggerModel).where(AlertTriggerModel.alert_id == str(alert_id))
            )
            .scalars()
            .all()
        )
        return [_trigger_to_domain(row) for row in rows]


class InMemoryAlertRepository(AlertRepository):
    """Usada em testes de unidade dos casos de uso, sem tocar banco."""

    def __init__(self) -> None:
        self._alerts: dict[UUID, SearchAlert] = {}

    def add(self, alert: SearchAlert) -> None:
        self._alerts[alert.id] = alert

    def get_by_id(self, alert_id: UUID) -> SearchAlert | None:
        return self._alerts.get(alert_id)

    def list_by_user(self, user_id: UUID) -> list[SearchAlert]:
        return [a for a in self._alerts.values() if a.user_id == user_id]

    def count_active_by_user(self, user_id: UUID) -> int:
        return sum(
            1 for a in self._alerts.values() if a.user_id == user_id and a.status == AlertStatus.ACTIVE
        )

    def delete(self, alert_id: UUID) -> None:
        self._alerts.pop(alert_id, None)

    def list_active_matching_route(
        self, origin_iata: str, destination_iata: str, cabin_class: str, departure_date: str
    ) -> list[SearchAlert]:
        return [
            a
            for a in self._alerts.values()
            if a.origin_iata == origin_iata
            and a.destination_iata == destination_iata
            and a.cabin_class.value == cabin_class
            and a.status == AlertStatus.ACTIVE
            and (a.flexible_dates or a.departure_date == departure_date)
        ]

    def list_distinct_active_routes(self) -> list[SearchAlert]:
        return [a for a in self._alerts.values() if a.status == AlertStatus.ACTIVE]


class InMemoryAlertTriggerRepository(AlertTriggerRepository):
    def __init__(self) -> None:
        self._triggers: list[AlertTrigger] = []

    def add(self, trigger: AlertTrigger) -> None:
        self._triggers.append(trigger)

    def list_by_alert(self, alert_id: UUID) -> list[AlertTrigger]:
        return [t for t in self._triggers if t.alert_id == alert_id]
