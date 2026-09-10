"""Repair environment override columns in deployed databases.

Revision ID: 20260907_repair_env_override
Revises: 20260830_day16_21_deploy_schema
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_repair_env_override"
down_revision = "20260830_day16_21_deploy_schema"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    return {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns(table_name)
    }


def upgrade() -> None:
    columns = _columns("environment_flag_overrides")

    if "enabled" not in columns:
        op.add_column(
            "environment_flag_overrides",
            sa.Column("enabled", sa.Boolean(), nullable=True),
        )
        op.execute(
            "UPDATE environment_flag_overrides "
            "SET enabled = COALESCE(value, TRUE) "
            "WHERE enabled IS NULL"
        )

    if "rollout_percentage" not in columns:
        op.add_column(
            "environment_flag_overrides",
            sa.Column("rollout_percentage", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    columns = _columns("environment_flag_overrides")
    if "rollout_percentage" in columns:
        op.drop_column("environment_flag_overrides", "rollout_percentage")
    if "enabled" in columns:
        op.drop_column("environment_flag_overrides", "enabled")
