"""notifications: verificação de posse de destino (achado #2 de
docs/09-revisao-tecnica-backend.md)

Revision ID: 0005_notification_verification
Revises: 0004_recommendations
Create Date: 2026-07-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_notification_verification"
down_revision: str | None = "0004_recommendations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "notification_preferences", sa.Column("verification_code_hash", sa.String(64), nullable=True)
    )
    op.add_column(
        "notification_preferences",
        sa.Column("verification_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notification_preferences", "verification_expires_at")
    op.drop_column("notification_preferences", "verification_code_hash")
