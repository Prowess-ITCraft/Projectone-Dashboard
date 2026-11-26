from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, User
from app.request_context import request_id_var


def actor_label(actor: User | None) -> str | None:
    return f"{actor.full_name}, {actor.role}" if actor else None


def actor_details(actor: User | None) -> dict[str, Any] | None:
    """The actor as the project activity feed shows it: a name and a role."""
    return {"id": str(actor.id), "name": actor.full_name, "role": actor.role} if actor else None


async def record(
    session: AsyncSession,
    *,
    actor: User | None,
    action: str,
    subject_type: str,
    subject_id: str | None = None,
    subject_label: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    reason: str | None = None,
    details: dict[str, Any] | None = None,
    **fields: Any,
) -> AuditLog:
    """The only writer of audit rows. It adds to the caller's session and never commits, so the audit row and the
    change it describes are saved in the same transaction or not at all. `fields` (such as a fixed `id` or `at`) are
    passed to the row as they are."""
    row = AuditLog(
        actor_id=actor.id if actor else None,
        actor_label=actor_label(actor),
        action=action,
        subject_type=subject_type,
        subject_id=subject_id,
        subject_label=subject_label,
        before=before,
        after=after,
        reason=reason.strip() if reason and reason.strip() else None,
        request_id=request_id_var.get(),
        details=details,
        **fields,
    )
    session.add(row)
    await session.flush()
    return row
