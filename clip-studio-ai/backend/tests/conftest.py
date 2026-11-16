import pytest

SEGMENTS = [
    (0.5, 4.0, "Hoje a gente vai falar de uma viagem que deu muito errado."),
    (4.2, 8.0, "Eu cheguei no aeroporto e descobri que o passaporte tinha vencido."),
    (8.3, 12.0, "E o pior é que eu só percebi"),
    (12.1, 16.0, "quando a moça do balcão olhou pra mim rindo."),
    (16.5, 20.0, "Então fica a dica: confira o documento um mês antes."),
    (20.4, 24.0, "Outra coisa importante é o seguro viagem."),
    (24.2, 28.0, "Muita gente acha que é dinheiro jogado fora."),
    (28.3, 29.8, "Até precisar de um hospital fora do país."),
]


def fake_transcript(duration=30.0):
    segs = []
    for i, (a, b, text) in enumerate(SEGMENTS):
        toks = text.split()
        step = (b - a) / len(toks)
        segs.append({"id": i, "start": a, "end": b, "text": text, "speaker": None,
                     "words": [{"word": t, "start": round(a + j * step, 3), "end": round(a + (j + 1) * step, 3)}
                               for j, t in enumerate(toks)]})
    return {"language": "pt", "language_probability": 0.99, "duration": duration, "model": "fake",
            "diarization": False, "segments": segs}


@pytest.fixture(scope="session")
def sample_video(tmp_path_factory):
    """Vídeo de teste 16:9 de 30 s gerado pelo FFmpeg (com fala sintetizada quando há `flite`)."""
    from tests.make_test_video import make

    path = tmp_path_factory.mktemp("media") / "sample.mp4"
    make(path)
    return path


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setenv("DATABASE_URL", "")  # nunca o banco real, mesmo se a variável existir no ambiente
    monkeypatch.setenv("APP_PASSWORD", "senha-teste")
    monkeypatch.setenv("SECRET_KEY", "k" * 40)
    monkeypatch.setenv("QUEUE_EAGER", "true")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("RENDER_PRESET", "ultrafast")
    monkeypatch.setenv("MAX_UPLOAD_MB", "50")
    monkeypatch.setenv("MIN_FREE_DISK_MB", "10")
    from app import config, db

    config.get_settings.cache_clear()
    db.reset_engine()
    from alembic import command
    from alembic.config import Config

    command.upgrade(Config("alembic.ini"), "head")  # os testes rodam sobre as migrações reais
    from fastapi.testclient import TestClient

    from app import security
    from app.main import app

    security._failures.clear()
    with TestClient(app) as c:
        yield c
    db.reset_engine()
    config.get_settings.cache_clear()


@pytest.fixture()
def auth(client):
    assert client.post("/api/auth/login", json={"password": "senha-teste"}).status_code == 200
    return client
