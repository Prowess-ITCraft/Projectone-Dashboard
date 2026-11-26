"""Customers, sites, projects and everything stored per project.

Customers, sites and projects have their own tables with the columns the server filters and joins on; the rest of
each record, as the frontend writes it, is kept in `data`. Documents, order lines, modules and entitlements are
project records: one table keyed by (store, id) and tied to a project, so access by assignment is one join. Their
rules still run in the frontend's data layer for now (ADR 0005); the server decides who may read and write them.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

PROJECT_RECORD_STORES = ("documents", "lines", "modules", "entitlements")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(300))
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)


class Site(Base):
    """A customer's branch or site. A project covers zero or more of them."""

    __tablename__ = "sites"
    __table_args__ = (Index("ix_sites_customer_id", "customer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (Index("ix_projects_customer_id", "customer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"))
    status: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)


class ProjectRecord(Base):
    __tablename__ = "project_records"
    __table_args__ = (
        CheckConstraint(f"store IN ({', '.join(repr(s) for s in PROJECT_RECORD_STORES)})", name="known_store"),
        Index("ix_project_records_project_id", "project_id", "store"),
    )

    store: Mapped[str] = mapped_column(String(40), primary_key=True)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StoredFile(Base):
    """An uploaded original (PDF, Word or Excel). Kept in the database until an object store arrives."""

    __tablename__ = "stored_files"
    __table_args__ = (Index("ix_stored_files_project_id", "project_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(300))
    media_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AppRecord(Base):
    """Shared records that belong to no project: the classification rules and the component checklist pages."""

    __tablename__ = "app_records"

    store: Mapped[str] = mapped_column(String(40), primary_key=True)
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectAssignment(Base):
    """An engineer is on a project from `assigned_at` until `removed_at`. A row is never deleted, so the history of who
    worked on a project stays. This table means project membership only: assigning a single checklist step later is a
    separate table that points at a step and requires an active row here."""

    __tablename__ = "project_assignments"
    __table_args__ = (
        Index(
            "uq_project_assignments_active",
            "project_id",
            "engineer_id",
            unique=True,
            postgresql_where=text("removed_at IS NULL"),
        ),
        Index("ix_project_assignments_engineer_id", "engineer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    engineer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    assigned_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    removed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class Notification(Base):
    """An in-app alert for one user. No email or text message is sent."""

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_id_created_at", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChecklistStep(Base):
    """One step of a project's checklist. The table starts empty: steps are added once they are defined, and the
    screen already shows them in their phase with these columns."""

    __tablename__ = "checklist_steps"
    __table_args__ = (
        CheckConstraint("phase IN ('installation', 'configuration')", name="known_phase"),
        CheckConstraint("progress BETWEEN 0 AND 100", name="progress_percent"),
        CheckConstraint("state IN ('pending', 'awaiting_evidence', 'complete')", name="known_state"),
        Index("ix_checklist_steps_project_id", "project_id", "phase", "position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    phase: Mapped[str] = mapped_column(String(20))
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    done: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # pending -> awaiting_evidence -> complete; `done` is true exactly when the state is complete
    state: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    progress: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChecklistEvidence(Base):
    """A file an engineer attached to a step. The bytes are in `stored_files`; this row links them to the step and
    records who uploaded them and when."""

    __tablename__ = "checklist_evidence"
    __table_args__ = (Index("ix_checklist_evidence_step_id", "step_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    step_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("checklist_steps.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stored_files.id", ondelete="CASCADE"))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChecklistComment(Base):
    """A comment on a step. Comments are only ever added: no route edits or deletes one."""

    __tablename__ = "checklist_comments"
    __table_args__ = (Index("ix_checklist_comments_step_id", "step_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    step_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("checklist_steps.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
