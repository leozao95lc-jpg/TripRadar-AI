from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import GUID, Base

# NOTA: user_id (-> identity.users) e price_snapshot_id (-> price_monitoring.price_snapshots)
# são referências lógicas, sem FK de banco: em DDD, agregados de bounded contexts
# diferentes se referenciam só por id. Isso também evita um problema real de ordenação
# entre transações quando o gatilho é criado por um handler de evento síncrono disparado
# antes do commit do snapshot que o originou (ver docs/03-arquitetura.md, seção 4.2).


class SearchAlertModel(Base):
    __tablename__ = "search_alerts"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(GUID, nullable=False, index=True)
    origin_iata: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    destination_iata: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    trip_type: Mapped[str] = mapped_column(String(20), nullable=False)
    departure_date: Mapped[date] = mapped_column(Date, nullable=False)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    flexible_dates: Mapped[bool] = mapped_column(Boolean, default=False)
    max_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="BRL")
    cabin_class: Mapped[str] = mapped_column(String(30), default="economy")
    passengers: Mapped[int] = mapped_column(Integer, default=1)
    max_stops: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alternative_airports_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class AlertTriggerModel(Base):
    __tablename__ = "alert_triggers"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    alert_id: Mapped[str] = mapped_column(GUID, nullable=False, index=True)
    price_snapshot_id: Mapped[str] = mapped_column(GUID, nullable=False)
    price_at_trigger_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
