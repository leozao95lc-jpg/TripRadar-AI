from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import GUID, Base


class WorkerRunModel(Base):
    __tablename__ = "worker_runs"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    worker_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    routes_ok: Mapped[int] = mapped_column(Integer, default=0)
    routes_failed: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    provider_requests: Mapped[int] = mapped_column(Integer, default=0)
    provider_requests_failed: Mapped[int] = mapped_column(Integer, default=0)
    provider_cache_hits: Mapped[int] = mapped_column(Integer, default=0)
    provider_cache_misses: Mapped[int] = mapped_column(Integer, default=0)
    provider_fallback_used: Mapped[int] = mapped_column(Integer, default=0)
    provider_circuit_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
