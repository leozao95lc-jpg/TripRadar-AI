from datetime import datetime
from uuid import UUID

from modules.analytics.application.ports import ProductEventRepository
from modules.analytics.domain.entities import ProductEvent


class RecordProductEvent:
    def __init__(self, events: ProductEventRepository) -> None:
        self._events = events

    def execute(self, event_name: str, user_id: UUID | None = None, **properties) -> ProductEvent:
        event = ProductEvent(event_name=event_name, user_id=user_id, properties=properties)
        self._events.add(event)
        return event


class GetProductEventCounts:
    def __init__(self, events: ProductEventRepository) -> None:
        self._events = events

    def execute(self, since: datetime) -> dict[str, int]:
        return self._events.count_by_event_name_since(since)
