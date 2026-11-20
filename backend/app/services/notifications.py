import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import not_found
from app.models import Notification, User

LIST_LIMIT = 50


def notify(
    session: AsyncSession, *, user_id: uuid.UUID, type: str, title: str, message: str, project_id: uuid.UUID | None
) -> None:
    session.add(Notification(user_id=user_id, type=type, title=title, message=message, project_id=project_id))


async def list_for(session: AsyncSession, user: User) -> tuple[int, list[Notification]]:
    """The user's alerts, newest first, and how many are unread."""
    unread = await session.execute(
        select(func.count()).where(Notification.user_id == user.id, Notification.is_read.is_(False))
    )
    rows = await session.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id)
        .limit(LIST_LIMIT)
    )
    return int(unread.scalar_one()), list(rows.scalars())


async def mark_read(session: AsyncSession, user: User, notification_id: uuid.UUID) -> Notification:
    row = await session.get(Notification, notification_id)
    if row is None or row.user_id != user.id:
        raise not_found("That alert does not exist.")
    row.is_read = True
    return row


async def mark_all_read(session: AsyncSession, user: User) -> None:
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
