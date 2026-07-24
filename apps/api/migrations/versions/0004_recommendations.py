"""recommendations module: ai_recommendations, mileage_valuations, exchange_rates
(com seed de dados de referência — ver docs/04-modelo-dados.md, seção 5.2)

Revision ID: 0004_recommendations
Revises: 0003_alerts_notifications
Create Date: 2026-07-24
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

from shared.database import GUID

revision: str = "0004_recommendations"
down_revision: str | None = "0003_alerts_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Valores de referência (cents-per-mile em BRL) curados manualmente — não são uma
# integração ao vivo com os programas. Atualizar periodicamente à mão até a Fase Beta
# validar se compensa integrar isso de forma dinâmica (ver docs/08-revisao-estrategica-latam.md).
MILEAGE_SEED = [
    ("SMILES", "Smiles (GOL)", 2.0),
    ("LATAM_PASS", "LATAM Pass", 2.2),
    ("TUDOAZUL", "TudoAzul (Azul)", 1.9),
    ("LIFEMILES", "LifeMiles (Avianca)", 1.5),
]


def upgrade() -> None:
    op.create_table(
        "mileage_valuations",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("program_code", sa.String(30), nullable=False, unique=True),
        sa.Column("program_name", sa.String(100), nullable=False),
        sa.Column("reference_cents_per_mile", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "exchange_rates",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("base_currency", sa.String(3), nullable=False),
        sa.Column("quote_currency", sa.String(3), nullable=False),
        sa.Column("rate", sa.Float(), nullable=False),
        sa.Column("reference_rate", sa.Float(), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_exchange_rates_collected_at", "exchange_rates", ["collected_at"])

    op.create_table(
        "ai_recommendations",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("origin_iata", sa.String(3), nullable=False),
        sa.Column("destination_iata", sa.String(3), nullable=False),
        sa.Column("cabin_class", sa.String(30), nullable=False),
        sa.Column("verdict", sa.String(30), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("current_price_cents", sa.Integer(), nullable=False),
        sa.Column("target_price_cents", sa.Integer(), nullable=False),
        sa.Column("explanation", sa.String(1000), nullable=False),
        sa.Column("factors", sa.JSON(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_recommendations_origin_iata", "ai_recommendations", ["origin_iata"])
    op.create_index("ix_ai_recommendations_destination_iata", "ai_recommendations", ["destination_iata"])
    op.create_index("ix_ai_recommendations_generated_at", "ai_recommendations", ["generated_at"])

    now = datetime.now(UTC)
    mileage_table = sa.table(
        "mileage_valuations",
        sa.column("id", GUID()),
        sa.column("program_code", sa.String),
        sa.column("program_name", sa.String),
        sa.column("reference_cents_per_mile", sa.Float),
        sa.column("updated_at", sa.DateTime),
    )
    op.bulk_insert(
        mileage_table,
        [
            {
                "id": uuid.uuid4(),
                "program_code": code,
                "program_name": name,
                "reference_cents_per_mile": value,
                "updated_at": now,
            }
            for code, name, value in MILEAGE_SEED
        ],
    )

    exchange_table = sa.table(
        "exchange_rates",
        sa.column("id", GUID()),
        sa.column("base_currency", sa.String),
        sa.column("quote_currency", sa.String),
        sa.column("rate", sa.Float),
        sa.column("reference_rate", sa.Float),
        sa.column("collected_at", sa.DateTime),
    )
    op.bulk_insert(
        exchange_table,
        [
            {
                "id": uuid.uuid4(),
                "base_currency": "USD",
                "quote_currency": "BRL",
                "rate": 5.05,
                "reference_rate": 5.05,
                "collected_at": now,
            }
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_recommendations_generated_at", table_name="ai_recommendations")
    op.drop_index("ix_ai_recommendations_destination_iata", table_name="ai_recommendations")
    op.drop_index("ix_ai_recommendations_origin_iata", table_name="ai_recommendations")
    op.drop_table("ai_recommendations")
    op.drop_index("ix_exchange_rates_collected_at", table_name="exchange_rates")
    op.drop_table("exchange_rates")
    op.drop_table("mileage_valuations")
