"""A project's checklist. Every route first finds the project among those the user may see (404 otherwise), then the
service checks the permission (403). An engineer has three actions here: complete a step, add or remove evidence on a
step that awaits it, and comment. Everything that changes the structure or content of a checklist needs
`manage_checklist`, which only an Admin has."""

import uuid

from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, SessionDep, SettingsDep
from app.schemas.common import ChecklistOut, CommentIn, EvidenceIn, StepIn, StepOrderIn, StepPatch
from app.services import checklist
from app.services.access import visible_project

router = APIRouter(prefix="/projects/{project_id}/checklist", tags=["checklist"])

EXTENSION_OF = {"image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "application/pdf": "pdf"}


@router.get("", response_model=ChecklistOut)
async def get_checklist(
    project_id: uuid.UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> ChecklistOut:
    project = await visible_project(session, user, project_id)
    return await checklist.load(session, user, project, settings)


@router.get("/export.csv")
async def export(project_id: uuid.UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep) -> Response:
    project = await visible_project(session, user, project_id)
    text = await checklist.export_csv(session, user, project, settings)
    filename = project.number.replace("/", "-")
    return Response(
        content=text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}-checklist.csv"'},
    )


@router.get("/evidence/{evidence_id}/content")
async def evidence_content(
    project_id: uuid.UUID, evidence_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> Response:
    project = await visible_project(session, user, project_id)
    file = await checklist.evidence_file(session, project, evidence_id)
    inline = file.media_type != "image/heic"  # browsers cannot show HEIC, so it downloads
    extension = EXTENSION_OF.get(file.media_type, "bin")
    return Response(
        content=file.content,
        media_type=file.media_type,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Content-Disposition": f'{"inline" if inline else "attachment"}; filename="evidence.{extension}"',
        },
    )


# the engineer's actions


@router.post("/steps/{step_id}/complete", status_code=204)
async def complete_step(project_id: uuid.UUID, step_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await checklist.complete(session, user, await visible_project(session, user, project_id), step_id)
    return Response(status_code=204)


@router.post("/steps/{step_id}/untick", status_code=204)
async def untick_step(project_id: uuid.UUID, step_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await checklist.untick(session, user, await visible_project(session, user, project_id), step_id)
    return Response(status_code=204)


@router.post("/steps/{step_id}/evidence", status_code=204)
async def add_evidence(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    body: EvidenceIn,
    user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> Response:
    project = await visible_project(session, user, project_id)
    await checklist.add_evidence(session, user, settings, project, step_id, body.name, body.content)
    return Response(status_code=204)


@router.delete("/steps/{step_id}/evidence/{evidence_id}", status_code=204)
async def remove_evidence(
    project_id: uuid.UUID, step_id: uuid.UUID, evidence_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> Response:
    project = await visible_project(session, user, project_id)
    await checklist.remove_evidence(session, user, project, step_id, evidence_id)
    return Response(status_code=204)


@router.post("/steps/{step_id}/comments", status_code=204)
async def add_comment(
    project_id: uuid.UUID, step_id: uuid.UUID, body: CommentIn, user: CurrentUser, session: SessionDep
) -> Response:
    await checklist.add_comment(session, user, await visible_project(session, user, project_id), step_id, body.body)
    return Response(status_code=204)


# Admin only


@router.post("/steps", status_code=201)
async def create_step(project_id: uuid.UUID, body: StepIn, user: CurrentUser, session: SessionDep) -> dict[str, str]:
    step = await checklist.create_step(session, user, await visible_project(session, user, project_id), body)
    return {"id": str(step.id)}


@router.put("/order", status_code=204)
async def reorder(project_id: uuid.UUID, body: StepOrderIn, user: CurrentUser, session: SessionDep) -> Response:
    await checklist.reorder(session, user, await visible_project(session, user, project_id), body.step_ids)
    return Response(status_code=204)


@router.patch("/steps/{step_id}", status_code=204)
async def update_step(
    project_id: uuid.UUID, step_id: uuid.UUID, body: StepPatch, user: CurrentUser, session: SessionDep
) -> Response:
    await checklist.update_step(session, user, await visible_project(session, user, project_id), step_id, body)
    return Response(status_code=204)


@router.delete("/steps/{step_id}", status_code=204)
async def delete_step(project_id: uuid.UUID, step_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await checklist.delete_step(session, user, await visible_project(session, user, project_id), step_id)
    return Response(status_code=204)


@router.post("/steps/{step_id}/reset", status_code=204)
async def reset_step(project_id: uuid.UUID, step_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await checklist.reset_step(session, user, await visible_project(session, user, project_id), step_id)
    return Response(status_code=204)


@router.post("/steps/{step_id}/force-complete", status_code=204)
async def force_complete(project_id: uuid.UUID, step_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await checklist.force_complete(session, user, await visible_project(session, user, project_id), step_id)
    return Response(status_code=204)
