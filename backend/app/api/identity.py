from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, SessionDep, SignedInUser
from app.models import Role, User
from app.schemas.common import MeOut, RoleOut
from app.services.permissions import actions_for

router = APIRouter(tags=["identity"])


async def me_out(session: AsyncSession, user: User) -> MeOut:
    return MeOut(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        actions=await actions_for(session, user.role),
        must_change_password=user.must_change_password,
    )


@router.get("/me", response_model=MeOut)
async def me(user: SignedInUser, session: SessionDep) -> MeOut:
    """Answers even while a new password is still to be chosen, so the screen knows to ask for one."""
    return await me_out(session, user)


@router.get("/roles", response_model=list[RoleOut])
async def roles(_user: CurrentUser, session: SessionDep) -> list[RoleOut]:
    """Roles and what each may do. Permissions are rows, so this is the data the screens read."""
    found = (await session.execute(select(Role).order_by(Role.key))).scalars().all()
    return [RoleOut(key=r.key, label=r.label, actions=await actions_for(session, r.key)) for r in found]
