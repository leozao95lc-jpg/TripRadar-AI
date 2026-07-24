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
