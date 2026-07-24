from datetime import UTC, datetime, timedelta
from uuid import uuid4

from modules.analytics.application.use_cases import GetProductEventCounts, RecordProductEvent
from modules.analytics.domain.entities import ProductEvent
from modules.analytics.infrastructure.repository import InMemoryProductEventRepository


def test_record_product_event_stores_name_user_and_properties():
    events = InMemoryProductEventRepository()
    user_id = uuid4()
    event = RecordProductEvent(events).execute(
        "alert_created", user_id, origin_iata="FLN", destination_iata="MAD"
    )
    assert event.event_name == "alert_created"
    assert event.user_id == user_id
    assert event.properties == {"origin_iata": "FLN", "destination_iata": "MAD"}


def test_get_product_event_counts_groups_by_name_within_window():
    events = InMemoryProductEventRepository()
    record = RecordProductEvent(events)
    record.execute("alert_created")
    record.execute("alert_created")
    record.execute("user_registered")

    counts = GetProductEventCounts(events).execute(datetime.now(UTC) - timedelta(days=1))
    assert counts == {"alert_created": 2, "user_registered": 1}


def test_get_product_event_counts_excludes_events_before_since():
    events = InMemoryProductEventRepository()
    events.add(ProductEvent(event_name="old_event", occurred_at=datetime.now(UTC) - timedelta(days=30)))
    counts = GetProductEventCounts(events).execute(datetime.now(UTC) - timedelta(days=7))
    assert counts == {}
