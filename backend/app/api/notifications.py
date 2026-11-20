import uuid

from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, SessionDep
from app.schemas.common import NotificationOut, NotificationsOut
from app.services import notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationsOut)
async def list_notifications(user: CurrentUser, session: SessionDep) -> NotificationsOut:
    """The screens poll this with `X-Background: 1`, so polling alone does not keep a session alive."""
    unread, rows = await notifications.list_for(session, user)
    return NotificationsOut(
        unread_count=unread, items=[NotificationOut.model_validate(r, from_attributes=True) for r in rows]
    )


@router.post("/read-all", status_code=204)
async def mark_all_read(user: CurrentUser, session: SessionDep) -> Response:
    await notifications.mark_all_read(session, user)
    return Response(status_code=204)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(notification_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> NotificationOut:
    row = await notifications.mark_read(session, user, notification_id)
    return NotificationOut.model_validate(row, from_attributes=True)
