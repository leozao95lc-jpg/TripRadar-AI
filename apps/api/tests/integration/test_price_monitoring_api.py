from modules.price_monitoring.application.use_cases import PollRoutePrice, RouteQuery
from modules.price_monitoring.infrastructure.repository import SqlAlchemyPriceSnapshotRepository
from modules.providers.infrastructure.mock_provider import MockFlightProvider


def test_route_history_endpoint_returns_collected_snapshots(client, db_session):
    poll = PollRoutePrice(MockFlightProvider(), SqlAlchemyPriceSnapshotRepository(db_session))
    poll.execute(RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy"), source_provider="mock")
    db_session.commit()

    response = client.get("/api/v1/routes/FLN/MAD/history", params={"cabin_class": "economy"})

    assert response.status_code == 200
    body = response.json()
    assert body["origin_iata"] == "FLN"
    assert body["destination_iata"] == "MAD"
    assert len(body["snapshots"]) == 1
    assert body["min_price_cents"] == body["snapshots"][0]["price_cents"]


def test_route_history_endpoint_returns_empty_for_unknown_route(client):
    response = client.get("/api/v1/routes/XXX/YYY/history")

    assert response.status_code == 200
    body = response.json()
    assert body["snapshots"] == []
    assert body["min_price_cents"] is None
