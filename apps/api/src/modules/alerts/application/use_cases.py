from dataclasses import dataclass
from uuid import UUID

from modules.alerts.application.ports import AlertRepository, AlertTriggerRepository, UserPlanPort
from modules.alerts.domain.entities import AlertTrigger, CabinClass, SearchAlert, TripType
from shared.events import DomainEvent

ALERT_TRIGGERED = "alert_triggered"
ALERT_CREATED = "alert_created"


class AlertLimitReachedError(Exception):
    pass


class AlertNotFoundError(Exception):
    pass


class AlertNotOwnedByUserError(Exception):
    pass


@dataclass
class CreateAlertInput:
    user_id: UUID
    origin_iata: str
    destination_iata: str
    trip_type: str
    departure_date: str
    max_price_cents: int
    return_date: str | None = None
    flexible_dates: bool = False
    currency: str = "BRL"
    cabin_class: str = "economy"
    passengers: int = 1
    max_stops: int | None = None
    alternative_airports_ok: bool = False


class CreateAlert:
    """Aplica a regra de negócio do plano Gratuito (até 3 alertas ativos) antes de criar.
    Acumula `alert_created` em `pending_events` — hoje só o módulo `analytics` reage
    a ele (ver `bootstrap.py`), mas a rota HTTP já despacha, então qualquer novo
    assinante futuro não exige mudar nada aqui nem em `alerts/interface/routes.py`."""

    def __init__(self, alerts: AlertRepository, plan: UserPlanPort) -> None:
        self._alerts = alerts
        self._plan = plan
        self.pending_events: list[DomainEvent] = []

    def execute(self, data: CreateAlertInput) -> SearchAlert:
        self.pending_events = []
        max_alerts = self._plan.get_max_active_alerts(data.user_id)
        if max_alerts is not None and self._alerts.count_active_by_user(data.user_id) >= max_alerts:
            raise AlertLimitReachedError(
                f"Limite de {max_alerts} alertas ativos atingido para o plano atual"
            )

        alert = SearchAlert(
            user_id=data.user_id,
            origin_iata=data.origin_iata.upper(),
            destination_iata=data.destination_iata.upper(),
            trip_type=TripType(data.trip_type),
            departure_date=data.departure_date,
            max_price_cents=data.max_price_cents,
            return_date=data.return_date,
            flexible_dates=data.flexible_dates,
            currency=data.currency,
            cabin_class=CabinClass(data.cabin_class),
            passengers=data.passengers,
            max_stops=data.max_stops,
            alternative_airports_ok=data.alternative_airports_ok,
        )
        self._alerts.add(alert)
        self.pending_events.append(
            DomainEvent(
                name=ALERT_CREATED,
                payload={
                    "alert_id": str(alert.id),
                    "user_id": str(alert.user_id),
                    "origin_iata": alert.origin_iata,
                    "destination_iata": alert.destination_iata,
                },
            )
        )
        return alert


class ListUserAlerts:
    def __init__(self, alerts: AlertRepository) -> None:
        self._alerts = alerts

    def execute(self, user_id: UUID) -> list[SearchAlert]:
        return self._alerts.list_by_user(user_id)


class DeleteAlert:
    def __init__(self, alerts: AlertRepository) -> None:
        self._alerts = alerts

    def execute(self, alert_id: UUID, user_id: UUID) -> None:
        alert = self._alerts.get_by_id(alert_id)
        if alert is None:
            raise AlertNotFoundError(str(alert_id))
        if alert.user_id != user_id:
            raise AlertNotOwnedByUserError(str(alert_id))
        self._alerts.delete(alert_id)


class EvaluateAlertsForRoute:
    """Chamado a cada `price_snapshot_collected`: verifica se algum alerta ativo daquela
    rota deve disparar, registra o gatilho e acumula `alert_triggered` em
    `pending_events` para o módulo `notifications` reagir — `alerts` nunca importa
    `notifications` diretamente, a comunicação é só por evento."""

    def __init__(self, alerts: AlertRepository, triggers: AlertTriggerRepository) -> None:
        self._alerts = alerts
        self._triggers = triggers
        self.pending_events: list[DomainEvent] = []

    def execute(
        self,
        *,
        origin_iata: str,
        destination_iata: str,
        cabin_class: str,
        departure_date: str,
        price_cents: int,
        currency: str,
        price_snapshot_id: UUID,
    ) -> list[AlertTrigger]:
        self.pending_events = []
        matching = self._alerts.list_active_matching_route(
            origin_iata, destination_iata, cabin_class, departure_date
        )
        fired: list[AlertTrigger] = []
        for alert in matching:
            if price_cents > alert.max_price_cents:
                continue
            trigger = AlertTrigger(
                alert_id=alert.id,
                price_snapshot_id=price_snapshot_id,
                price_at_trigger_cents=price_cents,
                reason=(
                    f"Preço de R$ {price_cents / 100:.2f} atingiu o alvo de "
                    f"R$ {alert.max_price_cents / 100:.2f}"
                ),
            )
            self._triggers.add(trigger)
            fired.append(trigger)
            self.pending_events.append(
                DomainEvent(
                    name=ALERT_TRIGGERED,
                    payload={
                        "alert_id": str(alert.id),
                        "alert_trigger_id": str(trigger.id),
                        "user_id": str(alert.user_id),
                        "origin_iata": alert.origin_iata,
                        "destination_iata": alert.destination_iata,
                        "price_at_trigger_cents": price_cents,
                        "max_price_cents": alert.max_price_cents,
                        "currency": currency,
                    },
                )
            )
        return fired
