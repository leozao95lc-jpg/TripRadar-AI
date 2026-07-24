def _register_and_login(client, email="alerts-user@example.com"):
    client.post(
        "/api/v1/auth/register", json={"email": email, "password": "supersecret", "full_name": "Alerts User"}
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "supersecret"})
    return login.json()["access_token"]


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _alert_payload(**overrides) -> dict:
    payload = {
        "origin_iata": "FLN",
        "destination_iata": "MAD",
        "trip_type": "round_trip",
        "departure_date": "2026-11-10",
        "return_date": "2026-11-24",
        "max_price_cents": 300_000,
        "cabin_class": "economy",
    }
    payload.update(overrides)
    return payload


def test_create_and_list_alert(client):
    token = _register_and_login(client)

    create_response = client.post("/api/v1/alerts", headers=_auth_header(token), json=_alert_payload())
    assert create_response.status_code == 201
    body = create_response.json()
    assert body["origin_iata"] == "FLN"
    assert body["status"] == "active"

    list_response = client.get("/api/v1/alerts", headers=_auth_header(token))
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_free_plan_rejects_fourth_active_alert(client):
    token = _register_and_login(client, email="limit@example.com")

    for _ in range(3):
        response = client.post("/api/v1/alerts", headers=_auth_header(token), json=_alert_payload())
        assert response.status_code == 201

    fourth = client.post("/api/v1/alerts", headers=_auth_header(token), json=_alert_payload())
    assert fourth.status_code == 403


def test_delete_alert_removes_it(client):
    token = _register_and_login(client, email="delete@example.com")
    created = client.post("/api/v1/alerts", headers=_auth_header(token), json=_alert_payload())
    alert_id = created.json()["id"]

    delete_response = client.delete(f"/api/v1/alerts/{alert_id}", headers=_auth_header(token))
    assert delete_response.status_code == 204

    list_response = client.get("/api/v1/alerts", headers=_auth_header(token))
    assert list_response.json() == []


def test_create_alert_requires_authentication(client):
    response = client.post("/api/v1/alerts", json=_alert_payload())
    assert response.status_code == 401
