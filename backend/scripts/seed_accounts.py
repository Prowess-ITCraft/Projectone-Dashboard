"""Creates the first accounts: one Admin and ten engineers (Engineer 01 to Engineer 10).

Run from the backend folder after `alembic upgrade head`:

    ADMIN_EMAIL=... ADMIN_PASSWORD=... DEFAULT_ENGINEER_PASSWORD=... .venv/Scripts/python scripts/seed_accounts.py

Settings (from the environment or backend/.env):
- DATABASE_URL                the database to seed
- ADMIN_EMAIL                 the Admin's email (required)
- ADMIN_PASSWORD              the Admin's first password, at least 10 characters (required; never in the repository)
- DEFAULT_ENGINEER_PASSWORD   the starting password of every engineer, at least 10 characters (required; never stored
                              in the repository, and only its hash goes into the database)
- ADMIN_NAME                  the Admin's name (default "Admin")
- ENGINEER_EMAIL_DOMAIN       domain for engineer01@... to engineer10@... (default: the domain of ADMIN_EMAIL)

Every engineer gets the same default password and must choose a new one at first sign-in. The Admin sends each engineer
their email and the default password (the Users page has "Copy login details"). Running the script again creates only
what is missing and never changes an existing password, so an engineer's own password is safe.
"""

import asyncio
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.config import get_settings  # noqa: E402
from app.db import create_database  # noqa: E402
from app.errors import AppError  # noqa: E402
from app.services.accounts import Seeded, seed_accounts  # noqa: E402


def load_env(path: Path) -> None:
    """Reads KEY=VALUE lines from a local .env into the environment, without overriding what is already set."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


async def seed(database_url: str) -> list[Seeded]:
    database = create_database(database_url)
    try:
        async with database.sessions() as session, session.begin():
            return await seed_accounts(
                session,
                admin_email=os.environ.get("ADMIN_EMAIL", ""),
                admin_password=os.environ.get("ADMIN_PASSWORD", ""),
                admin_name=os.environ.get("ADMIN_NAME", "Admin"),
                engineer_domain=os.environ.get("ENGINEER_EMAIL_DOMAIN") or None,
                default_password=os.environ.get("DEFAULT_ENGINEER_PASSWORD", ""),
            )
    finally:
        await database.engine.dispose()


def main() -> int:
    load_env(BACKEND / ".env")
    missing = [k for k in ("ADMIN_EMAIL", "ADMIN_PASSWORD", "DEFAULT_ENGINEER_PASSWORD") if not os.environ.get(k)]
    if missing:
        print(f"Set {', '.join(missing)} (in the environment or backend/.env) and run again.", file=sys.stderr)
        return 2
    try:
        results = asyncio.run(seed(os.environ.get("DATABASE_URL") or get_settings().database_url))
    except AppError as error:
        print(error.message, file=sys.stderr)
        return 2

    for s in results:
        print(f"{'created' if s.created else 'exists '}  {s.role:<8}  {s.email}")
    made = sum(1 for s in results if s.created and s.role == "engineer")
    print()
    print(f"{made} engineer accounts created with the default password. They must choose a new one at first sign-in.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
