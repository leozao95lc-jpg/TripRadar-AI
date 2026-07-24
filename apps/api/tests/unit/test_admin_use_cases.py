from datetime import UTC, datetime, timedelta
from uuid import uuid4

from modules.admin.application.use_cases import GetAdminDashboardSummary
from modules.alerts.domain.entities import SearchAlert, TripType
from modules.alerts.infrastructure.repository import InMemoryAlertRepository, InMemoryAlertTriggerRepository
from modules.analytics.infrastructure.repository import InMemoryProductEventRepository
from modules.feature_flags.infrastructure.repository import InMemoryFeatureFlagRepository
from modules.identity.domain.entities import User
from modules.identity.infrastructure.repository import InMemoryUserRepository
from modules.notifications.domain.entities import Notification, NotificationChannel, NotificationStatus
from modules.notifications.infrastructure.repository import InMemoryNotificationRepository
from modules.observability.infrastructure.repository import InMemoryWorkerRunRepository
from modules.price_monitoring.infrastructure.repository import InMemoryPriceSnapshotRepository


def _build_use_case(
    users=None, alerts=None, alert_triggers=None, notifications=None,
    price_snapshots=None, product_events=None, worker_runs=None, feature_flags=None,
):
    return GetAdminDashboardSummary(
        users=users or InMemoryUserRepository(),
        alerts=alerts or InMemoryAlertRepository(),
        alert_triggers=alert_triggers or InMemoryAlertTriggerRepository(),
        notifications=notifications or InMemoryNotificationRepository(),
        price_snapshots=price_snapshots or InMemoryPriceSnapshotRepository(),
        product_events=product_events or InMemoryProductEventRepository(),
        worker_runs=worker_runs or InMemoryWorkerRunRepository(),
        feature_flags=feature_flags or InMemoryFeatureFlagRepository(),
    )


def test_empty_system_returns_zeroed_summary():
    summary = _build_use_case().execute()
    assert summary.users_total == 0
    assert summary.alerts_active_total == 0
    assert summary.notifications_sent_7d_by_channel == {}
    assert summary.worker_runs == []
    assert summary.feature_flags == []


def test_summary_aggregates_across_all_modules():
    users = InMemoryUserRepository()
    users.add(User(email="a@example.com", password_hash="x", full_name="A"))
    users.add(User(email="b@example.com", password_hash="x", full_name="B"))

    alerts = InMemoryAlertRepository()
    alert = SearchAlert(
        user_id=uuid4(), origin_iata="FLN", destination_iata="MAD",
        trip_type=TripType.ROUND_TRIP, departure_date="2026-11-10", max_price_cents=300_000,
    )
    alerts.add(alert)

    alert_triggers = InMemoryAlertTriggerRepository()
    notifications = InMemoryNotificationRepository()
    notifications.add(
        Notification(
            alert_trigger_id=uuid4(), channel=NotificationChannel.EMAIL, status=NotificationStatus.SENT
        )
    )
    notifications.add(
        Notification(
            alert_trigger_id=uuid4(), channel=NotificationChannel.WHATSAPP, status=NotificationStatus.FAILED
        )
    )

    product_events = InMemoryProductEventRepository()

    summary = _build_use_case(
        users=users, alerts=alerts, alert_triggers=alert_triggers, notifications=notifications,
        product_events=product_events,
    ).execute()

    assert summary.users_total == 2
    assert summary.alerts_active_total == 1
    assert summary.notifications_sent_7d_by_channel == {"email": 1, "whatsapp": 1}
    assert summary.notifications_sent_7d_by_status == {"sent": 1, "failed": 1}


def test_notifications_outside_the_7_day_window_are_excluded():
    notifications = InMemoryNotificationRepository()
    notifications.add(
        Notification(
            alert_trigger_id=uuid4(),
            channel=NotificationChannel.EMAIL,
            status=NotificationStatus.SENT,
            sent_at=datetime.now(UTC) - timedelta(days=30),
        )
    )
    summary = _build_use_case(notifications=notifications).execute()
    assert summary.notifications_sent_7d_by_channel == {}
