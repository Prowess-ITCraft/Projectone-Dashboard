"""Starts a local PostgreSQL 16 without Docker, for development on a machine where Docker is not running.

    python scripts/local_postgres.py

It keeps its data in backend/.pgdata (ignored by Git), prints the DATABASE_URL to use, and stops when you press
Enter. Uses the pgserver package from requirements-dev.txt.
"""

from pathlib import Path

import pgserver  # type: ignore[import-untyped,unused-ignore]
from sqlalchemy.engine import make_url

DATA = Path(__file__).resolve().parent.parent / ".pgdata"


def main() -> None:
    server = pgserver.get_server(DATA, cleanup_mode="stop")
    url = make_url(server.get_uri()).set(drivername="postgresql+asyncpg").render_as_string(hide_password=False)
    print(f"DATABASE_URL={url}")
    input("PostgreSQL is running. Press Enter to stop it.\n")
    server.cleanup()


if __name__ == "__main__":
    main()
