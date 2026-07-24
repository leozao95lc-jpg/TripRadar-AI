from uuid import uuid4

from modules.notifications.application.ports import NotificationSender
from modules.notifications.application.use_cases import (
    CreateDefaultEmailPreference,
    DispatchAlertNotification,
    SetNotificationPreference,
)
from modules.notifications.domain.entities import NotificationStatus
from modules.notifications.infrastructure.repository import (
    InMemoryNotificationPreferenceRepository,
    InMemoryNotificationRepository,
)


class FakeSender(NotificationSender):
    def __init__(self, ok: bool) -> None:
        self.ok = ok
        self.calls: list[dict] = []

    def send(self, *, destination: str, subject: str, message: str) -> bool:
        self.calls.append({"destination": destination, "subject": subject, "message": message})
        return self.ok


def test_create_default_email_preference_on_registration():
    prefs = InMemoryNotificationPreferenceRepository()
    user_id = uuid4()

    CreateDefaultEmailPreference(prefs).execute(user_id, "ana@example.com")

    enabled = prefs.list_enabled_for_user(user_id)
    assert len(enabled) == 1
    assert enabled[0].channel.value == "email"
    assert enabled[0].destination == "ana@example.com"


def test_dispatch_sends_through_enabled_channels_and_records_status():
    prefs = InMemoryNotificationPreferenceRepository()
    notifications = InMemoryNotificationRepository()
    user_id = uuid4()
    CreateDefaultEmailPreference(prefs).execute(user_id, "ana@example.com")
    SetNotificationPreference(prefs).execute(user_id, "whatsapp", "+5511999999999", True)

    email_sender = FakeSender(ok=True)
    whatsapp_sender = FakeSender(ok=False)
    trigger_id = uuid4()

    sent = DispatchAlertNotification(
        prefs, notifications, {"email": email_sender, "whatsapp": whatsapp_sender}
    ).execute(user_id=user_id, alert_trigger_id=trigger_id, subject="Caiu o preço!", message="R$ 290,00")

    statuses = {n.channel.value: n.status for n in sent}
    assert statuses["email"] == NotificationStatus.SENT
    assert statuses["whatsapp"] == NotificationStatus.FAILED
    assert len(email_sender.calls) == 1
    assert notifications.list_by_alert_trigger(trigger_id) == sent


def test_dispatch_skips_channel_without_configured_sender():
    prefs = InMemoryNotificationPreferenceRepository()
    notifications = InMemoryNotificationRepository()
    user_id = uuid4()
    CreateDefaultEmailPreference(prefs).execute(user_id, "ana@example.com")

    sent = DispatchAlertNotification(prefs, notifications, {}).execute(
        user_id=user_id, alert_trigger_id=uuid4(), subject="x", message="y"
    )

    assert sent[0].status == NotificationStatus.SKIPPED
