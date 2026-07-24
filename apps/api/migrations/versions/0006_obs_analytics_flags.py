"""observability, analytics e feature_flags modules: worker_runs, product_events,
feature_flags — Fase 5.5 (docs/README.md). Estas tabelas já existiam no código desde
a Fase 5.5, mas nunca tinham sido migradas via Alembic (só criadas ad-hoc via
Base.metadata.create_all() em SQLite de teste) — gap encontrado ao validar o deploy
contra Postgres real pela primeira vez (docs/13-deploy-beta-privado.md).

Revision ID: 0006_obs_analytics_flags
Revises: 0005_notification_verification
Create Date: 2026-07-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from shared.database import GUID

revision: str = "0006_obs_analytics_flags"
down_revision: str | None = "0005_notification_verification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "feature_flags",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("rollout_percentage", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "worker_runs",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("worker_name", sa.String(100), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("routes_ok", sa.Integer(), nullable=False),
        sa.Column("routes_failed", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("provider_name", sa.String(50), nullable=True),
        sa.Column("provider_requests", sa.Integer(), nullable=False),
        sa.Column("provider_requests_failed", sa.Integer(), nullable=False),
        sa.Column("provider_cache_hits", sa.Integer(), nullable=False),
        sa.Column("provider_cache_misses", sa.Integer(), nullable=False),
        sa.Column("provider_fallback_used", sa.Integer(), nullable=False),
        sa.Column("provider_circuit_state", sa.String(20), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_worker_runs_worker_name", "worker_runs", ["worker_name"])
    op.create_index("ix_worker_runs_recorded_at", "worker_runs", ["recorded_at"])

    op.create_table(
        "product_events",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("event_name", sa.String(100), nullable=False),
        sa.Column("user_id", GUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("properties", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_product_events_name_occurred", "product_events", ["event_name", "occurred_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_product_events_name_occurred", table_name="product_events")
    op.drop_table("product_events")
    op.drop_index("ix_worker_runs_recorded_at", table_name="worker_runs")
    op.drop_index("ix_worker_runs_worker_name", table_name="worker_runs")
    op.drop_table("worker_runs")
    op.drop_table("feature_flags")
