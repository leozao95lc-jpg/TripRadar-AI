"""Composition root: liga os módulos entre si só por evento de domínio, nunca por
import direto. Cada processo (API, cada worker) chama `register_event_handlers()`
uma única vez no startup.

Fluxo ponta a ponta que essa fiação implementa:
    identity.user_registered
        -> notifications cria a preferência de e-mail padrão
    price_monitoring.price_snapshot_collected
        -> alerts avalia se algum alerta ativo da rota deve disparar
    alerts.alert_triggered
        -> notifications envia por e-mail/WhatsApp e registra o resultado

Nenhum desses três módulos importa o outro diretamente — só o shared.events.event_bus
e, aqui, os casos de uso/repositórios concretos de cada lado.

Cada handler recebe a sessão de banco da unidade de trabalho corrente como parâmetro
explícito (passada por quem chama `event_bus.dispatch(eventos, session)` — a rota HTTP
ou o worker) e pode devolver novos eventos, que entram na mesma fila/transação. Nada
de estado ambiente: sem contextvars, sem threadlocals, sem uma segunda conexão
disputando a mesma transação ainda aberta (ver docs/03-arquitetura.md, seção 4.2).
"""

from uuid import UUID

from modules.alerts.application.use_cases import ALERT_TRIGGERED, EvaluateAlertsForRoute
from modules.alerts.infrastructure.repository import (
    SqlAlchemyAlertRepository,
    SqlAlchemyAlertTriggerRepository,
)
from modules.identity.application.use_cases import USER_REGISTERED
from modules.notifications.application.use_cases import (
    CreateDefaultEmailPreference,
    DispatchAlertNotification,
)
from modules.notifications.infrastructure.email_channel import EmailNotificationSender
from modules.notifications.infrastructure.repository import (
    SqlAlchemyNotificationPreferenceRepository,
    SqlAlchemyNotificationRepository,
)
from modules.notifications.infrastructure.whatsapp_channel import WhatsAppNotificationSender
from modules.price_monitoring.application.use_cases import PRICE_SNAPSHOT_COLLECTED
from shared.events import DomainEvent, event_bus
from shared.logging import get_logger

logger = get_logger(__name__)

_registered = False


def _on_user_registered(event: DomainEvent, session) -> list[DomainEvent] | None:
    CreateDefaultEmailPreference(SqlAlchemyNotificationPreferenceRepository(session)).execute(
        UUID(event.payload["user_id"]), event.payload["email"]
    )
    return None


def _on_price_snapshot_collected(event: DomainEvent, session) -> list[DomainEvent] | None:
    payload = event.payload
    use_case = EvaluateAlertsForRoute(
        SqlAlchemyAlertRepository(session), SqlAlchemyAlertTriggerRepository(session)
    )
    use_case.execute(
        origin_iata=payload["origin_iata"],
        destination_iata=payload["destination_iata"],
        cabin_class=payload["cabin_class"],
        departure_date=payload["departure_date"],
        price_cents=payload["price_cents"],
        currency=payload["currency"],
        price_snapshot_id=UUID(payload["price_snapshot_id"]),
    )
    return use_case.pending_events


def _on_alert_triggered(event: DomainEvent, session) -> list[DomainEvent] | None:
    payload = event.payload
    subject = f"TripRadar: {payload['origin_iata']} -> {payload['destination_iata']} caiu de preço"
    message = (
        f"O preço atual é R$ {payload['price_at_trigger_cents'] / 100:.2f}, abaixo do "
        f"seu alvo de R$ {payload['max_price_cents'] / 100:.2f}."
    )
    senders = {"email": EmailNotificationSender(), "whatsapp": WhatsAppNotificationSender()}
    DispatchAlertNotification(
        SqlAlchemyNotificationPreferenceRepository(session),
        SqlAlchemyNotificationRepository(session),
        senders,
    ).execute(
        user_id=UUID(payload["user_id"]),
        alert_trigger_id=UUID(payload["alert_trigger_id"]),
        subject=subject,
        message=message,
    )
    return None


def register_event_handlers() -> None:
    global _registered
    if _registered:
        return

    event_bus.subscribe(USER_REGISTERED, _on_user_registered)
    event_bus.subscribe(PRICE_SNAPSHOT_COLLECTED, _on_price_snapshot_collected)
    event_bus.subscribe(ALERT_TRIGGERED, _on_alert_triggered)
    _registered = True
    logger.info("event_handlers_registered")
