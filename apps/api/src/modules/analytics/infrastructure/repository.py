from collections import Counter
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.analytics.application.ports import ProductEventRepository
from modules.analytics.domain.entities import ProductEvent
from modules.analytics.infrastructure.models import ProductEventModel


class SqlAlchemyProductEventRepository(ProductEventRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, event: ProductEvent) -> None:
        self._session.add(
            ProductEventModel(
                id=str(event.id),
                event_name=event.event_name,
                user_id=str(event.user_id) if event.user_id else None,
                properties=event.properties,
                occurred_at=event.occurred_at,
            )
        )
        self._session.flush()

    def count_by_event_name_since(self, since: datetime) -> dict[str, int]:
        rows = self._session.execute(
            select(ProductEventModel.event_name, func.count())
            .where(ProductEventModel.occurred_at >= since)
            .group_by(ProductEventModel.event_name)
        ).all()
        return {name: count for name, count in rows}


class InMemoryProductEventRepository(ProductEventRepository):
    def __init__(self) -> None:
        self._events: list[ProductEvent] = []

    def add(self, event: ProductEvent) -> None:
        self._events.append(event)

    def count_by_event_name_since(self, since: datetime) -> dict[str, int]:
        since_aware = since if since.tzinfo else since.replace(tzinfo=UTC)
        counter: Counter = Counter(
            e.event_name for e in self._events if e.occurred_at >= since_aware
        )
        return dict(counter)
