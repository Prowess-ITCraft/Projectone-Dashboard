"""Development tools. This router is added to the application only when the environment is development, so in
any other environment these paths do not exist at all (they answer 404 and are absent from the API document)."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.schemas.common import SeedOut
from app.services import seed
from app.services.permissions import require

router = APIRouter(prefix="/dev", tags=["development"])


@router.post("/seed", response_model=SeedOut)
async def seed_users(session: SessionDep) -> SeedOut:
    """Creates the invented development accounts (an Admin and an Engineer). It needs no user, because
    on an empty database there is nobody yet to sign in as."""
    await seed.seed_roles(session)
    users = await seed.seed_dev_users(session)
    return SeedOut(users=[u.username for u in users])


@router.post("/reset", response_model=SeedOut)
async def reset(user: CurrentUser, session: SessionDep) -> SeedOut:
    await require(session, user, "reset_data", "Only an Admin can reset the data.")
    await seed.reset_development_data(session, user)
    return SeedOut(users=[u[0] for u in seed.DEV_USERS])
