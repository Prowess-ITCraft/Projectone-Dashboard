import uuid

from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, SessionDep, SettingsDep
from app.models import User
from app.schemas.common import LoginDetailsOut, NewEngineerIn, UserOut, UserWithPasswordOut
from app.services import users

router = APIRouter(prefix="/users", tags=["users"])


def _out(user: User) -> UserOut:
    return UserOut.model_validate(user, from_attributes=True)


@router.get("", response_model=list[UserOut])
async def list_users(user: CurrentUser, session: SessionDep) -> list[UserOut]:
    return [_out(u) for u in await users.list_users(session, user)]


@router.post("", response_model=UserWithPasswordOut, status_code=201)
async def add_engineer(
    body: NewEngineerIn, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> UserWithPasswordOut:
    created, password = await users.add_engineer(session, user, settings, body.full_name, body.email)
    return UserWithPasswordOut(user=_out(created), temporary_password=password)


@router.post("/{user_id}/reset-password", response_model=UserWithPasswordOut)
async def reset_password(
    user_id: uuid.UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep
) -> UserWithPasswordOut:
    target, password = await users.reset_password(session, user, settings, user_id)
    return UserWithPasswordOut(user=_out(target), temporary_password=password)


@router.get("/{user_id}/login-details", response_model=LoginDetailsOut)
async def login_details(
    user_id: uuid.UUID, user: CurrentUser, session: SessionDep, settings: SettingsDep, response: Response
) -> LoginDetailsOut:
    response.headers["Cache-Control"] = "no-store"
    email, password = await users.login_details(session, user, settings, user_id)
    return LoginDetailsOut(email=email, password=password)


@router.post("/{user_id}/deactivate", response_model=UserOut)
async def deactivate(user_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> UserOut:
    return _out(await users.set_active(session, user, user_id, False))


@router.post("/{user_id}/activate", response_model=UserOut)
async def activate(user_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> UserOut:
    return _out(await users.set_active(session, user, user_id, True))
