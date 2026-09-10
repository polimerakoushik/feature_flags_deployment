"""Add timestamps required by the environment override ORM model.

Revision ID: 20260907_repair_override_times
Revises: 20260907_repair_env_override
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_repair_override_times"
down_revision = "20260907_repair_env_override"
branch_labels = None
depends_on = None


def _columns() -> set[str]:
    return {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns(
            "environment_flag_overrides"
        )
    }


def upgrade() -> None:
    columns = _columns()
    if "created_at" not in columns:
        op.add_column(
            "environment_flag_overrides",
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=True,
                server_default=sa.func.now(),
            ),
        )
        op.execute(
            "UPDATE environment_flag_overrides "
            "SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)"
        )
        op.alter_column(
            "environment_flag_overrides",
            "created_at",
            nullable=False,
            server_default=None,
        )

    if "updated_at" not in columns:
        op.add_column(
            "environment_flag_overrides",
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=True,
                server_default=sa.func.now(),
            ),
        )
        op.execute(
            "UPDATE environment_flag_overrides "
            "SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)"
        )
        op.alter_column(
            "environment_flag_overrides",
            "updated_at",
            nullable=False,
            server_default=None,
        )


def downgrade() -> None:
    columns = _columns()
    if "updated_at" in columns:
        op.drop_column("environment_flag_overrides", "updated_at")
    if "created_at" in columns:
        op.drop_column("environment_flag_overrides", "created_at")
