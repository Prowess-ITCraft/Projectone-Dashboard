"""What an engineer sees of their work: their projects and, inside one, its order lines (read only) and checklist.
These responses are built field by field, so nothing else about a project (documents, coverage, sites, activity,
stages) can reach an engineer through them."""

import uuid
from typing import Any

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import CurrentUser, SessionDep, SettingsDep
from app.models import ChecklistStep, Customer, Project, ProjectAssignment, ProjectRecord
from app.schemas.common import MyProjectOut, WorkLineOut, WorkOut, WorkProjectOut
from app.services import checklist
from app.services.access import visible_project

router = APIRouter(tags=["work"])
ORDER_DOCUMENT_TYPES = ("pi", "po")


@router.get("/my/projects", response_model=list[MyProjectOut])
async def my_projects(user: CurrentUser, session: SessionDep) -> list[MyProjectOut]:
    """The projects the user is actively assigned to, newest assignment first."""
    rows = await session.execute(
        select(Project, Customer.name, ProjectAssignment.assigned_at)
        .join(ProjectAssignment, ProjectAssignment.project_id == Project.id)
        .join(Customer, Customer.id == Project.customer_id)
        .where(ProjectAssignment.engineer_id == user.id, ProjectAssignment.removed_at.is_(None))
        .order_by(ProjectAssignment.assigned_at.desc())
    )
    found = rows.all()
    counts: dict[uuid.UUID, tuple[int, int]] = {}
    if found:
        grouped = await session.execute(
            select(
                ChecklistStep.project_id,
                func.count(),
                func.count().filter(ChecklistStep.state == checklist.COMPLETE),
            )
            .where(ChecklistStep.project_id.in_([p.id for p, _, _ in found]))
            .group_by(ChecklistStep.project_id)
        )
        counts = {pid: (total, done) for pid, total, done in grouped.all()}
    return [
        MyProjectOut(
            id=p.id,
            number=p.number,
            customer_name=name,
            assigned_at=at,
            step_count=counts.get(p.id, (0, 0))[0],
            steps_done=counts.get(p.id, (0, 0))[1],
        )
        for p, name, at in found
    ]


def work_lines(documents: list[dict[str, Any]], lines: list[dict[str, Any]]) -> list[WorkLineOut]:
    """The order lines of the active order documents, with only the fields an engineer needs."""
    active = {
        d.get("id")
        for d in documents
        if d.get("active") and not d.get("pendingDuplicate") and d.get("type") in ORDER_DOCUMENT_TYPES
    }
    shown = sorted(
        (ln for ln in lines if not ln.get("archived") and ln.get("documentId") in active),
        key=lambda ln: (ln.get("documentOrder") or 0, ln.get("no") or 0),
    )
    number_of = {ln.get("id"): ln.get("no") for ln in shown}
    out: list[WorkLineOut] = []
    for ln in shown:
        paired = number_of.get(ln.get("pairedToLineId"))
        out.append(
            WorkLineOut(
                id=str(ln.get("id")),
                number=ln.get("no"),
                description=str(ln.get("title") or ""),
                quantity=ln.get("qty"),
                kind=ln.get("kind"),
                module=ln.get("moduleType"),
                pairing=f"Line {paired}" if paired else None,
            )
        )
    return out


@router.get("/projects/{project_id}/work", response_model=WorkOut)
async def project_work(project_id: uuid.UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep) -> WorkOut:
    project = await visible_project(session, user, project_id)
    customer = await session.get(Customer, project.customer_id)
    records = (
        await session.execute(
            select(ProjectRecord).where(
                ProjectRecord.project_id == project.id, ProjectRecord.store.in_(("documents", "lines"))
            )
        )
    ).scalars()
    by_store: dict[str, list[dict[str, Any]]] = {"documents": [], "lines": []}
    for r in records:
        by_store[r.store].append(r.data)
    data = await checklist.load(session, user, project, settings)
    return WorkOut(
        project=WorkProjectOut(id=project.id, number=project.number, customer_name=customer.name if customer else ""),
        lines=work_lines(by_store["documents"], by_store["lines"]),
        limits=data.limits,
        steps=data.steps,
    )
