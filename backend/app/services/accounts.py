"""Creating the first accounts: one Admin and ten engineers. Used by scripts/seed_accounts.py.

Engineers are created with the shared default password (DEFAULT_ENGINEER_PASSWORD); the Admin with the password given.
Running it again creates nothing that already exists and never changes an existing account's password. Every account
it creates must choose a new password at first sign-in.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.role_matrix import ADMIN_ROLE, ENGINEER_ROLE
from app.errors import AppError
from app.models import User
from app.services import audit
from app.services.auth import hash_password, is_valid_email, normalise_email, password_problem

ENGINEER_COUNT = 10


@dataclass
class Seeded:
    full_name: str
    email: str
    role: str
    created: bool


def engineer_email(n: int, domain: str) -> str:
    return f"engineer{n:02d}@{domain}"


async def _ensure(
    session: AsyncSession, *, full_name: str, email: str, role: str, password: str, is_default: bool
) -> Seeded:
    found = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if found is not None:
        return Seeded(found.full_name, found.email, found.role, created=False)
    user = User(
        full_name=full_name,
        email=email,
        password_hash=await hash_password(password),
        role=role,
        must_change_password=True,
        password_is_default=is_default,
    )
    session.add(user)
    await session.flush()
    await audit.record(
        session, actor=None, action="user_seeded", subject_type="user", subject_id=str(user.id), subject_label=full_name
    )
    return Seeded(full_name, email, role, created=True)


async def seed_accounts(
    session: AsyncSession,
    *,
    admin_email: str,
    admin_password: str,
    admin_name: str = "Admin",
    engineer_domain: str | None = None,
    default_password: str = "",
) -> list[Seeded]:
    email = normalise_email(admin_email)
    if not is_valid_email(email):
        raise AppError("invalid_email", "ADMIN_EMAIL is not a valid email address.")
    problem = password_problem(admin_password)
    if problem:
        raise AppError("weak_password", f"ADMIN_PASSWORD: {problem}")
    problem = password_problem(default_password)
    if problem:
        raise AppError("weak_password", f"DEFAULT_ENGINEER_PASSWORD: {problem}")
    domain = (engineer_domain or email.split("@", 1)[1]).strip().lower()
    if not is_valid_email(f"engineer01@{domain}"):
        raise AppError("invalid_email", "ENGINEER_EMAIL_DOMAIN is not a valid email domain.")

    results = [
        await _ensure(
            session,
            full_name=" ".join(admin_name.split()) or "Admin",
            email=email,
            role=ADMIN_ROLE,
            password=admin_password,
            is_default=False,
        )
    ]
    for n in range(1, ENGINEER_COUNT + 1):
        results.append(
            await _ensure(
                session,
                full_name=f"Engineer {n:02d}",
                email=engineer_email(n, domain),
                role=ENGINEER_ROLE,
                password=default_password,
                is_default=True,
            )
        )
    return results
