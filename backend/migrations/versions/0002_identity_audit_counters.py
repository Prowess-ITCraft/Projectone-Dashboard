"""Roles, permissions, users, audit log, settings and counters

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Frozen copy of the matrix at the time of this migration. A test checks it still equals app.domain.role_matrix,
# so a later change to the matrix has to arrive as a new migration and not as a silent edit of this one.
ROLES = {"admin": "Admin", "engineer": "Engineer"}
ENGINEER = ["create_project", "upload", "edit_lines", "classify", "confirm_classification"]
ADMIN = [
    *ENGINEER,
    "confirm_intake",
    "reopen",
    "set_delivery",
    "resolve_duplicate",
    "reset_data",
    "manage_users",
]


def upgrade() -> None:
    roles = op.create_table(
        "roles",
        sa.Column("key", sa.String(40), primary_key=True),
        sa.Column("label", sa.String(80), nullable=False),
    )
    role_actions = op.create_table(
        "role_actions",
        sa.Column("role_key", sa.String(40), sa.ForeignKey("roles.key", ondelete="CASCADE"), primary_key=True),
        sa.Column("action", sa.String(80), primary_key=True),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(80), nullable=False, unique=True),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("role_key", sa.String(40), sa.ForeignKey("roles.key"), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("username = lower(username)", name="ck_users_username_lowercase"),
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_label", sa.String(200), nullable=True),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("subject_type", sa.String(80), nullable=False),
        sa.Column("subject_id", sa.String(80), nullable=True),
        sa.Column("subject_label", sa.String(300), nullable=True),
        sa.Column("before", postgresql.JSONB(), nullable=True),
        sa.Column("after", postgresql.JSONB(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(64), nullable=True),
    )
    op.create_index("ix_audit_log_at", "audit_log", ["at"])
    op.create_index("ix_audit_log_subject", "audit_log", ["subject_type", "subject_id"])
    op.create_table(
        "settings",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "counters",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("value", sa.BigInteger(), nullable=False),
    )

    op.bulk_insert(roles, [{"key": k, "label": v} for k, v in ROLES.items()])
    op.bulk_insert(
        role_actions,
        [{"role_key": "admin", "action": a} for a in ADMIN] + [{"role_key": "engineer", "action": a} for a in ENGINEER],
    )

    # The audit log is append-only. The rules live in the database, so no code path, test helper or
    # mistaken script can edit or remove a row.
    op.execute(
        """
        CREATE FUNCTION audit_log_refuse_change() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP
                USING ERRCODE = 'insufficient_privilege';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        "CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON audit_log "
        "FOR EACH ROW EXECUTE FUNCTION audit_log_refuse_change()"
    )
    op.execute(
        "CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log "
        "FOR EACH STATEMENT EXECUTE FUNCTION audit_log_refuse_change()"
    )


def downgrade() -> None:
    # A downgrade is a development operation: it drops the audit table together with its rules.
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_update_delete ON audit_log")
    op.execute("DROP FUNCTION IF EXISTS audit_log_refuse_change()")
    op.drop_table("counters")
    op.drop_table("settings")
    op.drop_table("audit_log")
    op.drop_table("users")
    op.drop_table("role_actions")
    op.drop_table("roles")
