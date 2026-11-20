"""Accounts managed by an Admin: add an engineer, reset a password, deactivate and reactivate. An engineer starts with
(and is reset to) the shared default password from DEFAULT_ENGINEER_PASSWORD; only its hash is stored. While an engineer
still holds it, an Admin can copy their login details. A password an engineer chose is never readable by anyone."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.domain.role_matrix import ENGINEER_ROLE
from app.errors import AppError, not_found
from app.models import User
from app.services import audit
from app.services.auth import (
    default_engineer_password,
    end_all_sessions,
    generate_password,
    hash_password,
    is_valid_email,
    normalise_email,
    verify_password,
)
from app.services.permissions import require

NAME_MAX = 120


async def _require_admin(session: AsyncSession, actor: User) -> None:
    await require(session, actor, "manage_users", "Only an Admin can manage users.")


async def list_users(session: AsyncSession, actor: User) -> list[User]:
    await _require_admin(session, actor)
    rows = await session.execute(select(User).order_by(User.role, User.full_name))
    return list(rows.scalars())


async def add_engineer(
    session: AsyncSession, actor: User, settings: Settings, full_name: str, email: str
) -> tuple[User, str]:
    await _require_admin(session, actor)
    name = " ".join(full_name.split())
    address = normalise_email(email)
    if not name or len(name) > NAME_MAX:
        raise AppError("invalid_name", "Enter the engineer's full name.", status=400)
    if not is_valid_email(address):
        raise AppError("invalid_email", "Enter a valid email address.", status=400)
    if (await session.execute(select(User).where(User.email == address))).scalar_one_or_none():
        raise AppError("email_taken", "An account with this email already exists.", status=409)
    password = default_engineer_password(settings)
    user = User(
        full_name=name,
        email=address,
        password_hash=await hash_password(password),
        role=ENGINEER_ROLE,
        must_change_password=True,
        password_is_default=True,
    )
    session.add(user)
    await session.flush()
    await audit.record(
        session, actor=actor, action="user_added", subject_type="user", subject_id=str(user.id), subject_label=name
    )
    return user, password


async def _target(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise not_found("That account does not exist.")
    return user


async def reset_password(
    session: AsyncSession, actor: User, settings: Settings, user_id: uuid.UUID
) -> tuple[User, str]:
    """An engineer is reset to the default password; any other account gets a random one, shown once."""
    await _require_admin(session, actor)
    user = await _target(session, user_id)
    is_engineer = user.role == ENGINEER_ROLE
    password = default_engineer_password(settings) if is_engineer else generate_password()
    user.password_hash = await hash_password(password)
    user.must_change_password = True
    user.password_is_default = is_engineer
    await end_all_sessions(session, user.id)
    await audit.record(
        session,
        actor=actor,
        action="password_reset",
        subject_type="user",
        subject_id=str(user.id),
        subject_label=user.full_name,
    )
    return user, password


async def login_details(session: AsyncSession, actor: User, settings: Settings, user_id: uuid.UUID) -> tuple[str, str]:
    """The email and default password to send an engineer who has not changed it yet. Refused once they have, and
    refused if the stored password no longer matches the configured default."""
    await _require_admin(session, actor)
    user = await _target(session, user_id)
    default = default_engineer_password(settings)
    if (
        user.role != ENGINEER_ROLE
        or not user.password_is_default
        or not user.must_change_password
        or not await verify_password(user.password_hash, default)
    ):
        raise AppError(
            "no_default_password",
            "This engineer has chosen their own password, or has not been given the default one. "
            "Use Reset to default password to send new login details.",
            status=409,
        )
    await audit.record(
        session,
        actor=actor,
        action="login_details_copied",
        subject_type="user",
        subject_id=str(user.id),
        subject_label=user.full_name,
    )
    return user.email, default


async def set_active(session: AsyncSession, actor: User, user_id: uuid.UUID, active: bool) -> User:
    await _require_admin(session, actor)
    user = await _target(session, user_id)
    if user.id == actor.id and not active:
        raise AppError("cannot_deactivate_self", "You cannot deactivate your own account.", status=400)
    user.is_active = active
    if not active:
        await end_all_sessions(session, user.id)
    await audit.record(
        session,
        actor=actor,
        action="user_activated" if active else "user_deactivated",
        subject_type="user",
        subject_id=str(user.id),
        subject_label=user.full_name,
    )
    return user
