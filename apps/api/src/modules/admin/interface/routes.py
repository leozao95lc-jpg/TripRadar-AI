from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.admin.application.use_cases import AdminDashboardSummary, GetAdminDashboardSummary
from modules.admin.interface.schemas import AdminDashboardResponse, FeatureFlagSummary, WorkerRunResponse
from modules.alerts.infrastructure.repository import (
    SqlAlchemyAlertRepository,
    SqlAlchemyAlertTriggerRepository,
)
from modules.analytics.infrastructure.repository import SqlAlchemyProductEventRepository
from modules.feature_flags.infrastructure.repository import SqlAlchemyFeatureFlagRepository
from modules.identity.domain.entities import User
from modules.identity.infrastructure.repository import SqlAlchemyUserRepository
from modules.identity.interface.dependencies import require_admin
from modules.notifications.infrastructure.repository import SqlAlchemyNotificationRepository
from modules.observability.infrastructure.repository import SqlAlchemyWorkerRunRepository
from modules.price_monitoring.infrastructure.repository import SqlAlchemyPriceSnapshotRepository
from shared.database import get_db

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _to_response(summary: AdminDashboardSummary) -> AdminDashboardResponse:
    return AdminDashboardResponse(
        users_total=summary.users_total,
        users_new_7d=summary.users_new_7d,
        alerts_active_total=summary.alerts_active_total,
        alerts_created_7d=summary.alerts_created_7d,
        alert_triggers_7d=summary.alert_triggers_7d,
        notifications_sent_7d_by_channel=summary.notifications_sent_7d_by_channel,
        notifications_sent_7d_by_status=summary.notifications_sent_7d_by_status,
        price_snapshots_24h=summary.price_snapshots_24h,
        product_events_7d=summary.product_events_7d,
        worker_runs=[
            WorkerRunResponse(
                worker_name=r.worker_name,
                started_at=r.started_at,
                finished_at=r.finished_at,
                success=r.success,
                routes_ok=r.routes_ok,
                routes_failed=r.routes_failed,
                error_message=r.error_message,
                recorded_at=r.recorded_at,
            )
            for r in summary.worker_runs
        ],
        feature_flags=[
            FeatureFlagSummary(key=f.key, enabled=f.enabled, rollout_percentage=f.rollout_percentage)
            for f in summary.feature_flags
        ],
        generated_at=summary.generated_at,
    )


@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_dashboard(
    _admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> AdminDashboardResponse:
    summary = GetAdminDashboardSummary(
        users=SqlAlchemyUserRepository(db),
        alerts=SqlAlchemyAlertRepository(db),
        alert_triggers=SqlAlchemyAlertTriggerRepository(db),
        notifications=SqlAlchemyNotificationRepository(db),
        price_snapshots=SqlAlchemyPriceSnapshotRepository(db),
        product_events=SqlAlchemyProductEventRepository(db),
        worker_runs=SqlAlchemyWorkerRunRepository(db),
        feature_flags=SqlAlchemyFeatureFlagRepository(db),
    ).execute()
    return _to_response(summary)
