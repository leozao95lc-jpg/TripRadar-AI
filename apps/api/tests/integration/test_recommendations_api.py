from modules.price_monitoring.application.use_cases import PollRoutePrice, RouteQuery
from modules.price_monitoring.infrastructure.repository import SqlAlchemyPriceSnapshotRepository
from modules.providers.infrastructure.mock_provider import MockFlightProvider


def _register_and_login(client, email="score-user@example.com"):
    client.post(
        "/api/v1/auth/register", json={"email": email, "password": "supersecret", "full_name": "Score User"}
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "supersecret"})
    return login.json()["access_token"]


def test_get_recommendation_for_alert(client, db_session):
    token = _register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    create_alert = client.post(
        "/api/v1/alerts",
        headers=headers,
        json={
            "origin_iata": "FLN",
            "destination_iata": "MAD",
            "trip_type": "round_trip",
            "departure_date": "2026-11-10",
            "return_date": "2026-11-24",
            "max_price_cents": 999_999_999,
            "cabin_class": "economy",
        },
    )
    alert_id = create_alert.json()["id"]

    poll = PollRoutePrice(MockFlightProvider(), SqlAlchemyPriceSnapshotRepository(db_session))
    poll.execute(RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy"), source_provider="mock")
    db_session.commit()

    response = client.get(f"/api/v1/alerts/{alert_id}/recommendation", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["origin_iata"] == "FLN"
    assert body["verdict"] in {"buy", "wait", "insufficient_data"}
    assert "explanation" in body
    assert "hit_rate" in body["factors"]


def test_recommendation_returns_404_when_no_price_data(client):
    token = _register_and_login(client, email="no-data@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_alert = client.post(
        "/api/v1/alerts",
        headers=headers,
        json={
            "origin_iata": "GRU",
            "destination_iata": "JFK",
            "trip_type": "round_trip",
            "departure_date": "2026-09-20",
            "return_date": "2026-10-04",
            "max_price_cents": 300_000,
            "cabin_class": "economy",
        },
    )
    alert_id = create_alert.json()["id"]

    response = client.get(f"/api/v1/alerts/{alert_id}/recommendation", headers=headers)
    assert response.status_code == 404


def test_recommendation_requires_ownership(client):
    token_a = _register_and_login(client, email="owner@example.com")
    token_b = _register_and_login(client, email="other@example.com")

    create_alert = client.post(
        "/api/v1/alerts",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "origin_iata": "FLN",
            "destination_iata": "MAD",
            "trip_type": "round_trip",
            "departure_date": "2026-11-10",
            "max_price_cents": 300_000,
            "cabin_class": "economy",
        },
    )
    alert_id = create_alert.json()["id"]

    response = client.get(
        f"/api/v1/alerts/{alert_id}/recommendation", headers={"Authorization": f"Bearer {token_b}"}
    )
    assert response.status_code == 404
