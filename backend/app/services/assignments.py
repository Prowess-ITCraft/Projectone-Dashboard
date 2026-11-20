"""Assigning engineers to projects. Each change notifies the engineer it concerns, and only that engineer, and is
written to the audit log where the project's activity feed shows it."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.models import Customer, Project, ProjectAssignment, User
from app.services import audit
from app.services.access import sees_all_projects
from app.services.auth import utcnow
from app.services.notifications import notify
from app.services.permissions import require


@dataclass
class Assigned:
    project_id: uuid.UUID
    engineer_id: uuid.UUID
    full_name: str
    email: str
    assigned_at: datetime


async def active_for_projects(session: AsyncSession, project_ids: set[uuid.UUID] | None) -> list[Assigned]:
    """Active assignments of these projects (None: of every project), oldest first."""
    query = (
        select(ProjectAssignment, User)
        .join(User, User.id == ProjectAssignment.engineer_id)
        .where(ProjectAssignment.removed_at.is_(None))
        .order_by(ProjectAssignment.assigned_at, User.full_name)
    )
    if project_ids is not None:
        query = query.where(ProjectAssignment.project_id.in_(project_ids))
    rows = await session.execute(query)
    return [Assigned(a.project_id, u.id, u.full_name, u.email, a.assigned_at) for a, u in rows.all()]


async def _label(session: AsyncSession, project: Project) -> str:
    customer = await session.get(Customer, project.customer_id)
    return f"{project.number}, {customer.name}" if customer else project.number


async def _record(session: AsyncSession, actor: User, action: str, project: Project, engineer: User) -> None:
    await audit.record(
        session,
        actor=actor,
        action=action,
        subject_type="project",
        subject_id=str(project.id),
        subject_label=engineer.full_name,
        details={"projectId": str(project.id), "subject": engineer.full_name, "actor": audit.actor_details(actor)},
    )


async def set_engineers(session: AsyncSession, actor: User, project: Project, engineer_ids: list[uuid.UUID]) -> None:
    """Makes the project's active engineers exactly this list: new ones are assigned, missing ones removed."""
    await require(session, actor, "assign_engineers", "Only an Admin can assign engineers.")
    wanted = list(dict.fromkeys(engineer_ids))
    engineers: dict[uuid.UUID, User] = {}
    for engineer_id in wanted:
        user = await session.get(User, engineer_id)
        # an account that sees every project anyway (an Admin) is not assigned
        if user is None or not user.is_active or await sees_all_projects(session, user):
            raise AppError("not_an_engineer", "Choose active engineers only.", status=400)
        engineers[engineer_id] = user
    current = {
        a.engineer_id: a
        for a in (
            await session.execute(
                select(ProjectAssignment).where(
                    ProjectAssignment.project_id == project.id, ProjectAssignment.removed_at.is_(None)
                )
            )
        ).scalars()
    }
    label = await _label(session, project)
    now = utcnow()
    for engineer_id, user in engineers.items():
        if engineer_id in current:
            continue
        session.add(
            ProjectAssignment(project_id=project.id, engineer_id=engineer_id, assigned_by=actor.id, assigned_at=now)
        )
        notify(
            session,
            user_id=engineer_id,
            type="project_assigned",
            title="New project assigned",
            message=f"New project assigned: {label}",
            project_id=project.id,
        )
        await _record(session, actor, "engineer_assigned", project, user)
    for engineer_id, row in current.items():
        if engineer_id in engineers:
            continue
        await _remove(session, actor, project, row, label, now)
    await session.flush()


async def remove_engineer(session: AsyncSession, actor: User, project: Project, engineer_id: uuid.UUID) -> None:
    await require(session, actor, "assign_engineers", "Only an Admin can remove engineers.")
    row = (
        await session.execute(
            select(ProjectAssignment).where(
                ProjectAssignment.project_id == project.id,
                ProjectAssignment.engineer_id == engineer_id,
                ProjectAssignment.removed_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise AppError("not_assigned", "That engineer is not on this project.", status=404)
    await _remove(session, actor, project, row, await _label(session, project), utcnow())
    await session.flush()


async def _remove(
    session: AsyncSession, actor: User, project: Project, row: ProjectAssignment, label: str, now: datetime
) -> None:
    row.removed_at = now
    row.removed_by = actor.id
    engineer = await session.get(User, row.engineer_id)
    notify(
        session,
        user_id=row.engineer_id,
        type="project_removed",
        title="Removed from a project",
        message=f"Removed from project: {label}",
        project_id=project.id,
    )
    if engineer:
        await _record(session, actor, "engineer_removed", project, engineer)
