"""Camada de aplicação do dashboard administrativo — só leitura agregada, nenhuma
regra de negócio própria. Por isso ele depende DIRETO das portas já publicadas por
`identity`, `alerts`, `notifications`, `price_monitoring`, `analytics` e
`observability`, em vez de definir portas próprias que cada módulo teria que
implementar (o padrão usado em `alerts.application.ports.UserPlanPort`, por
exemplo). Essa é uma exceção deliberada: `admin` nunca importa `infrastructure`
nem `domain` de outro módulo — só `application/ports.py`, que já é o contrato
público de leitura de cada um. Trocar a implementação concreta de qualquer porta
(ex.: um repositório com cache) não exige mudar uma linha aqui."""

from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from modules.alerts.application.ports import AlertRepository, AlertTriggerRepository
from modules.analytics.application.ports import ProductEventRepository
from modules.feature_flags.application.ports import FeatureFlagRepository
from modules.feature_flags.domain.entities import FeatureFlag
from modules.identity.application.ports import UserRepository
from modules.notifications.application.ports import NotificationRepository
from modules.observability.application.ports import WorkerRunRepository
from modules.observability.domain.entities import WorkerRun
from modules.price_monitoring.application.ports import PriceSnapshotRepository


@dataclass
class AdminDashboardSummary:
    users_total: int
    users_new_7d: int
    alerts_active_total: int
    alerts_created_7d: int
    alert_triggers_7d: int
    notifications_sent_7d_by_channel: dict[str, int]
    notifications_sent_7d_by_status: dict[str, int]
    price_snapshots_24h: int
    product_events_7d: dict[str, int]
    worker_runs: list[WorkerRun] = field(default_factory=list)
    feature_flags: list[FeatureFlag] = field(default_factory=list)
    generated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class GetAdminDashboardSummary:
    def __init__(
        self,
        users: UserRepository,
        alerts: AlertRepository,
        alert_triggers: AlertTriggerRepository,
        notifications: NotificationRepository,
        price_snapshots: PriceSnapshotRepository,
        product_events: ProductEventRepository,
        worker_runs: WorkerRunRepository,
        feature_flags: FeatureFlagRepository,
    ) -> None:
        self._users = users
        self._alerts = alerts
        self._alert_triggers = alert_triggers
        self._notifications = notifications
        self._price_snapshots = price_snapshots
        self._product_events = product_events
        self._worker_runs = worker_runs
        self._feature_flags = feature_flags

    def execute(self) -> AdminDashboardSummary:
        now = datetime.now(UTC)
        since_7d = now - timedelta(days=7)
        since_24h = now - timedelta(hours=24)

        recent_notifications = self._notifications.list_since(since_7d)
        by_channel = Counter(n.channel.value for n in recent_notifications)
        by_status = Counter(n.status.value for n in recent_notifications)

        return AdminDashboardSummary(
            users_total=self._users.count_total(),
            users_new_7d=self._users.count_created_since(since_7d),
            alerts_active_total=self._alerts.count_active_total(),
            alerts_created_7d=self._alerts.count_created_since(since_7d),
            alert_triggers_7d=self._alert_triggers.count_since(since_7d),
            notifications_sent_7d_by_channel=dict(by_channel),
            notifications_sent_7d_by_status=dict(by_status),
            price_snapshots_24h=self._price_snapshots.count_since(since_24h),
            product_events_7d=self._product_events.count_by_event_name_since(since_7d),
            worker_runs=self._worker_runs.list_latest_per_worker(),
            feature_flags=self._feature_flags.list_all(),
            generated_at=now,
        )
