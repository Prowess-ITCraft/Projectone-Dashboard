"""A project's checklist: its steps, the order they are done in, evidence and comments.

Rules, all enforced here and not on the screen:
- Steps are done in strict order (installation steps by position, then configuration steps). A step is locked until the
  step before it is complete.
- A step goes pending -> awaiting evidence (the engineer marks it done) -> complete (the engineer finishes it, which
  needs at least one evidence file). Unticking an awaiting step returns it to pending and removes its evidence.
- Evidence can be added and removed (by whoever uploaded it) only while the step awaits evidence. A complete step's
  evidence is locked, and an engineer cannot un-complete it.
- Comments can be added on any unlocked step, even a complete one, and are never edited or deleted.
- Structure changes (add, edit, reorder, delete, reset, force-complete) belong to `manage_checklist`, which only an
  Admin has.
"""

import base64
import binascii
import csv
import hashlib
import io
import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.domain import evidence as kinds
from app.errors import AppError, forbidden, not_found
from app.models import (
    ChecklistComment,
    ChecklistEvidence,
    ChecklistStep,
    Project,
    StoredFile,
    User,
)
from app.schemas.common import (
    ChecklistOut,
    ChecklistStepOut,
    CommentOut,
    EvidenceLimitsOut,
    EvidenceOut,
    StepIn,
    StepPatch,
)
from app.services import audit
from app.services.permissions import require

PHASES = ("installation", "configuration")
PHASE_LABELS = {"installation": "Installation", "configuration": "Configuration"}
PENDING, AWAITING, COMPLETE = "pending", "awaiting_evidence", "complete"
MAX_COMMENT = 2000


def limits(settings: Settings) -> EvidenceLimitsOut:
    return EvidenceLimitsOut(
        max_bytes=settings.evidence_max_bytes,
        max_files=settings.evidence_max_files,
        accepted=[ext for k in kinds.KINDS.values() for ext in k.extensions],
        accepted_text=kinds.ACCEPTED_TEXT,
    )


def _order(step: ChecklistStep) -> tuple[int, int]:
    return (PHASES.index(step.phase), step.position)


async def ordered_steps(session: AsyncSession, project_id: uuid.UUID, *, lock: bool = False) -> list[ChecklistStep]:
    query = select(ChecklistStep).where(ChecklistStep.project_id == project_id)
    if lock:
        query = query.with_for_update()
    rows = list((await session.execute(query)).scalars())
    return sorted(rows, key=_order)


def _lock_of(steps: list[ChecklistStep], index: int) -> tuple[bool, str | None]:
    """Whether the step is locked, and why. The step before it must be complete."""
    if index == 0 or steps[index - 1].state == COMPLETE:
        return False, None
    before = steps[index - 1]
    if before.phase == steps[index].phase:
        number = sum(1 for s in steps[:index] if s.phase == before.phase)
        return True, f"Complete step {number} first"
    return True, f"Complete the last {PHASE_LABELS[before.phase]} step first"


def _clean_name(name: str) -> str:
    name = re.sub(r"[\x00-\x1f\x7f/\\]", "", name).strip()
    return name[:200] or "evidence"


def project_open(project: Project) -> None:
    if project.status != "in_progress":
        raise AppError("project_locked", "This project is not in progress, so it cannot be changed.", status=409)


# reads


async def load(session: AsyncSession, user: User, project: Project, settings: Settings) -> ChecklistOut:
    steps = await ordered_steps(session, project.id)
    ids = [s.id for s in steps]
    names = dict((await session.execute(select(User.id, User.full_name))).all())
    evidence: dict[uuid.UUID, list[EvidenceOut]] = {}
    if ids:
        found = await session.execute(
            select(ChecklistEvidence, StoredFile)
            .join(StoredFile, StoredFile.id == ChecklistEvidence.file_id)
            .where(ChecklistEvidence.step_id.in_(ids))
            .order_by(ChecklistEvidence.uploaded_at)
        )
        by_id = {s.id: s for s in steps}
        for ev, file in found.all():
            evidence.setdefault(ev.step_id, []).append(
                EvidenceOut(
                    id=ev.id,
                    name=file.name,
                    media_type=file.media_type,
                    size=file.size,
                    uploaded_by_id=ev.uploaded_by,
                    uploaded_by_name=names.get(ev.uploaded_by, ""),
                    uploaded_at=ev.uploaded_at,
                    can_remove=ev.uploaded_by == user.id and by_id[ev.step_id].state == AWAITING,
                )
            )
    comments: dict[uuid.UUID, list[CommentOut]] = {}
    if ids:
        rows = await session.execute(
            select(ChecklistComment).where(ChecklistComment.step_id.in_(ids)).order_by(ChecklistComment.created_at)
        )
        for c in rows.scalars():
            comments.setdefault(c.step_id, []).append(
                CommentOut(
                    id=c.id,
                    body=c.body,
                    author_id=c.author_id,
                    author_name=names.get(c.author_id, ""),
                    created_at=c.created_at,
                )
            )
    out: list[ChecklistStepOut] = []
    for i, s in enumerate(steps):
        locked, reason = _lock_of(steps, i)
        out.append(
            ChecklistStepOut(
                id=s.id,
                phase=s.phase,
                position=s.position,
                title=s.title,
                state=s.state,
                done=s.state == COMPLETE,
                locked=locked,
                locked_reason=reason,
                start_date=s.start_date,
                end_date=s.end_date,
                progress=100 if s.state == COMPLETE else s.progress,
                evidence=evidence.get(s.id, []),
                comments=comments.get(s.id, []),
            )
        )
    return ChecklistOut(limits=limits(settings), steps=out)


async def evidence_file(session: AsyncSession, project: Project, evidence_id: uuid.UUID) -> StoredFile:
    row = await session.execute(
        select(StoredFile)
        .join(ChecklistEvidence, ChecklistEvidence.file_id == StoredFile.id)
        .where(ChecklistEvidence.id == evidence_id, ChecklistEvidence.project_id == project.id)
    )
    file = row.scalar_one_or_none()
    if file is None:
        raise not_found("That file does not exist.")
    return file


def _csv_cell(value: object) -> str:
    text = "" if value is None else str(value)
    # a cell starting with one of these would be run as a formula by a spreadsheet
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


async def export_csv(session: AsyncSession, user: User, project: Project, settings: Settings) -> str:
    await require(session, user, "manage_checklist", "Only an Admin can export the checklist.")
    data = await load(session, user, project, settings)
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["Phase", "SN", "Task", "Status", "Start date", "End date", "Progress", "Evidence", "Comments"])
    counts: dict[str, int] = {}
    for s in data.steps:
        counts[s.phase] = counts.get(s.phase, 0) + 1
        row = [
            PHASE_LABELS[s.phase],
            counts[s.phase],
            s.title,
            s.state,
            s.start_date,
            s.end_date,
            s.progress,
            len(s.evidence),
            len(s.comments),
        ]
        writer.writerow([_csv_cell(c) for c in row])
    return out.getvalue()


# the engineer's three actions


async def _step(session: AsyncSession, project: Project, step_id: uuid.UUID) -> tuple[list[ChecklistStep], int]:
    steps = await ordered_steps(session, project.id, lock=True)
    index = next((i for i, s in enumerate(steps) if s.id == step_id), None)
    if index is None:
        raise not_found("That step does not exist.")
    return steps, index


def _require_unlocked(steps: list[ChecklistStep], index: int) -> None:
    locked, reason = _lock_of(steps, index)
    if locked:
        raise AppError("step_locked", "This step is locked.", status=409, reason=reason)


async def _drop_evidence(session: AsyncSession, step_id: uuid.UUID) -> None:
    file_ids = (
        (await session.execute(select(ChecklistEvidence.file_id).where(ChecklistEvidence.step_id == step_id)))
        .scalars()
        .all()
    )
    if file_ids:
        # the evidence rows go with their files (ON DELETE CASCADE)
        await session.execute(delete(StoredFile).where(StoredFile.id.in_(file_ids)))


async def _count_evidence(session: AsyncSession, step_id: uuid.UUID) -> int:
    return (
        await session.execute(
            select(func.count()).select_from(ChecklistEvidence).where(ChecklistEvidence.step_id == step_id)
        )
    ).scalar_one()


async def _note(session: AsyncSession, user: User, project: Project, step: ChecklistStep, action: str) -> None:
    await audit.record(
        session,
        actor=user,
        action=action,
        subject_type="project",
        subject_id=str(project.id),
        subject_label=step.title,
        details={"stepId": str(step.id), "actor": audit.actor_details(user)},
    )


async def complete(session: AsyncSession, user: User, project: Project, step_id: uuid.UUID) -> None:
    """Marks a pending step done (it then awaits evidence), or finishes an awaiting step that has evidence."""
    await require(session, user, "complete_step", "Your role cannot complete checklist steps.")
    project_open(project)
    steps, index = await _step(session, project, step_id)
    step = steps[index]
    _require_unlocked(steps, index)
    if step.state == COMPLETE:
        raise AppError("step_complete", "This step is already complete.", status=409)
    if step.state == PENDING:
        step.state = AWAITING
        await _note(session, user, project, step, "checklist_step_marked_done")
    else:
        if await _count_evidence(session, step.id) < 1:
            raise AppError("evidence_required", "Upload at least one evidence file to complete this step.", status=409)
        step.state, step.done, step.progress = COMPLETE, True, 100
        step.completed_at, step.completed_by = datetime.now(UTC), user.id
        await _note(session, user, project, step, "checklist_step_completed")
    await session.flush()


async def untick(session: AsyncSession, user: User, project: Project, step_id: uuid.UUID) -> None:
    """Takes a step that awaits evidence back to pending, removing its evidence. A complete step cannot be taken back
    by an engineer."""
    await require(session, user, "complete_step", "Your role cannot change checklist steps.")
    project_open(project)
    steps, index = await _step(session, project, step_id)
    step = steps[index]
    if step.state == COMPLETE:
        raise forbidden("A complete step cannot be undone.", reason="Only an Admin can reset a complete step.")
    if step.state == AWAITING:
        await _drop_evidence(session, step.id)
        step.state = PENDING
        await _note(session, user, project, step, "checklist_step_unticked")
        await session.flush()


async def add_evidence(
    session: AsyncSession,
    user: User,
    settings: Settings,
    project: Project,
    step_id: uuid.UUID,
    name: str,
    content_b64: str,
) -> None:
    await require(session, user, "upload_evidence", "Your role cannot upload evidence.")
    project_open(project)
    steps, index = await _step(session, project, step_id)
    step = steps[index]
    _require_unlocked(steps, index)
    if step.state != AWAITING:
        raise AppError(
            "step_not_awaiting_evidence",
            "Evidence can only be added while a step is marked done and awaiting evidence.",
            status=409,
        )
    # the encoded text is about a third larger than the file; refuse an oversized one before decoding it
    if len(content_b64) > settings.evidence_max_bytes * 4 // 3 + 8:
        raise _too_large(settings)
    try:
        content = base64.b64decode(content_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppError("invalid_file", "The file could not be read.", status=400) from exc
    if not content:
        raise AppError("invalid_file", "The file is empty.", status=400)
    if len(content) > settings.evidence_max_bytes:
        raise _too_large(settings)
    if await _count_evidence(session, step.id) >= settings.evidence_max_files:
        raise AppError(
            "too_many_files", f"A step can have at most {settings.evidence_max_files} evidence files.", status=409
        )
    name = _clean_name(name)
    kind = kinds.check(name, content)
    if kind is None:
        raise AppError(
            "unsupported_file",
            f"Only {kinds.ACCEPTED_TEXT} files are accepted, and the file must be what it says it is.",
            status=415,
        )
    file = StoredFile(
        id=uuid.uuid4(),
        project_id=project.id,
        name=name,
        media_type=kind.media_type,
        size=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
        content=content,
    )
    session.add(file)
    await session.flush()
    session.add(
        ChecklistEvidence(id=uuid.uuid4(), step_id=step.id, project_id=project.id, file_id=file.id, uploaded_by=user.id)
    )
    await _note(session, user, project, step, "checklist_evidence_added")
    await session.flush()


def _too_large(settings: Settings) -> AppError:
    return AppError("file_too_large", f"This file is larger than {settings.evidence_max_mb} MB.", status=413)


async def remove_evidence(
    session: AsyncSession, user: User, project: Project, step_id: uuid.UUID, evidence_id: uuid.UUID
) -> None:
    await require(session, user, "upload_evidence", "Your role cannot remove evidence.")
    project_open(project)
    steps, index = await _step(session, project, step_id)
    step = steps[index]
    row = (
        await session.execute(
            select(ChecklistEvidence).where(ChecklistEvidence.id == evidence_id, ChecklistEvidence.step_id == step.id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("That file does not exist.")
    if step.state == COMPLETE:
        raise forbidden("Evidence on a complete step is locked.", reason="Only an Admin can change a complete step.")
    if row.uploaded_by != user.id:
        raise forbidden("You can only remove files you uploaded.")
    await session.execute(delete(StoredFile).where(StoredFile.id == row.file_id))
    await _note(session, user, project, step, "checklist_evidence_removed")
    await session.flush()


async def add_comment(session: AsyncSession, user: User, project: Project, step_id: uuid.UUID, body: str) -> None:
    await require(session, user, "comment_step", "Your role cannot comment on checklist steps.")
    project_open(project)
    steps, index = await _step(session, project, step_id)
    _require_unlocked(steps, index)
    body = body.strip()
    if not body:
        raise AppError("invalid_comment", "Write a comment first.", status=400)
    session.add(
        ChecklistComment(id=uuid.uuid4(), step_id=steps[index].id, project_id=project.id, author_id=user.id, body=body)
    )
    await session.flush()


# the Admin's controls


async def _need_admin(session: AsyncSession, user: User) -> None:
    await require(session, user, "manage_checklist", "Only an Admin can change the checklist.")


async def create_step(session: AsyncSession, user: User, project: Project, body: StepIn) -> ChecklistStep:
    await _need_admin(session, user)
    last = (
        await session.execute(
            select(func.max(ChecklistStep.position)).where(
                ChecklistStep.project_id == project.id, ChecklistStep.phase == body.phase
            )
        )
    ).scalar_one()
    step = ChecklistStep(
        id=uuid.uuid4(),
        project_id=project.id,
        phase=body.phase,
        position=(last or 0) + 1,
        title=body.title.strip(),
        start_date=body.start_date,
        end_date=body.end_date,
        progress=body.progress,
    )
    session.add(step)
    await session.flush()
    await _note(session, user, project, step, "checklist_step_added")
    return step


async def update_step(session: AsyncSession, user: User, project: Project, step_id: uuid.UUID, body: StepPatch) -> None:
    await _need_admin(session, user)
    steps, index = await _step(session, project, step_id)
    step = steps[index]
    changes = body.model_dump(exclude_unset=True)
    if "phase" in changes and changes["phase"] is not None and changes["phase"] != step.phase:
        last = (
            await session.execute(
                select(func.max(ChecklistStep.position)).where(
                    ChecklistStep.project_id == project.id, ChecklistStep.phase == changes["phase"]
                )
            )
        ).scalar_one()
        step.phase, step.position = changes["phase"], (last or 0) + 1
    for field in ("title", "start_date", "end_date", "progress"):
        if field in changes and (changes[field] is not None or field in ("start_date", "end_date")):
            setattr(step, field, changes[field].strip() if field == "title" else changes[field])
    await _note(session, user, project, step, "checklist_step_edited")
    await session.flush()


async def delete_step(session: AsyncSession, user: User, project: Project, step_id: uuid.UUID) -> None:
    await _need_admin(session, user)
    steps, index = await _step(session, project, step_id)
    step = steps[index]
    await _drop_evidence(session, step.id)
    await _note(session, user, project, step, "checklist_step_deleted")
    await session.delete(step)
    await session.flush()


async def reorder(session: AsyncSession, user: User, project: Project, step_ids: list[uuid.UUID]) -> None:
    """Sets the order of the steps within each phase to the order given; every step must be listed once."""
    await _need_admin(session, user)
    steps = await ordered_steps(session, project.id, lock=True)
    if sorted(step_ids) != sorted(s.id for s in steps):
        raise AppError("invalid_order", "List every step of the project exactly once.", status=400)
    by_id = {s.id: s for s in steps}
    seen: dict[str, int] = {}
    for step_id in step_ids:
        step = by_id[step_id]
        seen[step.phase] = seen.get(step.phase, 0) + 1
        step.position = seen[step.phase]
    await session.flush()


async def reset_step(session: AsyncSession, user: User, project: Project, step_id: uuid.UUID) -> None:
    await _need_admin(session, user)
    steps, index = await _step(session, project, step_id)
    step = steps[index]
    await _drop_evidence(session, step.id)
    step.state, step.done, step.completed_at, step.completed_by = PENDING, False, None, None
    await _note(session, user, project, step, "checklist_step_reset")
    await session.flush()


async def force_complete(session: AsyncSession, user: User, project: Project, step_id: uuid.UUID) -> None:
    await _need_admin(session, user)
    steps, index = await _step(session, project, step_id)
    step = steps[index]
    step.state, step.done, step.progress = COMPLETE, True, 100
    step.completed_at, step.completed_by = datetime.now(UTC), user.id
    await _note(session, user, project, step, "checklist_step_force_completed")
    await session.flush()
