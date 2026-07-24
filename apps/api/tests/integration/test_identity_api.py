def test_register_login_and_get_profile(client):
    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": "ana@example.com", "password": "supersecret", "full_name": "Ana Silva"},
    )
    assert register_response.status_code == 201
    body = register_response.json()
    assert body["email"] == "ana@example.com"
    assert body["plan"] == "free"

    login_response = client.post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": "supersecret"}
    )
    assert login_response.status_code == 200
    tokens = login_response.json()

    me_response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "ana@example.com"


def test_register_duplicate_email_returns_409(client):
    payload = {"email": "dup@example.com", "password": "supersecret", "full_name": "Dup"}
    client.post("/api/v1/auth/register", json=payload)
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409


def test_login_with_wrong_password_returns_401(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "wrong@example.com", "password": "supersecret", "full_name": "W"},
    )
    response = client.post("/api/v1/auth/login", json={"email": "wrong@example.com", "password": "nope12345"})
    assert response.status_code == 401


def test_get_profile_without_token_returns_401(client):
    response = client.get("/api/v1/me")
    assert response.status_code == 401


def test_register_without_beta_access_code_configured_stays_open(client):
    # Default de dev/teste: settings.beta_access_code é None — o gate não
    # deve pedir nada, mesmo sem o campo no corpo da requisição.
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "open-beta@example.com", "password": "supersecret", "full_name": "Open"},
    )
    assert response.status_code == 201


def test_register_rejects_missing_code_when_beta_gate_is_configured(client, monkeypatch):
    import shared.config as config

    monkeypatch.setattr(config.settings, "beta_access_code", "let-me-in")
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "no-code@example.com", "password": "supersecret", "full_name": "No Code"},
    )
    assert response.status_code == 403


def test_register_rejects_wrong_code_when_beta_gate_is_configured(client, monkeypatch):
    import shared.config as config

    monkeypatch.setattr(config.settings, "beta_access_code", "let-me-in")
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrong-code@example.com",
            "password": "supersecret",
            "full_name": "Wrong Code",
            "access_code": "not-the-code",
        },
    )
    assert response.status_code == 403


def test_register_accepts_correct_code_when_beta_gate_is_configured(client, monkeypatch):
    import shared.config as config

    monkeypatch.setattr(config.settings, "beta_access_code", "let-me-in")
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "right-code@example.com",
            "password": "supersecret",
            "full_name": "Right Code",
            "access_code": "let-me-in",
        },
    )
    assert response.status_code == 201
