"""alerts + notifications modules: search_alerts, alert_triggers,
notification_preferences, notifications

Revision ID: 0003_alerts_notifications
Revises: 0002_price_monitoring
Create Date: 2026-07-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from shared.database import GUID

revision: str = "0003_alerts_notifications"
down_revision: str | None = "0002_price_monitoring"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "search_alerts",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("origin_iata", sa.String(3), nullable=False),
        sa.Column("destination_iata", sa.String(3), nullable=False),
        sa.Column("trip_type", sa.String(20), nullable=False),
        sa.Column("departure_date", sa.Date(), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=True),
        sa.Column("flexible_dates", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("max_price_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="BRL"),
        sa.Column("cabin_class", sa.String(30), nullable=False, server_default="economy"),
        sa.Column("passengers", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("max_stops", sa.Integer(), nullable=True),
        sa.Column("alternative_airports_ok", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_search_alerts_user_id", "search_alerts", ["user_id"])
    op.create_index("ix_search_alerts_origin_iata", "search_alerts", ["origin_iata"])
    op.create_index("ix_search_alerts_destination_iata", "search_alerts", ["destination_iata"])
    op.create_index("ix_search_alerts_status", "search_alerts", ["status"])

    op.create_table(
        "alert_triggers",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("alert_id", GUID(), nullable=False),
        sa.Column("price_snapshot_id", GUID(), nullable=False),
        sa.Column("price_at_trigger_cents", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_alert_triggers_alert_id", "alert_triggers", ["alert_id"])
    op.create_index("ix_alert_triggers_triggered_at", "alert_triggers", ["triggered_at"])

    op.create_table(
        "notification_preferences",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("destination", sa.String(255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_notification_preferences_user_id", "notification_preferences", ["user_id"])
    op.create_unique_constraint(
        "uq_notification_pref_user_channel", "notification_preferences", ["user_id", "channel"]
    )

    op.create_table(
        "notifications",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("alert_trigger_id", GUID(), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notifications_alert_trigger_id", "notifications", ["alert_trigger_id"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_constraint("uq_notification_pref_user_channel", "notification_preferences", type_="unique")
    op.drop_index("ix_notification_preferences_user_id", table_name="notification_preferences")
    op.drop_table("notification_preferences")
    op.drop_index("ix_alert_triggers_triggered_at", table_name="alert_triggers")
    op.drop_index("ix_alert_triggers_alert_id", table_name="alert_triggers")
    op.drop_table("alert_triggers")
    op.drop_index("ix_search_alerts_status", table_name="search_alerts")
    op.drop_index("ix_search_alerts_destination_iata", table_name="search_alerts")
    op.drop_index("ix_search_alerts_origin_iata", table_name="search_alerts")
    op.drop_index("ix_search_alerts_user_id", table_name="search_alerts")
    op.drop_table("search_alerts")
