"""price_monitoring module: price_snapshots

Revision ID: 0002_price_monitoring
Revises: 0001_identity
Create Date: 2026-07-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from shared.database import GUID

revision: str = "0002_price_monitoring"
down_revision: str | None = "0001_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "price_snapshots",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("origin_iata", sa.String(3), nullable=False),
        sa.Column("destination_iata", sa.String(3), nullable=False),
        sa.Column("departure_date", sa.Date(), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=True),
        sa.Column("cabin_class", sa.String(30), nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="BRL"),
        sa.Column("airline_iata", sa.String(3), nullable=True),
        sa.Column("source_provider", sa.String(30), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_price_snapshots_origin_iata", "price_snapshots", ["origin_iata"])
    op.create_index("ix_price_snapshots_destination_iata", "price_snapshots", ["destination_iata"])
    op.create_index("ix_price_snapshots_collected_at", "price_snapshots", ["collected_at"])
    op.create_index(
        "ix_price_snapshots_route_lookup",
        "price_snapshots",
        ["origin_iata", "destination_iata", "cabin_class", "collected_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_price_snapshots_route_lookup", table_name="price_snapshots")
    op.drop_index("ix_price_snapshots_collected_at", table_name="price_snapshots")
    op.drop_index("ix_price_snapshots_destination_iata", table_name="price_snapshots")
    op.drop_index("ix_price_snapshots_origin_iata", table_name="price_snapshots")
    op.drop_table("price_snapshots")
