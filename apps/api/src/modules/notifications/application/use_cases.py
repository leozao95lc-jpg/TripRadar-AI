import hashlib
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import UUID

from modules.notifications.application.ports import (
    NotificationPreferenceRepository,
    NotificationRepository,
    NotificationSender,
)
from modules.notifications.domain.entities import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationStatus,
)

VERIFICATION_CODE_TTL_MINUTES = 10


class InvalidVerificationCodeError(Exception):
    pass


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def default_code_generator() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _as_aware_utc(value: datetime | None) -> datetime | None:
    """SQLite não preserva timezone ao ler de volta uma coluna DateTime(timezone=True)
    (volta naive); Postgres preserva. Normaliza pra UTC-aware antes de comparar, pra
    não depender do dialeto do banco."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


class CreateDefaultEmailPreference:
    """Reage ao evento `user_registered` (publicado por `identity`) criando a
    preferência de e-mail padrão — é assim que `notifications` conhece o e-mail do
    usuário sem importar o módulo `identity`."""

    def __init__(self, preferences: NotificationPreferenceRepository) -> None:
        self._preferences = preferences

    def execute(self, user_id: UUID, email: str) -> NotificationPreference:
        preference = NotificationPreference(
            user_id=user_id, channel=NotificationChannel.EMAIL, destination=email, enabled=True
        )
        self._preferences.upsert(preference)
        return preference


class SetNotificationPreference:
    """E-mail sempre usa o e-mail da própria conta (nunca um destino arbitrário) e
    fica habilitado na hora — é o mesmo endereço que já identifica a conta, não um
    novo destino não verificado. Canais baseados em contato externo (WhatsApp,
    Telegram) NUNCA habilitam direto: a preferência é salva com `enabled=False` e um
    código de verificação é enviado para o destino informado; só passa a receber
    notificações depois de confirmado via `ConfirmNotificationChannel`. Isso fecha o
    vetor de abuso descrito em docs/09-revisao-tecnica-backend.md (achado #2): antes,
    qualquer usuário autenticado podia apontar um alerta para o WhatsApp/e-mail de um
    terceiro."""

    def __init__(
        self,
        preferences: NotificationPreferenceRepository,
        senders: dict[str, NotificationSender],
        code_generator: Callable[[], str] = default_code_generator,
    ) -> None:
        self._preferences = preferences
        self._senders = senders
        self._code_generator = code_generator

    def execute(
        self, user_id: UUID, account_email: str, channel: str, destination: str, enabled: bool
    ) -> NotificationPreference:
        channel_enum = NotificationChannel(channel)

        if channel_enum == NotificationChannel.EMAIL:
            preference = NotificationPreference(
                user_id=user_id, channel=channel_enum, destination=account_email, enabled=enabled
            )
            self._preferences.upsert(preference)
            return preference

        existing = self._preferences.get_for_user_and_channel(user_id, channel_enum)

        # Desligar um canal já configurado nunca reenvia código nem mexe no estado de
        # verificação — só marca enabled=False. Sem isso, o único jeito de "desativar"
        # o WhatsApp seria passar de novo pelo fluxo de código, o que é confuso e, pior,
        # reativaria um canal já verificado como se fosse novo a cada toggle.
        if not enabled and existing is not None:
            existing.enabled = False
            self._preferences.upsert(existing)
            return existing

        # Religar um canal já verificado para o MESMO destino: não pede código de novo.
        already_verified_same_destination = (
            existing is not None
            and existing.destination == destination
            and existing.verification_code_hash is None
        )
        if enabled and already_verified_same_destination:
            existing.enabled = True
            self._preferences.upsert(existing)
            return existing

        # Canal novo, destino mudou, ou ainda não verificado: gera e envia um código.
        code = self._code_generator()
        preference = NotificationPreference(
            user_id=user_id,
            channel=channel_enum,
            destination=destination,
            enabled=False,
            verification_code_hash=_hash_code(code),
            verification_expires_at=datetime.now(UTC) + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES),
        )
        self._preferences.upsert(preference)

        sender = self._senders.get(channel_enum.value)
        if sender is not None:
            sender.send(
                destination=destination,
                subject="Código de verificação TripRadar",
                message=(
                    f"Seu código de verificação é {code}. "
                    f"Ele expira em {VERIFICATION_CODE_TTL_MINUTES} minutos."
                ),
            )
        return preference


class ConfirmNotificationChannel:
    """Confirma a posse de um destino baseado em contato externo (WhatsApp/Telegram)
    e só então habilita o canal — ver `SetNotificationPreference`."""

    def __init__(self, preferences: NotificationPreferenceRepository) -> None:
        self._preferences = preferences

    def execute(self, user_id: UUID, channel: str, code: str) -> NotificationPreference:
        channel_enum = NotificationChannel(channel)
        preference = self._preferences.get_for_user_and_channel(user_id, channel_enum)

        if preference is None or preference.verification_code_hash is None:
            raise InvalidVerificationCodeError("no_pending_verification")
        expires_at = _as_aware_utc(preference.verification_expires_at)
        if expires_at is None or expires_at < datetime.now(UTC):
            raise InvalidVerificationCodeError("code_expired")
        if not secrets.compare_digest(preference.verification_code_hash, _hash_code(code)):
            raise InvalidVerificationCodeError("code_mismatch")

        preference.enabled = True
        preference.verification_code_hash = None
        preference.verification_expires_at = None
        self._preferences.upsert(preference)
        return preference


class DispatchAlertNotification:
    """Reage ao evento `alert_triggered` (publicado por `alerts`): envia por cada canal
    habilitado (e portanto já verificado, no caso de WhatsApp/Telegram) do usuário e
    registra o resultado. Canal sem sender configurado (ex.: Telegram, ainda sem
    integração) é ignorado, não derruba o processo."""

    def __init__(
        self,
        preferences: NotificationPreferenceRepository,
        notifications: NotificationRepository,
        senders: dict[str, NotificationSender],
    ) -> None:
        self._preferences = preferences
        self._notifications = notifications
        self._senders = senders

    def execute(
        self, *, user_id: UUID, alert_trigger_id: UUID, subject: str, message: str
    ) -> list[Notification]:
        preferences = self._preferences.list_enabled_for_user(user_id)
        sent: list[Notification] = []

        for preference in preferences:
            sender = self._senders.get(preference.channel.value)
            if sender is None:
                status = NotificationStatus.SKIPPED
            else:
                status = (
                    NotificationStatus.SENT
                    if sender.send(destination=preference.destination, subject=subject, message=message)
                    else NotificationStatus.FAILED
                )

            notification = Notification(
                alert_trigger_id=alert_trigger_id, channel=preference.channel, status=status
            )
            self._notifications.add(notification)
            sent.append(notification)

        return sent
