from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from modules.notifications.application.ports import NotificationSender
from modules.notifications.application.use_cases import (
    ConfirmNotificationChannel,
    CreateDefaultEmailPreference,
    DispatchAlertNotification,
    InvalidVerificationCodeError,
    SetNotificationPreference,
    _hash_code,
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


FIXED_CODE = "123456"


def _fixed_code_generator() -> str:
    return FIXED_CODE


def test_create_default_email_preference_on_registration():
    prefs = InMemoryNotificationPreferenceRepository()
    user_id = uuid4()

    CreateDefaultEmailPreference(prefs).execute(user_id, "ana@example.com")

    enabled = prefs.list_enabled_for_user(user_id)
    assert len(enabled) == 1
    assert enabled[0].channel.value == "email"
    assert enabled[0].destination == "ana@example.com"


def test_set_preference_for_email_always_uses_account_email_ignoring_destination():
    # Regressão do achado #2 de docs/09-revisao-tecnica-backend.md: antes, o usuário
    # podia setar qualquer destino de e-mail, inclusive o de um terceiro.
    prefs = InMemoryNotificationPreferenceRepository()
    user_id = uuid4()

    preference = SetNotificationPreference(prefs, senders={}).execute(
        user_id, "dono-da-conta@example.com", "email", "vitima@outrodominio.com", True
    )

    assert preference.destination == "dono-da-conta@example.com"
    assert preference.enabled is True


def test_set_preference_for_whatsapp_creates_pending_preference_and_sends_code():
    prefs = InMemoryNotificationPreferenceRepository()
    whatsapp_sender = FakeSender(ok=True)
    user_id = uuid4()

    preference = SetNotificationPreference(
        prefs, senders={"whatsapp": whatsapp_sender}, code_generator=_fixed_code_generator
    ).execute(user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", True)

    # Não habilita direto, mesmo com enabled=True no pedido — precisa confirmar o código.
    assert preference.enabled is False
    assert preference.verification_code_hash == _hash_code(FIXED_CODE)
    assert len(whatsapp_sender.calls) == 1
    assert whatsapp_sender.calls[0]["destination"] == "+5511999999999"
    assert FIXED_CODE in whatsapp_sender.calls[0]["message"]
    # Sem confirmação, o canal não aparece como habilitado.
    assert prefs.list_enabled_for_user(user_id) == []


def test_confirm_notification_channel_enables_after_correct_code():
    prefs = InMemoryNotificationPreferenceRepository()
    user_id = uuid4()
    SetNotificationPreference(prefs, senders={}, code_generator=_fixed_code_generator).execute(
        user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", True
    )

    preference = ConfirmNotificationChannel(prefs).execute(user_id, "whatsapp", FIXED_CODE)

    assert preference.enabled is True
    assert preference.verification_code_hash is None
    assert len(prefs.list_enabled_for_user(user_id)) == 1


def test_confirm_notification_channel_rejects_wrong_code():
    prefs = InMemoryNotificationPreferenceRepository()
    user_id = uuid4()
    SetNotificationPreference(prefs, senders={}, code_generator=_fixed_code_generator).execute(
        user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", True
    )

    with pytest.raises(InvalidVerificationCodeError):
        ConfirmNotificationChannel(prefs).execute(user_id, "whatsapp", "000000")

    assert prefs.list_enabled_for_user(user_id) == []


def test_confirm_notification_channel_rejects_expired_code():
    prefs = InMemoryNotificationPreferenceRepository()
    user_id = uuid4()
    SetNotificationPreference(prefs, senders={}, code_generator=_fixed_code_generator).execute(
        user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", True
    )
    pending = prefs.get_for_user_and_channel(user_id, prefs.list_for_user(user_id)[0].channel)
    pending.verification_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    prefs.upsert(pending)

    with pytest.raises(InvalidVerificationCodeError):
        ConfirmNotificationChannel(prefs).execute(user_id, "whatsapp", FIXED_CODE)


def test_confirm_notification_channel_rejects_when_no_pending_verification():
    prefs = InMemoryNotificationPreferenceRepository()
    user_id = uuid4()

    with pytest.raises(InvalidVerificationCodeError):
        ConfirmNotificationChannel(prefs).execute(user_id, "whatsapp", "123456")


def test_disabling_a_verified_whatsapp_channel_does_not_request_a_new_code():
    prefs = InMemoryNotificationPreferenceRepository()
    whatsapp_sender = FakeSender(ok=True)
    user_id = uuid4()
    SetNotificationPreference(
        prefs, senders={"whatsapp": whatsapp_sender}, code_generator=_fixed_code_generator
    ).execute(user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", True)
    ConfirmNotificationChannel(prefs).execute(user_id, "whatsapp", FIXED_CODE)
    assert len(whatsapp_sender.calls) == 1

    preference = SetNotificationPreference(prefs, senders={"whatsapp": whatsapp_sender}).execute(
        user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", False
    )

    assert preference.enabled is False
    assert preference.verification_code_hash is None  # continua verificado, só desligado
    assert len(whatsapp_sender.calls) == 1  # nenhum código novo foi enviado


def test_re_enabling_a_verified_whatsapp_channel_for_the_same_number_skips_verification():
    prefs = InMemoryNotificationPreferenceRepository()
    whatsapp_sender = FakeSender(ok=True)
    user_id = uuid4()
    SetNotificationPreference(
        prefs, senders={"whatsapp": whatsapp_sender}, code_generator=_fixed_code_generator
    ).execute(user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", True)
    ConfirmNotificationChannel(prefs).execute(user_id, "whatsapp", FIXED_CODE)
    SetNotificationPreference(prefs, senders={"whatsapp": whatsapp_sender}).execute(
        user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", False
    )

    preference = SetNotificationPreference(prefs, senders={"whatsapp": whatsapp_sender}).execute(
        user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", True
    )

    assert preference.enabled is True
    assert len(whatsapp_sender.calls) == 1  # nenhum código novo — não passou por verificação de novo


def test_changing_the_whatsapp_number_requires_verification_again():
    prefs = InMemoryNotificationPreferenceRepository()
    whatsapp_sender = FakeSender(ok=True)
    user_id = uuid4()
    SetNotificationPreference(
        prefs, senders={"whatsapp": whatsapp_sender}, code_generator=_fixed_code_generator
    ).execute(user_id, "dono-da-conta@example.com", "whatsapp", "+5511999999999", True)
    ConfirmNotificationChannel(prefs).execute(user_id, "whatsapp", FIXED_CODE)

    preference = SetNotificationPreference(
        prefs, senders={"whatsapp": whatsapp_sender}, code_generator=_fixed_code_generator
    ).execute(user_id, "dono-da-conta@example.com", "whatsapp", "+5511888888888", True)

    assert preference.enabled is False
    assert preference.destination == "+5511888888888"
    assert preference.verification_code_hash == _hash_code(FIXED_CODE)
    assert len(whatsapp_sender.calls) == 2  # um código novo foi enviado pro número novo


def test_dispatch_only_reaches_confirmed_channels():
    prefs = InMemoryNotificationPreferenceRepository()
    notifications = InMemoryNotificationRepository()
    user_id = uuid4()
    CreateDefaultEmailPreference(prefs).execute(user_id, "ana@example.com")
    SetNotificationPreference(prefs, senders={}, code_generator=_fixed_code_generator).execute(
        user_id, "ana@example.com", "whatsapp", "+5511999999999", True
    )
    ConfirmNotificationChannel(prefs).execute(user_id, "whatsapp", FIXED_CODE)

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


def test_dispatch_ignores_unconfirmed_whatsapp_preference():
    prefs = InMemoryNotificationPreferenceRepository()
    notifications = InMemoryNotificationRepository()
    user_id = uuid4()
    CreateDefaultEmailPreference(prefs).execute(user_id, "ana@example.com")
    # Cria a preferência de whatsapp mas NUNCA confirma o código.
    SetNotificationPreference(prefs, senders={}, code_generator=_fixed_code_generator).execute(
        user_id, "ana@example.com", "whatsapp", "+5511999999999", True
    )

    whatsapp_sender = FakeSender(ok=True)
    sent = DispatchAlertNotification(
        prefs, notifications, {"email": FakeSender(ok=True), "whatsapp": whatsapp_sender}
    ).execute(user_id=user_id, alert_trigger_id=uuid4(), subject="x", message="y")

    assert len(sent) == 1
    assert sent[0].channel.value == "email"
    assert whatsapp_sender.calls == []


def test_dispatch_skips_channel_without_configured_sender():
    prefs = InMemoryNotificationPreferenceRepository()
    notifications = InMemoryNotificationRepository()
    user_id = uuid4()
    CreateDefaultEmailPreference(prefs).execute(user_id, "ana@example.com")

    sent = DispatchAlertNotification(prefs, notifications, {}).execute(
        user_id=user_id, alert_trigger_id=uuid4(), subject="x", message="y"
    )

    assert sent[0].status == NotificationStatus.SKIPPED
