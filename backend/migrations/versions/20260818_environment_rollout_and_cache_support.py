"""Add environment keys, activity flags, and override rollout support.

Revision ID: 20260818_environment_rollout_and_cache_support
Revises: 20260802_add_user_ownership
Create Date: 2026-08-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260818_environment_rollout_and_cache_support"
down_revision: Union[str, None] = "20260802_add_user_ownership"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("environments", sa.Column("key", sa.String(), nullable=True))
    op.add_column("environments", sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()))
    op.add_column("environment_flag_overrides", sa.Column("enabled", sa.Boolean(), nullable=True, server_default=sa.true()))
    op.add_column("environment_flag_overrides", sa.Column("rollout_percentage", sa.Integer(), nullable=True))

    op.execute("UPDATE environments SET key = LOWER(REPLACE(name, ' ', '_')) WHERE key IS NULL")
    op.execute("UPDATE environment_flag_overrides SET enabled = value WHERE enabled IS NULL")

    op.alter_column("environments", "key", nullable=False)
    op.alter_column("environments", "is_active", server_default=None)
    op.alter_column("environment_flag_overrides", "enabled", nullable=False, server_default=None)
    op.create_unique_constraint("uq_environments_key", "environments", ["key"])


def downgrade() -> None:
    op.drop_constraint("uq_environments_key", "environments", type_="unique")
    op.drop_column("environment_flag_overrides", "rollout_percentage")
    op.drop_column("environment_flag_overrides", "enabled")
    op.drop_column("environments", "is_active")
    op.drop_column("environments", "key")
