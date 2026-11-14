"""mission events log

Revision ID: 0002_events
Revises: 0001_initial
Create Date: 2026-11-14
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002_events"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.BigInteger, sa.Identity(), primary_key=True),
        sa.Column("ts", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )


def downgrade() -> None:
    op.drop_table("events")
