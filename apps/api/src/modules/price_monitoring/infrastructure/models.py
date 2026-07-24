from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import Date, DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import GUID, Base

# NOTA: origin_iata/destination_iata/airline_iata são armazenados como código IATA (string),
# sem FK para tabelas de referência (`airports`/`airlines`) por enquanto — carregar o
# catálogo completo de aeroportos/companhias é uma tarefa de seed de dados própria, fora
# do escopo desta fase. Adicionar a FK depois é uma migration aditiva, não um refactor.


class PriceSnapshotModel(Base):
    """Série histórica de preço por rota. Candidata a hypertable (TimescaleDB) quando o
    volume justificar — ver docs/04-modelo-dados.md."""

    __tablename__ = "price_snapshots"
    __table_args__ = (
        Index(
            "ix_price_snapshots_route_lookup",
            "origin_iata",
            "destination_iata",
            "cabin_class",
            "collected_at",
        ),
    )

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    origin_iata: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    destination_iata: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    departure_date: Mapped[date] = mapped_column(Date, nullable=False)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cabin_class: Mapped[str] = mapped_column(String(30), nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="BRL")
    airline_iata: Mapped[str | None] = mapped_column(String(3), nullable=True)
    source_provider: Mapped[str] = mapped_column(String(30), nullable=False)
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
