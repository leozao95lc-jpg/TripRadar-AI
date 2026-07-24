from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from shared.database import GUID, Base


class MileageValuationModel(Base):
    """Valor de referência (cents-per-mile) por programa de milhagem — dado de
    referência curado manualmente no MVP (ver docs/04-modelo-dados.md, seção 5.2)."""

    __tablename__ = "mileage_valuations"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    program_code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    program_name: Mapped[str] = mapped_column(String(100), nullable=False)
    reference_cents_per_mile: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class ExchangeRateModel(Base):
    """Taxa de câmbio do dia + referência de comparação (ex.: média móvel), usada pelo
    sinal `currency_signal` do TripScore. Ingestão diária real fica para uma fase
    posterior — a tabela e o adapter já estão prontos para receber isso sem mudança de
    schema."""

    __tablename__ = "exchange_rates"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    quote_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate: Mapped[float] = mapped_column(Float, nullable=False)
    reference_rate: Mapped[float] = mapped_column(Float, nullable=False)
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )


class AiRecommendationModel(Base):
    __tablename__ = "ai_recommendations"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    origin_iata: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    destination_iata: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    cabin_class: Mapped[str] = mapped_column(String(30), nullable=False)
    verdict: Mapped[str] = mapped_column(String(30), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    current_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    target_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str] = mapped_column(String(1000), nullable=False)
    factors: Mapped[dict] = mapped_column(JSON, default=dict)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
