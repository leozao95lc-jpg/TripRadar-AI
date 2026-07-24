"""Regressão do achado #3 de docs/09-revisao-tecnica-backend.md: o worker rodava o
lote inteiro numa única transação, então uma falha em qualquer evento disparado por
uma rota revertia os snapshots já coletados de TODAS as outras rotas do lote. Este
teste prova que, com uma transação por rota, uma falha isolada não derruba o resto.
"""

import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_WORKERS_DIR = Path(__file__).resolve().parents[2] / "workers"
if str(_WORKERS_DIR) not in sys.path:
    sys.path.insert(0, str(_WORKERS_DIR))

import price_polling_worker  # noqa: E402

import shared.database as database  # noqa: E402
from modules.price_monitoring.application.use_cases import RouteQuery  # noqa: E402
from modules.price_monitoring.infrastructure.models import PriceSnapshotModel  # noqa: E402
from modules.providers.application.ports import FlightSearchProvider  # noqa: E402
from modules.providers.domain.entities import FlightOffer  # noqa: E402


class FlakyProvider(FlightSearchProvider):
    """Provedor de teste que falha deliberadamente na N-ésima chamada, simulando um
    erro em algum ponto da cadeia de eventos disparada por aquela rota (avaliação de
    alerta, despacho de notificação etc.) sem precisar mockar o event bus inteiro."""

    def __init__(self, fail_on_call: int) -> None:
        self._fail_on_call = fail_on_call
        self._calls = 0

    def search(self, *, origin_iata, destination_iata, departure_date, return_date, cabin_class, passengers):
        self._calls += 1
        if self._calls == self._fail_on_call:
            raise RuntimeError("falha simulada")
        return [
            FlightOffer(
                origin_iata=origin_iata,
                destination_iata=destination_iata,
                departure_date=departure_date,
                return_date=return_date,
                cabin_class=cabin_class,
                price_cents=300_000,
                currency="BRL",
                airline_iata="LA",
                stops=0,
            )
        ]


def test_a_failing_route_does_not_roll_back_previously_collected_snapshots(tmp_path, monkeypatch):
    db_path = tmp_path / "worker_isolation.db"
    engine = create_engine(f"sqlite:///{db_path}")
    database.Base.metadata.create_all(engine)
    test_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", test_session_local)

    routes = [
        RouteQuery("AAA", "BBB", "2026-11-10", None, "economy"),
        RouteQuery("CCC", "DDD", "2026-11-10", None, "economy"),
        RouteQuery("EEE", "FFF", "2026-11-10", None, "economy"),
    ]
    monkeypatch.setattr(price_polling_worker, "_load_routes", lambda db: routes)
    monkeypatch.setattr(price_polling_worker, "build_provider", lambda: FlakyProvider(fail_on_call=2))

    price_polling_worker.run()

    session = test_session_local()
    try:
        snapshots = session.query(PriceSnapshotModel).all()
    finally:
        session.close()

    # A 2ª rota falhou (fail_on_call=2); a 1ª e a 3ª, coletadas com sucesso, continuam
    # persistidas — não foram arrastadas pelo rollback da 2ª.
    assert {s.origin_iata for s in snapshots} == {"AAA", "EEE"}
    assert len(snapshots) == 2
