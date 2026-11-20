"""Marks accounts that still hold the shared default engineer password

Revision ID: 0004
Revises: 0003

Existing accounts get false: their passwords were random, so there is no default to hand out for them until an Admin
resets them to the default.
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_is_default", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "password_is_default")
