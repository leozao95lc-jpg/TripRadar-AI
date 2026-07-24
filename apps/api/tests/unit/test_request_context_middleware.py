from fastapi import FastAPI
from fastapi.testclient import TestClient

from shared.middleware import RequestContextMiddleware


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)

    @app.get("/ok")
    def ok():
        return {"status": "ok"}

    @app.get("/boom")
    def boom():
        raise RuntimeError("kaboom")

    return app


def test_successful_request_gets_a_request_id_header():
    client = TestClient(_build_app())

    response = client.get("/ok")

    assert response.status_code == 200
    assert "x-request-id" in response.headers


def test_unhandled_exception_is_logged_before_propagating(capsys):
    # Regressão do achado #14 de docs/09-revisao-tecnica-backend.md: antes, uma
    # exceção não tratada pulava a linha de log inteira — a requisição que quebrou
    # ficava sem nenhum registro estruturado.
    client = TestClient(_build_app(), raise_server_exceptions=False)

    response = client.get("/boom")

    assert response.status_code == 500
    captured = capsys.readouterr()
    assert "http_request_failed" in captured.out
    assert "/boom" in captured.out
