"""Accounts with sign-in, projects in the database, assignments, notifications and checklist steps

Revision ID: 0003
Revises: 0002

The users table is rebuilt: before this migration it held only the invented development accounts, which have no
email or password, so nothing of value is lost.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Frozen copy of the matrix at the time of this migration. A test checks it still equals app.domain.role_matrix.
ROLES = {"admin": "Admin", "engineer": "Engineer"}
ENGINEER = ["upload", "edit_lines", "classify"]
ADMIN = [
    *ENGINEER,
    "create_project",
    "confirm_classification",
    "confirm_intake",
    "reopen",
    "set_delivery",
    "resolve_duplicate",
    "reset_data",
    "manage_users",
    "set_project_status",
    "assign_engineers",
    "view_all_projects",
]

# The matrix as migration 0002 left it, restored on downgrade
PREVIOUS_ENGINEER = ["create_project", "upload", "edit_lines", "classify", "confirm_classification"]
PREVIOUS_ADMIN = [
    *PREVIOUS_ENGINEER,
    "confirm_intake",
    "reopen",
    "set_delivery",
    "resolve_duplicate",
    "reset_data",
    "manage_users",
]

NOW = sa.text("now()")


def _set_matrix(admin: list[str], engineer: list[str]) -> None:
    op.execute("DELETE FROM role_actions")
    table = sa.table("role_actions", sa.column("role_key", sa.String), sa.column("action", sa.String))
    op.bulk_insert(
        table,
        [{"role_key": "admin", "action": a} for a in admin] + [{"role_key": "engineer", "action": a} for a in engineer],
    )


def upgrade() -> None:
    op.drop_table("users")
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("role", sa.String(40), sa.ForeignKey("roles.key", name="fk_users_role_roles"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint("email = lower(email)", name="ck_users_email_lowercase"),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_sessions_user_id_users"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("ip", sa.String(64), nullable=False),
        sa.Column("succeeded", sa.Boolean(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_login_attempts_email_at", "login_attempts", ["email", "at"])
    op.create_index("ix_login_attempts_ip_at", "login_attempts", ["ip", "at"])
    op.add_column("audit_log", sa.Column("details", postgresql.JSONB(), nullable=True))

    op.create_table(
        "customers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("number", sa.String(20), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("gstin", sa.String(15), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.UniqueConstraint("number", name="uq_customers_number"),
    )
    op.create_table(
        "sites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "customer_id",
            sa.Uuid(),
            sa.ForeignKey("customers.id", ondelete="CASCADE", name="fk_sites_customer_id_customers"),
            nullable=False,
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False),
    )
    op.create_index("ix_sites_customer_id", "sites", ["customer_id"])
    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("number", sa.String(20), nullable=False),
        sa.Column(
            "customer_id",
            sa.Uuid(),
            sa.ForeignKey("customers.id", name="fk_projects_customer_id_customers"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.UniqueConstraint("number", name="uq_projects_number"),
    )
    op.create_index("ix_projects_customer_id", "projects", ["customer_id"])
    op.create_table(
        "project_records",
        sa.Column("store", sa.String(40), primary_key=True),
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("projects.id", ondelete="CASCADE", name="fk_project_records_project_id_projects"),
            nullable=False,
        ),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.CheckConstraint(
            "store IN ('documents', 'lines', 'modules', 'entitlements')", name="ck_project_records_known_store"
        ),
    )
    op.create_index("ix_project_records_project_id", "project_records", ["project_id", "store"])
    op.create_table(
        "stored_files",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("projects.id", ondelete="CASCADE", name="fk_stored_files_project_id_projects"),
            nullable=False,
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("media_type", sa.String(120), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_stored_files_project_id", "stored_files", ["project_id"])
    op.create_table(
        "app_records",
        sa.Column("store", sa.String(40), primary_key=True),
        sa.Column("id", sa.String(80), primary_key=True),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_table(
        "project_assignments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("projects.id", ondelete="CASCADE", name="fk_project_assignments_project_id_projects"),
            nullable=False,
        ),
        sa.Column(
            "engineer_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", name="fk_project_assignments_engineer_id_users"),
            nullable=False,
        ),
        sa.Column(
            "assigned_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", name="fk_project_assignments_assigned_by_users"),
            nullable=False,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "removed_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", name="fk_project_assignments_removed_by_users"),
            nullable=True,
        ),
    )
    op.create_index(
        "uq_project_assignments_active",
        "project_assignments",
        ["project_id", "engineer_id"],
        unique=True,
        postgresql_where=sa.text("removed_at IS NULL"),
    )
    op.create_index("ix_project_assignments_engineer_id", "project_assignments", ["engineer_id"])
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_notifications_user_id_users"),
            nullable=False,
        ),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("projects.id", ondelete="SET NULL", name="fk_notifications_project_id_projects"),
            nullable=True,
        ),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_notifications_user_id_created_at", "notifications", ["user_id", "created_at"])
    op.create_table(
        "checklist_steps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("projects.id", ondelete="CASCADE", name="fk_checklist_steps_project_id_projects"),
            nullable=False,
        ),
        sa.Column("phase", sa.String(20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("progress", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("comments", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.CheckConstraint("phase IN ('installation', 'configuration')", name="ck_checklist_steps_known_phase"),
        sa.CheckConstraint("progress BETWEEN 0 AND 100", name="ck_checklist_steps_progress_percent"),
    )
    op.create_index("ix_checklist_steps_project_id", "checklist_steps", ["project_id", "phase", "position"])

    _set_matrix(ADMIN, ENGINEER)


def downgrade() -> None:
    _set_matrix(PREVIOUS_ADMIN, PREVIOUS_ENGINEER)
    for table in (
        "checklist_steps",
        "notifications",
        "project_assignments",
        "app_records",
        "stored_files",
        "project_records",
        "projects",
        "sites",
        "customers",
        "login_attempts",
        "sessions",
        "users",
    ):
        op.drop_table(table)
    op.drop_column("audit_log", "details")
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
