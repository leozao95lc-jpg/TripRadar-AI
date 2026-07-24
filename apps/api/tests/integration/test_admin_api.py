from modules.identity.infrastructure.models import UserModel


def _register_and_login(client, email="user@example.com", password="supersecret", full_name="User"):
    client.post("/api/v1/auth/register", json={"email": email, "password": password, "full_name": full_name})
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return login.json()["access_token"]


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _promote_to_admin(db_session, email: str) -> None:
    # Não existe endpoint para virar admin (por desenho — não deveria existir um).
    # Em teste, promovemos direto no banco, o mesmo `role` que já existe em `User`
    # desde a Fase 1.
    user = db_session.execute(UserModel.__table__.select().where(UserModel.email == email)).first()
    db_session.execute(UserModel.__table__.update().where(UserModel.email == email).values(role="admin"))
    db_session.commit()
    assert user is not None


def test_regular_user_cannot_access_admin_dashboard(client):
    token = _register_and_login(client, email="plain@example.com")
    response = client.get("/api/v1/admin/dashboard", headers=_auth_header(token))
    assert response.status_code == 403


def test_admin_can_access_dashboard_and_sees_expected_shape(client, db_session):
    token = _register_and_login(client, email="admin@example.com")
    _promote_to_admin(db_session, "admin@example.com")

    response = client.get("/api/v1/admin/dashboard", headers=_auth_header(token))
    assert response.status_code == 200
    body = response.json()
    assert body["users_total"] >= 1
    assert "notifications_sent_7d_by_channel" in body
    assert "worker_runs" in body
    assert "feature_flags" in body


def test_admin_dashboard_reflects_a_created_alert(client, db_session):
    token = _register_and_login(client, email="withalert@example.com")
    client.post(
        "/api/v1/alerts",
        headers=_auth_header(token),
        json={
            "origin_iata": "FLN",
            "destination_iata": "MAD",
            "trip_type": "round_trip",
            "departure_date": "2026-11-10",
            "return_date": "2026-11-24",
            "max_price_cents": 300_000,
            "cabin_class": "economy",
        },
    )
    _promote_to_admin(db_session, "withalert@example.com")
    admin_token = _register_and_login(client, email="admin2@example.com")
    _promote_to_admin(db_session, "admin2@example.com")

    response = client.get("/api/v1/admin/dashboard", headers=_auth_header(admin_token))
    body = response.json()
    assert body["alerts_active_total"] == 1
    assert body["alerts_created_7d"] == 1
    # alert_created também vira um evento de produto (ver bootstrap.py)
    assert body["product_events_7d"].get("alert_created") == 1
    assert body["product_events_7d"].get("user_registered", 0) >= 1


def test_regular_user_cannot_manage_feature_flags(client):
    token = _register_and_login(client, email="notadmin@example.com")
    response = client.put(
        "/api/v1/admin/feature-flags/new_dashboard", headers=_auth_header(token), json={"enabled": True}
    )
    assert response.status_code == 403


def test_admin_can_create_and_list_feature_flags(client, db_session):
    token = _register_and_login(client, email="flagadmin@example.com")
    _promote_to_admin(db_session, "flagadmin@example.com")

    set_response = client.put(
        "/api/v1/admin/feature-flags/new_dashboard",
        headers=_auth_header(token),
        json={"enabled": True, "rollout_percentage": 50, "description": "Novo dashboard"},
    )
    assert set_response.status_code == 200
    assert set_response.json()["rollout_percentage"] == 50

    list_response = client.get("/api/v1/admin/feature-flags", headers=_auth_header(token))
    assert list_response.status_code == 200
    keys = [f["key"] for f in list_response.json()]
    assert "new_dashboard" in keys


def test_health_ready_reports_database_reachable(client):
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "reachable"


def test_metrics_endpoint_exposes_prometheus_format(client):
    client.get("/health")  # gera pelo menos uma métrica de http_requests_total
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text
