"""space weather events from NASA DONKI

Revision ID: 0004_space_weather
Revises: 0003_link_timing
Create Date: 2026-11-14
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0004_space_weather"
down_revision = "0003_link_timing"
branch_labels = None
depends_on = None

TS = sa.TIMESTAMP(timezone=True)


def upgrade() -> None:
    op.create_table(
        "space_weather",
        sa.Column("event_id", sa.Text, primary_key=True),           # DONKI's own id (sepID, activityID, ...)
        sa.Column("kind", sa.Text, nullable=False),                 # SEP | CME | GST | RBE
        sa.Column("start_time", TS, nullable=False),
        sa.Column("severity", sa.Text, nullable=False),             # info | caution | warning
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("link", sa.Text),
        sa.Column("origin", sa.Text, nullable=False),               # live | snapshot
        sa.Column("raw", JSONB, nullable=False),
        sa.Column("fetched_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("space_weather_time", "space_weather", [sa.text("start_time DESC")])


def downgrade() -> None:
    op.drop_table("space_weather")
