"""initial schema: readings, alerts, check-ins, MEDLINK outbox, Earth inbox, replies, link state

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-14
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

TS = sa.TIMESTAMP(timezone=True)


def upgrade() -> None:
    op.create_table(
        "readings",
        sa.Column("id", sa.BigInteger, sa.Identity(), primary_key=True),
        sa.Column("astronaut_id", sa.Text, nullable=False),
        sa.Column("ts", TS, nullable=False),
        sa.Column("heart_rate", sa.REAL, nullable=False),
        sa.Column("spo2", sa.REAL),
        sa.Column("activity", sa.Text, nullable=False),
        sa.Column("signal_quality", sa.Text, nullable=False),
        sa.Column("source", sa.Text, nullable=False),
    )
    op.create_index("readings_astronaut_ts", "readings", ["astronaut_id", sa.text("ts DESC")])

    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.Text, primary_key=True),
        sa.Column("astronaut_id", sa.Text, nullable=False),
        sa.Column("ts", TS, nullable=False),
        sa.Column("metric", sa.Text, nullable=False),
        sa.Column("value", sa.REAL, nullable=False),
        sa.Column("baseline", sa.REAL),
        sa.Column("deviation", sa.REAL),
        sa.Column("severity", sa.Text, nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("activity", sa.Text, nullable=False),
        sa.Column("signal_quality", sa.Text, nullable=False),
        sa.Column("todo", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("done", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )

    op.create_table(
        "checkins",
        sa.Column("id", sa.BigInteger, sa.Identity(), primary_key=True),
        sa.Column("astronaut_id", sa.Text, nullable=False),
        sa.Column("ts", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("feeling", sa.Text, nullable=False),
        sa.Column("symptom", sa.Text),
    )

    # MEDLINK outbox on the spacecraft: one row per PulseBrief layer.
    op.create_table(
        "bundles",
        sa.Column("bundle_id", sa.Text, primary_key=True),
        sa.Column("brief_id", sa.Text, nullable=False),
        sa.Column("layer", sa.Text, nullable=False),
        sa.Column("layer_rank", sa.SmallInteger, nullable=False),
        sa.Column("severity", sa.Text, nullable=False),
        sa.Column("severity_rank", sa.SmallInteger, nullable=False),
        sa.Column("payload", sa.LargeBinary, nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="queued"),
        sa.Column("created", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("delivered_at", TS),
    )
    op.create_index("bundles_queue", "bundles",
                    ["status", "layer_rank", sa.text("severity_rank DESC"), "created"])

    # What Earth has received; the primary key drops duplicate deliveries.
    op.create_table(
        "earth_inbox",
        sa.Column("bundle_id", sa.Text, primary_key=True),
        sa.Column("brief_id", sa.Text, nullable=False),
        sa.Column("layer", sa.Text, nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("received_at", TS, nullable=False, server_default=sa.func.now()),
    )

    # Earth -> spacecraft replies, queued until the link is up.
    op.create_table(
        "replies",
        sa.Column("reply_id", sa.Text, primary_key=True),
        sa.Column("brief_id", sa.Text, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("author", sa.Text, nullable=False),
        sa.Column("created", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("status", sa.Text, nullable=False, server_default="queued"),
        sa.Column("delivered_at", TS),
    )

    op.create_table(
        "link_state",
        sa.Column("id", sa.SmallInteger, primary_key=True, server_default="1"),
        sa.Column("state", sa.Text, nullable=False, server_default="up"),
        sa.Column("bytes_sent", sa.BigInteger, nullable=False, server_default="0"),
        sa.CheckConstraint("id = 1", name="link_state_single_row"),
    )
    op.execute("INSERT INTO link_state (id) VALUES (1)")


def downgrade() -> None:
    for table in ("link_state", "replies", "earth_inbox", "bundles", "checkins", "alerts", "readings"):
        op.drop_table(table)
