"""Add user ownership to workspace records.

Revision ID: 20260802_add_user_ownership
Revises: 20260726_add_feature_flag_fields
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260802_add_user_ownership"
down_revision: Union[str, None] = "20260726_add_feature_flag_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("flags", sa.Column("owner_user_id", sa.Integer(), nullable=True))
    op.add_column("environments", sa.Column("owner_user_id", sa.Integer(), nullable=True))
    op.add_column("audit_logs", sa.Column("owner_user_id", sa.Integer(), nullable=True))

    op.create_foreign_key("fk_flags_owner_user_id", "flags", "users", ["owner_user_id"], ["id"])
    op.create_foreign_key("fk_environments_owner_user_id", "environments", "users", ["owner_user_id"], ["id"])
    op.create_foreign_key("fk_audit_logs_owner_user_id", "audit_logs", "users", ["owner_user_id"], ["id"])

    op.drop_constraint("flags_key_key", "flags", type_="unique")
    op.create_unique_constraint("uq_flags_owner_key", "flags", ["owner_user_id", "key"])
    op.create_unique_constraint("uq_environments_owner_name", "environments", ["owner_user_id", "name"])


def downgrade() -> None:
    op.drop_constraint("uq_environments_owner_name", "environments", type_="unique")
    op.drop_constraint("uq_flags_owner_key", "flags", type_="unique")
    op.create_unique_constraint("flags_key_key", "flags", ["key"])

    op.drop_constraint("fk_audit_logs_owner_user_id", "audit_logs", type_="foreignkey")
    op.drop_constraint("fk_environments_owner_user_id", "environments", type_="foreignkey")
    op.drop_constraint("fk_flags_owner_user_id", "flags", type_="foreignkey")

    op.drop_column("audit_logs", "owner_user_id")
    op.drop_column("environments", "owner_user_id")
    op.drop_column("flags", "owner_user_id")
