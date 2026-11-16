from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db import Database
from app.errors import AppError, not_signed_in
from app.models import User


def get_settings_dep(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    database: Database = request.app.state.database
    async for session in database.session():
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]


async def optional_user(
    session: SessionDep,
    settings: SettingsDep,
    x_dev_user: Annotated[str | None, Header()] = None,
) -> User | None:
    """Who is acting. Until sign-in exists (Stage B10) the only way to identify a user is a development-only header
    naming a seeded account. Outside development the header is refused outright, so it cannot be used to
    impersonate anyone on a shared server."""
    if x_dev_user is None:
        return None
    if not settings.is_development:
        raise AppError(
            "dev_header_not_allowed",
            "This way of identifying a user is only available in development.",
            status=401,
        )
    found = await session.execute(select(User).where(User.username == x_dev_user.strip().lower()))
    user = found.scalar_one_or_none()
    if user is None or not user.active:
        raise not_signed_in("That development user does not exist.")
    return user


async def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise not_signed_in()
    return user


CurrentUser = Annotated[User, Depends(current_user)]
