"""Backfill blank environment keys used by the rollout selector.

Revision ID: 20260907_repair_env_keys
Revises: 20260907_repair_override_times
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_repair_env_keys"
down_revision = "20260907_repair_override_times"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE environments "
            "SET key = LOWER(REPLACE(TRIM(name), ' ', '_')) "
            "WHERE key IS NULL OR BTRIM(key) = ''"
        )
    )


def downgrade() -> None:
    # Keys are data derived from names; keep them on downgrade.
    pass
