"""Passwords, sign-in, sessions and the limit on repeated attempts.

Passwords are hashed with Argon2id and never stored, returned or logged in plain form. A failed sign-in always gives
the same answer, whether the email is unknown, the password is wrong or the account is deactivated, and an unknown
email still costs one hash check so the answer takes as long either way.
"""

import asyncio
import hashlib
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.errors import AppError
from app.models import LoginAttempt, User, UserSession
from app.services import audit

SESSION_COOKIE = "projectone_session"
MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 200
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

_hasher = PasswordHasher()
# Checked against when the email is unknown, so an unknown email takes as long as a wrong password
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


def utcnow() -> datetime:
    return datetime.now(UTC)


def normalise_email(email: str) -> str:
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    return bool(EMAIL.match(email)) and len(email) <= 254


def _verify(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


async def hash_password(password: str) -> str:
    """Hashing takes tens of milliseconds on purpose; it runs off the event loop so other requests are not held up."""
    return await asyncio.to_thread(_hasher.hash, password)


async def verify_password(password_hash: str | None, password: str) -> bool:
    return await asyncio.to_thread(_verify, password_hash, password)


def generate_password() -> str:
    """A random password for a new or reset account: 16 URL-safe characters (96 bits)."""
    return secrets.token_urlsafe(12)


def password_problem(password: str) -> str | None:
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Use at least {MIN_PASSWORD_LENGTH} characters."
    if len(password) > MAX_PASSWORD_LENGTH:
        return f"Use at most {MAX_PASSWORD_LENGTH} characters."
    return None


def default_engineer_password(settings: Settings) -> str:
    """The shared starting password for engineer accounts, from DEFAULT_ENGINEER_PASSWORD. It is checked like any other
    password, so a short or missing value stops account creation instead of creating weak accounts."""
    value = settings.default_engineer_password
    problem = password_problem(value) if value else "it is not set"
    if value is None or problem:
        raise AppError(
            "default_password_not_set",
            f"DEFAULT_ENGINEER_PASSWORD is not usable on the server ({problem}). Set it and restart.",
            status=503,
        )
    return value


def token_key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass
class SignIn:
    user: User | None
    token: str | None
    error: AppError | None


INVALID = AppError("invalid_credentials", "That email and password do not match.", status=401)


async def sign_in(session: AsyncSession, settings: Settings, email: str, password: str, ip: str) -> SignIn:
    """Checks the limit, then the password. The attempt is recorded either way, so the caller must commit even when
    this returns an error; that is why it returns the error instead of raising it."""
    now = utcnow()
    key = normalise_email(email)[:254]
    since = now - timedelta(minutes=settings.login_window_minutes)
    await session.execute(delete(LoginAttempt).where(LoginAttempt.at < now - timedelta(days=1)))

    async def failures(column: Any, value: str) -> int:
        query = select(func.count()).where(column == value, LoginAttempt.succeeded.is_(False), LoginAttempt.at >= since)
        return int((await session.execute(query)).scalar_one())

    if (
        await failures(LoginAttempt.email, key) >= settings.login_max_failures_per_email
        or await failures(LoginAttempt.ip, ip) >= settings.login_max_failures_per_ip
    ):
        return SignIn(
            None,
            None,
            AppError(
                "too_many_attempts",
                f"Too many sign-in attempts. Wait {settings.login_window_minutes} minutes and try again.",
                status=429,
            ),
        )

    user = (await session.execute(select(User).where(User.email == key))).scalar_one_or_none()
    matches = await verify_password(user.password_hash if user else None, password)
    ok = user is not None and matches and user.is_active
    session.add(LoginAttempt(email=key, ip=ip[:64], succeeded=ok, at=now))
    if not ok or user is None:
        await session.flush()
        return SignIn(None, None, INVALID)

    user.last_login_at = now
    token = secrets.token_urlsafe(32)
    session.add(
        UserSession(
            id=token_key(token),
            user_id=user.id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(hours=settings.session_max_hours),
        )
    )
    await audit.record(session, actor=user, action="signed_in", subject_type="user", subject_id=str(user.id))
    return SignIn(user, token, None)


async def session_user(
    session: AsyncSession, settings: Settings, token: str, *, touch: bool
) -> tuple[User | None, UserSession | None]:
    """The user a session cookie belongs to, or None when the session is unknown, idle too long, past its end, or
    its account is deactivated. `touch` is false for background polling, so polling alone never keeps a session
    alive."""
    row = await session.get(UserSession, token_key(token))
    now = utcnow()
    if (
        row is None
        or row.expires_at <= now
        or row.last_seen_at + timedelta(minutes=settings.session_idle_minutes) <= now
    ):
        return None, None
    user = await session.get(User, row.user_id)
    if user is None or not user.is_active:
        return None, None
    # Written at most once a minute, so a busy screen does not write on every request
    if touch and now - row.last_seen_at > timedelta(minutes=1):
        row.last_seen_at = now
    return user, row


async def end_session(session: AsyncSession, token: str) -> None:
    await session.execute(delete(UserSession).where(UserSession.id == token_key(token)))


async def end_all_sessions(session: AsyncSession, user_id: uuid.UUID, *, keep: str | None = None) -> None:
    query = delete(UserSession).where(UserSession.user_id == user_id)
    if keep:
        query = query.where(UserSession.id != keep)
    await session.execute(query)


async def change_password(
    session: AsyncSession,
    user: User,
    current: str,
    new: str,
    keep_session: str | None,
    default_password: str | None = None,
) -> None:
    if not await verify_password(user.password_hash, current):
        raise AppError("wrong_password", "The current password is not right.", status=400)
    problem = password_problem(new)
    if problem:
        raise AppError("weak_password", problem, status=400)
    if new == current:
        raise AppError("weak_password", "Choose a password different from the current one.", status=400)
    if default_password and new == default_password:
        raise AppError("weak_password", "Choose a password different from the default one.", status=400)
    user.password_hash = await hash_password(new)
    user.must_change_password = False
    user.password_is_default = False
    await end_all_sessions(session, user.id, keep=keep_session)
    await audit.record(session, actor=user, action="password_changed", subject_type="user", subject_id=str(user.id))
