def test_register_endpoint_is_rate_limited(client):
    # Limite configurado em identity/interface/routes.py: 5 registros/hora por IP.
    for i in range(5):
        response = client.post(
            "/api/v1/auth/register",
            json={"email": f"user{i}@example.com", "password": "supersecret", "full_name": "User"},
        )
        assert response.status_code == 201

    blocked = client.post(
        "/api/v1/auth/register",
        json={"email": "one-too-many@example.com", "password": "supersecret", "full_name": "User"},
    )
    assert blocked.status_code == 429


def test_login_endpoint_is_rate_limited(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "brute@example.com", "password": "supersecret", "full_name": "User"},
    )

    # Limite: 10 tentativas/5min por IP.
    for _ in range(10):
        response = client.post(
            "/api/v1/auth/login", json={"email": "brute@example.com", "password": "wrong-password"}
        )
        assert response.status_code == 401

    blocked = client.post(
        "/api/v1/auth/login", json={"email": "brute@example.com", "password": "wrong-password"}
    )
    assert blocked.status_code == 429
