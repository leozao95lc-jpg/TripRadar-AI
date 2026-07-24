from datetime import datetime

from pydantic import BaseModel


class WorkerRunResponse(BaseModel):
    worker_name: str
    started_at: datetime
    finished_at: datetime
    success: bool
    routes_ok: int
    routes_failed: int
    error_message: str | None
    recorded_at: datetime


class FeatureFlagSummary(BaseModel):
    key: str
    enabled: bool
    rollout_percentage: int


class AdminDashboardResponse(BaseModel):
    users_total: int
    users_new_7d: int
    alerts_active_total: int
    alerts_created_7d: int
    alert_triggers_7d: int
    notifications_sent_7d_by_channel: dict[str, int]
    notifications_sent_7d_by_status: dict[str, int]
    price_snapshots_24h: int
    product_events_7d: dict[str, int]
    worker_runs: list[WorkerRunResponse]
    feature_flags: list[FeatureFlagSummary]
    generated_at: datetime
