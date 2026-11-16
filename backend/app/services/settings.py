from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Setting, User
from app.services import audit


async def get_setting(session: AsyncSession, key: str, default: Any = None) -> Any:
    row = await session.get(Setting, key)
    return row.value if row else default


async def set_setting(
    session: AsyncSession, actor: User | None, key: str, value: Any, reason: str | None = None
) -> None:
    existing = await session.get(Setting, key)
    before = {"value": existing.value} if existing else None
    if existing:
        existing.value = value
    else:
        session.add(Setting(key=key, value=value))
    await audit.record(
        session,
        actor=actor,
        action="setting_changed",
        subject_type="setting",
        subject_id=key,
        before=before,
        after={"value": value},
        reason=reason,
    )


async def all_settings(session: AsyncSession) -> dict[str, Any]:
    rows = await session.execute(select(Setting))
    return {row.key: row.value for row in rows.scalars()}
