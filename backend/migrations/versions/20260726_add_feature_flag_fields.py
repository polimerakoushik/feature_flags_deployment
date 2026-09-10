"""Add type, default value, owner, and enabled fields to feature flags.

Revision ID: 20260726_add_feature_flag_fields
Revises:
Create Date: 2026-07-26
"""

from alembic import op
import sqlalchemy as sa


revision = "20260726_add_feature_flag_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("flags", "is_enabled", new_column_name="enabled")
    op.add_column("flags", sa.Column("type", sa.String(), nullable=False, server_default="boolean"))
    op.add_column("flags", sa.Column("default_value", sa.JSON(), nullable=False, server_default=sa.text("'true'::json")))
    op.add_column("flags", sa.Column("owner_team", sa.String(), nullable=True))
    op.add_column("flags", sa.Column("environment", sa.String(), nullable=False, server_default="developing"))
    op.alter_column("flags", "type", server_default=None)
    op.alter_column("flags", "default_value", server_default=None)
    op.alter_column("flags", "environment", server_default=None)


def downgrade() -> None:
    op.drop_column("flags", "owner_team")
    op.drop_column("flags", "environment")
    op.drop_column("flags", "default_value")
    op.drop_column("flags", "type")
    op.alter_column("flags", "enabled", new_column_name="is_enabled")
