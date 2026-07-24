def _register_and_login(client, email="notif-user@example.com"):
    client.post(
        "/api/v1/auth/register", json={"email": email, "password": "supersecret", "full_name": "Notif User"}
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "supersecret"})
    return login.json()["access_token"]


def test_email_preference_ignores_third_party_destination(client):
    token = _register_and_login(client, email="owner@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        "/api/v1/notifications/preferences",
        headers=headers,
        json={"channel": "email", "destination": "vitima@outrodominio.com", "enabled": True},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["destination"] == "owner@example.com"
    assert body["enabled"] is True


def test_whatsapp_preference_starts_pending_and_requires_verification(client):
    token = _register_and_login(client, email="wa-user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    set_response = client.put(
        "/api/v1/notifications/preferences",
        headers=headers,
        json={"channel": "whatsapp", "destination": "+5511999999999", "enabled": True},
    )
    assert set_response.status_code == 200
    body = set_response.json()
    assert body["enabled"] is False
    assert body["pending_verification"] is True

    list_response = client.get("/api/v1/notifications/preferences", headers=headers)
    whatsapp_pref = next(p for p in list_response.json() if p["channel"] == "whatsapp")
    assert whatsapp_pref["enabled"] is False

    verify_wrong = client.post(
        "/api/v1/notifications/preferences/verify",
        headers=headers,
        json={"channel": "whatsapp", "code": "000000"},
    )
    assert verify_wrong.status_code == 400


def test_whatsapp_destination_is_required(client):
    token = _register_and_login(client, email="no-dest@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        "/api/v1/notifications/preferences",
        headers=headers,
        json={"channel": "whatsapp", "destination": "", "enabled": True},
    )
    assert response.status_code == 422
