"""Which projects a user may see. A user whose role has `view_all_projects` sees every project; anyone else sees only
the projects they are actively assigned to. A project outside that set is answered as not found, so its existence is
not revealed to someone who may not see it."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import not_found
from app.models import Project, ProjectAssignment, User
from app.services.permissions import can


async def sees_all_projects(session: AsyncSession, user: User) -> bool:
    return await can(session, user, "view_all_projects")


async def assigned_project_ids(session: AsyncSession, user: User) -> set[uuid.UUID]:
    rows = await session.execute(
        select(ProjectAssignment.project_id).where(
            ProjectAssignment.engineer_id == user.id, ProjectAssignment.removed_at.is_(None)
        )
    )
    return set(rows.scalars())


async def visible_project_ids(session: AsyncSession, user: User) -> set[uuid.UUID] | None:
    """None means every project."""
    if await sees_all_projects(session, user):
        return None
    return await assigned_project_ids(session, user)


async def visible_project(session: AsyncSession, user: User, project_id: uuid.UUID) -> Project:
    project = await session.get(Project, project_id)
    if project is None:
        raise not_found("That project does not exist.")
    visible = await visible_project_ids(session, user)
    if visible is not None and project_id not in visible:
        raise not_found("That project does not exist.")
    return project


def parse_uuid(value: object) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None
