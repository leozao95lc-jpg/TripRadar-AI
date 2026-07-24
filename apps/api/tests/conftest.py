import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import bootstrap
from main import app
from shared.database import Base, get_db
from shared.events import event_bus
from shared.rate_limit import rate_limiter


@pytest.fixture(autouse=True)
def _isolated_event_bus():
    # `event_bus` e `bootstrap._registered` são singletons de processo. Sem isso, o
    # primeiro teste que sobe a API (lifespan -> register_event_handlers) deixaria
    # handlers de produção registrados para sempre, e testes de unidade que publicam
    # eventos diretamente (sem TestClient) tentariam abrir sessão no Postgres real.
    event_bus._handlers.clear()
    bootstrap._registered = False
    yield
    event_bus._handlers.clear()
    bootstrap._registered = False


@pytest.fixture(autouse=True)
def _isolated_rate_limiter():
    # `rate_limiter` também é um singleton de processo — sem resetar entre testes,
    # os muitos testes que chamam /auth/register ou POST /alerts repetidamente
    # acabariam esbarrando no limite uns dos outros (o TestClient sempre usa o
    # mesmo IP simulado).
    rate_limiter.reset()
    yield
    rate_limiter.reset()


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
