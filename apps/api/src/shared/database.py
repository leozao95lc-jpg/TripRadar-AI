import uuid
from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import CHAR, TypeDecorator

from shared.config import settings


class GUID(TypeDecorator):
    """UUID portável: usa UUID nativo no Postgres e CHAR(32) em outros dialetos (ex.: SQLite em teste)."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(str(value)).hex
        return value.hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Uma única transação por unidade de trabalho (uma requisição HTTP via `get_db`,
    ou o `run()` de um worker). O chamador passa essa mesma sessão explicitamente para
    `event_bus.dispatch(eventos, session)` — a cadeia de eventos de domínio disparada
    por essa unidade de trabalho participa da MESMA transação (tudo comita ou tudo
    reverte junto), sem estado ambiente (contextvars/threadlocals) e sem o risco de
    duas conexões concorrentes disputarem a mesma transação ainda aberta (ver
    docs/03-arquitetura.md, seção 4.2)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db() -> Generator[Session, None, None]:
    with session_scope() as db:
        yield db
