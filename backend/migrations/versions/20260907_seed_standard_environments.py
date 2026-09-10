"""Ensure the rollout selector has the standard environments.

Revision ID: 20260907_seed_standard_environments
Revises: 20260907_repair_env_keys
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_seed_standard_envs"
down_revision = "20260907_repair_env_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    for key, name in (
        ("development", "Development"),
        ("staging", "Staging"),
        ("production", "Production"),
    ):
        connection.execute(
            sa.text(
                "INSERT INTO environments (name, key, is_active, owner_id) "
                "SELECT :name, :key, TRUE, NULL "
                "WHERE NOT EXISTS ("
                "SELECT 1 FROM environments "
                "WHERE LOWER(key) = CAST(:key AS VARCHAR)"
                ")"
            ),
            {"name": name, "key": key},
        )


def downgrade() -> None:
    # Keep seeded environments because rollout overrides may reference them.
    pass
