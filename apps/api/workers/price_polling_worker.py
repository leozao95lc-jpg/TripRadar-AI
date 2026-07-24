"""Worker standalone do motor de monitoramento de preços — roda desacoplado da API web.

Uso:
    PYTHONPATH=src python workers/price_polling_worker.py

Poll-a as rotas distintas dos alertas ativos no banco (módulo `alerts`); se não houver
nenhum alerta ainda (banco novo), cai de volta em `SEED_ROUTES` só para o motor ter
o que monitorar. O motor de monitoramento em si (`PollRoutePrice`, em
`modules/price_monitoring/application/use_cases.py`) não muda quando a origem das
rotas muda — é exatamente esse desacoplamento entre "o que monitorar" e "como
monitorar" que evita um refactor quando o produto evolui.

Em produção, este script é o entry point de um job agendado (AWS EventBridge -> ECS
Task / Lambda), não de um processo de longa duração.
"""

import sys
from pathlib import Path

_SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from bootstrap import register_event_handlers  # noqa: E402
from modules.alerts.infrastructure.repository import SqlAlchemyAlertRepository  # noqa: E402
from modules.price_monitoring.application.use_cases import PollRoutePrice, RouteQuery  # noqa: E402
from modules.price_monitoring.infrastructure.repository import (  # noqa: E402
    SqlAlchemyPriceSnapshotRepository,
)
from modules.providers.infrastructure.mock_provider import MockFlightProvider  # noqa: E402
from shared.config import settings  # noqa: E402
from shared.database import session_scope  # noqa: E402
from shared.events import event_bus  # noqa: E402
from shared.logging import configure_logging, get_logger  # noqa: E402

configure_logging(settings.environment, settings.log_level)
logger = get_logger(__name__)

# Rotas populares Brasil <-> exterior usadas como semente até existir algum alerta ativo.
SEED_ROUTES: list[RouteQuery] = [
    RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy"),
    RouteQuery("GRU", "LIS", "2026-10-05", "2026-10-19", "economy"),
    RouteQuery("GIG", "MCO", "2026-12-15", "2026-12-29", "economy"),
    RouteQuery("GRU", "JFK", "2026-09-20", "2026-10-04", "economy"),
    RouteQuery("CNF", "LIS", "2026-11-01", "2026-11-15", "economy"),
]


def build_provider():
    if settings.flight_provider == "amadeus":
        from modules.providers.infrastructure.amadeus_provider import AmadeusFlightProvider

        return AmadeusFlightProvider()
    return MockFlightProvider()


def _load_routes(db) -> list[RouteQuery]:
    active_alerts = SqlAlchemyAlertRepository(db).list_distinct_active_routes()
    if not active_alerts:
        return SEED_ROUTES
    return [
        RouteQuery(
            origin_iata=alert.origin_iata,
            destination_iata=alert.destination_iata,
            departure_date=alert.departure_date,
            return_date=alert.return_date,
            cabin_class=alert.cabin_class.value,
        )
        for alert in active_alerts
    ]


def run() -> None:
    register_event_handlers()
    provider = build_provider()
    with session_scope() as db:
        routes = _load_routes(db)
        use_case = PollRoutePrice(provider, SqlAlchemyPriceSnapshotRepository(db))
        for route in routes:
            snapshots = use_case.execute(route, source_provider=settings.flight_provider)
            for snapshot in snapshots:
                logger.info(
                    "price_snapshot_collected",
                    route=f"{route.origin_iata}-{route.destination_iata}",
                    price_cents=snapshot.price_cents,
                    currency=snapshot.currency,
                )
            event_bus.dispatch(use_case.pending_events, db)
        logger.info("price_polling_run_completed", routes_polled=len(routes))


if __name__ == "__main__":
    run()
