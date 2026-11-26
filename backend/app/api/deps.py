from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db import Database
from app.errors import AppError, not_signed_in
from app.models import User
from app.services.auth import SESSION_COOKIE, session_user

DEV_EMAIL_DOMAIN = "dev.local"


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
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    x_dev_user: Annotated[str | None, Header()] = None,
    x_background: Annotated[str | None, Header()] = None,
) -> User | None:
    """Who is acting: the user of the session cookie. In development only, the `X-Dev-User` header can name a
    development account instead (a bare name means name@dev.local); anywhere else that header is refused outright,
    so it cannot be used to impersonate anyone on a shared server."""
    if x_dev_user is not None:
        if not settings.is_development:
            raise AppError(
                "dev_header_not_allowed",
                "This way of identifying a user is only available in development.",
                status=401,
            )
        name = x_dev_user.strip().lower()
        email = name if "@" in name else f"{name}@{DEV_EMAIL_DOMAIN}"
        user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None or not user.is_active:
            raise not_signed_in("That development user does not exist.")
        return user

    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    user, row = await session_user(session, settings, token, touch=x_background is None)
    if user is None:
        request.state.session_ended = True
        return None
    request.state.session_id = row.id if row else None
    return user


async def signed_in_user(request: Request, user: Annotated[User | None, Depends(optional_user)]) -> User:
    """Any signed-in user, including one who still has to choose a new password."""
    if user is None:
        if getattr(request.state, "session_ended", False):
            raise AppError("session_expired", "Your session has ended. Sign in again.", status=401)
        raise not_signed_in()
    return user


async def current_user(user: Annotated[User, Depends(signed_in_user)]) -> User:
    """A signed-in user who may use the app: an account given a temporary password must choose its own first."""
    if user.must_change_password:
        raise AppError("password_change_required", "Choose a new password to continue.", status=403)
    return user


SignedInUser = Annotated[User, Depends(signed_in_user)]
CurrentUser = Annotated[User, Depends(current_user)]
