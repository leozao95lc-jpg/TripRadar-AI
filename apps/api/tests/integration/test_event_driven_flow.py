"""Valida a cadeia completa orientada a eventos ponta a ponta, contra um banco real
(SQLite em arquivo, não em memória — precisa de visibilidade entre sessões, como no
Postgres de produção): registro cria preferência de e-mail; um preço coletado avalia
alertas ativos da rota; um alerta disparado despacha notificação.

Diferente dos demais testes de integração, este NÃO usa a fixture `client` (que aponta
`get_db` para um banco SQLite isolado em memória) — ele aponta o engine/SessionLocal
GLOBAIS (usados tanto pela API quanto pelos handlers em `bootstrap.py`) para o mesmo
arquivo, replicando como o sistema roda de verdade (um único banco para todo mundo).
"""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import shared.database as database
from main import app
from modules.alerts.infrastructure.models import AlertTriggerModel
from modules.notifications.infrastructure.models import NotificationModel
from modules.price_monitoring.application.use_cases import PollRoutePrice, RouteQuery
from modules.price_monitoring.infrastructure.repository import SqlAlchemyPriceSnapshotRepository
from modules.providers.infrastructure.mock_provider import MockFlightProvider
from shared.events import event_bus


def test_full_event_driven_flow(tmp_path, monkeypatch):
    db_path = tmp_path / "event_flow.db"
    # `timeout` (busy timeout do SQLite) evita "database is locked": o handler de evento
    # abre uma segunda conexão para o mesmo arquivo enquanto a transação da requisição
    # HTTP ainda está aberta — no Postgres de produção isso não seria um problema
    # (locking por linha/tabela, não o arquivo inteiro).
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"timeout": 15})
    database.Base.metadata.create_all(engine)
    test_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", test_session_local)
    app.dependency_overrides.clear()

    with TestClient(app) as client:
        register = client.post(
            "/api/v1/auth/register",
            json={"email": "flow@example.com", "password": "supersecret", "full_name": "Flow"},
        )
        assert register.status_code == 201

        login = client.post(
            "/api/v1/auth/login", json={"email": "flow@example.com", "password": "supersecret"}
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        prefs = client.get("/api/v1/notifications/preferences", headers=headers)
        assert any(p["channel"] == "email" and p["destination"] == "flow@example.com" for p in prefs.json())

        create_alert = client.post(
            "/api/v1/alerts",
            headers=headers,
            json={
                "origin_iata": "FLN",
                "destination_iata": "MAD",
                "trip_type": "round_trip",
                "departure_date": "2026-11-10",
                "return_date": "2026-11-24",
                "max_price_cents": 999_999_999,  # qualquer preço do mock dispara
                "cabin_class": "economy",
            },
        )
        assert create_alert.status_code == 201

        with database.session_scope() as session:
            poll = PollRoutePrice(MockFlightProvider(), SqlAlchemyPriceSnapshotRepository(session))
            poll.execute(
                RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy"), source_provider="mock"
            )
            event_bus.dispatch(poll.pending_events, session)

        history = client.get("/api/v1/routes/FLN/MAD/history", params={"cabin_class": "economy"})
        assert len(history.json()["snapshots"]) == 1

        session = test_session_local()
        try:
            triggers = session.query(AlertTriggerModel).all()
            notifications = session.query(NotificationModel).all()
        finally:
            session.close()

        assert len(triggers) == 1
        assert len(notifications) >= 1

    app.dependency_overrides.clear()
