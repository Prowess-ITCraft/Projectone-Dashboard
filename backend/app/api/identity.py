from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep
from app.models import Role
from app.schemas.common import MeOut, RoleOut
from app.services.permissions import actions_for

router = APIRouter(tags=["identity"])


@router.get("/me", response_model=MeOut)
async def me(user: CurrentUser, session: SessionDep) -> MeOut:
    return MeOut(
        id=str(user.id),
        username=user.username,
        display_name=user.display_name,
        role=user.role_key,
        actions=await actions_for(session, user.role_key),
    )


@router.get("/roles", response_model=list[RoleOut])
async def roles(_user: CurrentUser, session: SessionDep) -> list[RoleOut]:
    """Roles and what each may do. Permissions are rows, so this is the data the screens read."""
    found = (await session.execute(select(Role).order_by(Role.key))).scalars().all()
    return [RoleOut(key=r.key, label=r.label, actions=await actions_for(session, r.key)) for r in found]
