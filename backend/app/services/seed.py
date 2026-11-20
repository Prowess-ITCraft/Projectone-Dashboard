from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.role_matrix import ROLE_ACTIONS, ROLES
from app.models import Counter, Role, RoleAction, Setting, User
from app.services import audit

# Invented development accounts with no password: they exist only where the development tools are enabled, and are
# used through the development header. Real accounts come from scripts/seed_accounts.py.
DEV_USERS: tuple[tuple[str, str, str], ...] = (
    ("asha@dev.local", "Asha", "admin"),
    ("ravi@dev.local", "Ravi", "engineer"),
)


async def seed_roles(session: AsyncSession) -> None:
    """Makes the role and permission rows match the matrix. Rows are added, never removed, so a permission
    changed later by an Admin is not undone by a restart."""
    for key, label in ROLES.items():
        if await session.get(Role, key) is None:
            session.add(Role(key=key, label=label))
    await session.flush()
    for role_key, actions in ROLE_ACTIONS.items():
        have = set((await session.execute(select(RoleAction.action).where(RoleAction.role_key == role_key))).scalars())
        session.add_all(RoleAction(role_key=role_key, action=a) for a in actions if a not in have)
    await session.flush()


async def seed_dev_users(session: AsyncSession) -> list[User]:
    users: list[User] = []
    for email, full_name, role in DEV_USERS:
        found = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if found is None:
            found = User(email=email, full_name=full_name, role=role)
            session.add(found)
        users.append(found)
    await session.flush()
    return users


async def reset_development_data(session: AsyncSession, actor: User) -> None:
    """Clears counters and settings and seeds the development accounts again. Other accounts are kept, because they
    may be referenced by assignments. The audit log is never cleared, even here: it is append-only, and the reset
    itself is recorded in it."""
    await audit.record(session, actor=actor, action="dev_reset", subject_type="system", reason="Development reset")
    await session.execute(delete(Counter))
    await session.execute(delete(Setting))
    await session.flush()
    await seed_dev_users(session)
