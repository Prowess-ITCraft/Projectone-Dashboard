import uuid

from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, SessionDep
from app.schemas.common import AssignmentOut, SetEngineersIn
from app.services import assignments
from app.services.access import visible_project, visible_project_ids

router = APIRouter(tags=["projects"])


def _out(rows: list[assignments.Assigned]) -> list[AssignmentOut]:
    return [AssignmentOut.model_validate(r, from_attributes=True) for r in rows]


@router.get("/assignments", response_model=list[AssignmentOut])
async def list_assignments(user: CurrentUser, session: SessionDep) -> list[AssignmentOut]:
    """Active assignments the user may see: every one for an Admin, their own for an engineer."""
    return _out(await assignments.active_for_projects(session, await visible_project_ids(session, user)))


@router.get("/projects/{project_id}/assignments", response_model=list[AssignmentOut])
async def project_assignments(project_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> list[AssignmentOut]:
    project = await visible_project(session, user, project_id)
    return _out(await assignments.active_for_projects(session, {project.id}))


@router.put("/projects/{project_id}/assignments", response_model=list[AssignmentOut])
async def set_project_engineers(
    project_id: uuid.UUID, body: SetEngineersIn, user: CurrentUser, session: SessionDep
) -> list[AssignmentOut]:
    project = await visible_project(session, user, project_id)
    await assignments.set_engineers(session, user, project, body.engineer_ids)
    return _out(await assignments.active_for_projects(session, {project.id}))


@router.delete("/projects/{project_id}/assignments/{engineer_id}", status_code=204)
async def remove_project_engineer(
    project_id: uuid.UUID, engineer_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> Response:
    project = await visible_project(session, user, project_id)
    await assignments.remove_engineer(session, user, project, engineer_id)
    return Response(status_code=204)
