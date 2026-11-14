"""link timing: hand-off time per bundle/reply, explicit short-window state

Revision ID: 0003_link_timing
Revises: 0002_events
Create Date: 2026-11-14
"""
import sqlalchemy as sa
from alembic import op

revision = "0003_link_timing"
down_revision = "0002_events"
branch_labels = None
depends_on = None

TS = sa.TIMESTAMP(timezone=True)


def upgrade() -> None:
    op.add_column("bundles", sa.Column("sent_at", TS))          # handed to the link (BPv7 node)
    op.add_column("replies", sa.Column("sent_at", TS))
    op.add_column("link_state", sa.Column("window_until", TS))  # set while state = 'window'


def downgrade() -> None:
    op.drop_column("link_state", "window_until")
    op.drop_column("replies", "sent_at")
    op.drop_column("bundles", "sent_at")
