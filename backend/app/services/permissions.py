from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import forbidden, not_signed_in
from app.models import RoleAction, User


async def actions_for(session: AsyncSession, role_key: str) -> list[str]:
    rows = await session.execute(select(RoleAction.action).where(RoleAction.role_key == role_key))
    return sorted(rows.scalars())


async def can(session: AsyncSession, user: User | None, action: str) -> bool:
    """The single permission check. It reads the role_actions rows, so a new role or action is data."""
    if user is None or not user.active:
        return False
    found = await session.execute(
        select(RoleAction).where(RoleAction.role_key == user.role_key, RoleAction.action == action)
    )
    return found.scalar_one_or_none() is not None


async def require(session: AsyncSession, user: User | None, action: str, message: str) -> User:
    if user is None:
        raise not_signed_in()
    if not await can(session, user, action):
        raise forbidden(message)
    return user
