from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from shared.database import GUID, Base


class ProductEventModel(Base):
    __tablename__ = "product_events"
    __table_args__ = (Index("ix_product_events_name_occurred", "event_name", "occurred_at"),)

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=uuid4)
    event_name: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    properties: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
