"""Engineer checklist: step states, evidence, comments, and the narrower engineer permissions

Revision ID: 0005
Revises: 0004

Owner decision, 20 Nov 2026: an engineer may only complete a step, upload evidence and comment. The old free-text
`comments` column of a step is replaced by the comments table (the steps table was empty).
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

NOW = sa.text("now()")
OLD_ENGINEER = ("upload", "edit_lines", "classify")
NEW_ENGINEER = ("complete_step", "upload_evidence", "comment_step")


def _actions() -> sa.TableClause:
    return sa.table("role_actions", sa.column("role_key", sa.String), sa.column("action", sa.String))


def upgrade() -> None:
    op.add_column("checklist_steps", sa.Column("state", sa.String(20), server_default="pending", nullable=False))
    op.add_column("checklist_steps", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "checklist_steps",
        sa.Column(
            "completed_by", sa.Uuid(), sa.ForeignKey("users.id", name="fk_checklist_steps_completed_by"), nullable=True
        ),
    )
    op.create_check_constraint(
        "ck_checklist_steps_known_state", "checklist_steps", "state IN ('pending', 'awaiting_evidence', 'complete')"
    )
    op.execute("UPDATE checklist_steps SET state = 'complete', progress = 100 WHERE done")
    op.drop_column("checklist_steps", "comments")

    op.create_table(
        "checklist_evidence",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("step_id", sa.Uuid(), sa.ForeignKey("checklist_steps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_id", sa.Uuid(), sa.ForeignKey("stored_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_checklist_evidence_step_id", "checklist_evidence", ["step_id"])
    op.create_table(
        "checklist_comments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("step_id", sa.Uuid(), sa.ForeignKey("checklist_steps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_checklist_comments_step_id", "checklist_comments", ["step_id", "created_at"])

    op.execute("DELETE FROM role_actions WHERE role_key = 'engineer'")
    op.bulk_insert(_actions(), [{"role_key": "engineer", "action": a} for a in NEW_ENGINEER])
    op.bulk_insert(_actions(), [{"role_key": "admin", "action": "manage_checklist"}])


def downgrade() -> None:
    op.execute("DELETE FROM role_actions WHERE action = 'manage_checklist'")
    op.execute("DELETE FROM role_actions WHERE role_key = 'engineer'")
    op.bulk_insert(_actions(), [{"role_key": "engineer", "action": a} for a in OLD_ENGINEER])
    op.drop_table("checklist_comments")
    op.drop_table("checklist_evidence")
    op.add_column("checklist_steps", sa.Column("comments", sa.Text(), server_default="", nullable=False))
    op.drop_constraint("ck_checklist_steps_known_state", "checklist_steps", type_="check")
    op.drop_column("checklist_steps", "completed_by")
    op.drop_column("checklist_steps", "completed_at")
    op.drop_column("checklist_steps", "state")
