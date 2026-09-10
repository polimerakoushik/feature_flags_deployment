"""Reconcile deploy schema for analytics, cleanup, and current ownership columns.

Revision ID: 20260830_day16_21_deploy_schema
Revises: 20260818_environment_rollout_and_cache_support
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa

revision = "20260830_day16_21_deploy_schema"
down_revision = "20260818_environment_rollout_and_cache_support"
branch_labels = None
depends_on = None


def _columns(table_name):
    bind = op.get_bind()
    return {c["name"] for c in sa.inspect(bind).get_columns(table_name)}


def _tables():
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    tables = _tables()

    # Current SQLAlchemy models use owner_id for flags/environments. Preserve old
    # owner_user_id data when upgrading projects created with the earlier migration.
    if "flags" in tables:
        cols = _columns("flags")
        if "owner_id" not in cols:
            op.add_column("flags", sa.Column("owner_id", sa.Integer(), nullable=True))
            if "owner_user_id" in cols:
                op.execute("UPDATE flags SET owner_id = owner_user_id WHERE owner_id IS NULL")
            op.create_foreign_key("fk_flags_owner_id_current", "flags", "users", ["owner_id"], ["id"])
        op.create_index("ix_flags_owner_id_current", "flags", ["owner_id"], unique=False)
        op.create_index("ix_flags_key_current", "flags", ["key"], unique=False)
        op.create_index("ix_flags_key_environment", "flags", ["key", "environment"], unique=False)
        unique_names = {item.get("name") for item in sa.inspect(op.get_bind()).get_unique_constraints("flags")}
        if "uq_flags_owner_key_current" not in unique_names and "uq_flags_owner_key" not in unique_names:
            op.create_unique_constraint("uq_flags_owner_key_current", "flags", ["owner_id", "key"])

    if "environments" in tables:
        cols = _columns("environments")
        if "owner_id" not in cols:
            op.add_column("environments", sa.Column("owner_id", sa.Integer(), nullable=True))
            if "owner_user_id" in cols:
                op.execute("UPDATE environments SET owner_id = owner_user_id WHERE owner_id IS NULL")
            op.create_foreign_key("fk_environments_owner_id_current", "environments", "users", ["owner_id"], ["id"])
        op.create_index("ix_environments_owner_id_current", "environments", ["owner_id"], unique=False)
        unique_names = {item.get("name") for item in sa.inspect(op.get_bind()).get_unique_constraints("environments")}
        if "uq_environments_owner_key_current" not in unique_names:
            op.create_unique_constraint("uq_environments_owner_key_current", "environments", ["owner_id", "key"])

    if "evaluation_metrics" not in tables:
        op.create_table(
            "evaluation_metrics",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("flag_key", sa.String(), nullable=False),
            sa.Column("environment", sa.String(), nullable=False),
            sa.Column("bucket", sa.DateTime(timezone=False), nullable=False),
            sa.Column("evaluations", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=False), server_default=sa.func.now()),
            sa.UniqueConstraint("flag_key", "environment", "bucket", name="uq_flag_env_bucket"),
        )
        op.create_index("ix_evaluation_metrics_flag_key", "evaluation_metrics", ["flag_key"])
        op.create_index("ix_evaluation_metrics_environment", "evaluation_metrics", ["environment"])
        op.create_index("ix_evaluation_metrics_bucket", "evaluation_metrics", ["bucket"])
        op.create_index("ix_evaluation_metrics_flag_env", "evaluation_metrics", ["flag_key", "environment"])

    if "cleanup_candidates" not in tables:
        op.create_table(
            "cleanup_candidates",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("flag_id", sa.Integer(), sa.ForeignKey("flags.id"), nullable=False),
            sa.Column("candidate_type", sa.String(), nullable=False),
            sa.Column("eligible_since", sa.DateTime(timezone=True), nullable=False),
            sa.Column("reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("review_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_cleanup_candidates_flag_id", "cleanup_candidates", ["flag_id"])
        op.create_index("ix_cleanup_candidates_reviewed", "cleanup_candidates", ["reviewed"])
        op.create_index("ix_cleanup_candidates_eligible_since", "cleanup_candidates", ["eligible_since"])

    if "admin_settings" not in tables:
        op.create_table(
            "admin_settings",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("key", sa.String(), nullable=False, unique=True),
            sa.Column("value", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_admin_settings_key", "admin_settings", ["key"], unique=True)


def downgrade() -> None:
    tables = _tables()
    if "admin_settings" in tables:
        op.drop_table("admin_settings")
    if "cleanup_candidates" in tables:
        op.drop_table("cleanup_candidates")
    if "evaluation_metrics" in tables:
        op.drop_table("evaluation_metrics")
