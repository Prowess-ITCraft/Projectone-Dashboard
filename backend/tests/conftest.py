"""Test setup. Tests run against a real PostgreSQL, because the rules under test (atomic counters, the append-only
audit trigger, transactions) are database behaviour.

Where the database comes from:
- TEST_DATABASE_URL, when set (CI uses a PostgreSQL service); the role needs permission to create databases.
- otherwise an embedded PostgreSQL (the pgserver package) started in a temporary folder, so a developer needs no
  Docker or installed server to run the suite.

The migrations run once into a template database; every test then gets its own copy, so tests cannot affect each other.
"""

import asyncio
import os
import tempfile
import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import asyncpg
import httpx
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

from app.config import Settings
from app.db import Database, create_database
from app.main import create_app

BACKEND = Path(__file__).resolve().parent.parent
TEMPLATE = "projectone_template"


def _asyncpg_url(url: str) -> str:
    return make_url(url).set(drivername="postgresql+asyncpg").render_as_string(hide_password=False)


@pytest.fixture(scope="session")
def admin_url() -> Any:
    external = os.environ.get("TEST_DATABASE_URL")
    if external:
        yield _asyncpg_url(external)
        return
    import pgserver

    with tempfile.TemporaryDirectory() as folder:
        server = pgserver.get_server(Path(folder) / "pg", cleanup_mode="stop")  # type: ignore[attr-defined]
        yield _asyncpg_url(server.get_uri())
        server.cleanup()


def _plain(url: str) -> str:
    return make_url(url).set(drivername="postgresql").render_as_string(hide_password=False)


def _with_database(url: str, name: str) -> str:
    return make_url(url).set(database=name).render_as_string(hide_password=False)


async def _admin(url: str) -> asyncpg.Connection:
    return await asyncpg.connect(_plain(url))


@pytest_asyncio.fixture(scope="session")
async def template_url(admin_url: str) -> str:
    conn = await _admin(admin_url)
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{TEMPLATE}"')
        await conn.execute(f'CREATE DATABASE "{TEMPLATE}"')
    finally:
        await conn.close()
    url = _with_database(admin_url, TEMPLATE)
    await migrate(url)
    return url


def alembic_config(url: str) -> Config:
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "migrations"))
    config.set_main_option("sqlalchemy.url", url)
    return config


async def migrate(url: str, revision: str = "head", *, down: bool = False) -> None:
    """Runs Alembic in a worker thread, because its environment starts its own event loop."""
    run = command.downgrade if down else command.upgrade
    await asyncio.to_thread(run, alembic_config(url), revision)


@asynccontextmanager
async def scratch_database(admin_url: str, template: str | None) -> AsyncIterator[str]:
    """A throw-away database, copied from the template (or empty when there is no template)."""
    name = f"po_test_{uuid.uuid4().hex[:12]}"
    conn = await _admin(admin_url)
    try:
        suffix = f' TEMPLATE "{template}"' if template else ""
        await conn.execute(f'CREATE DATABASE "{name}"{suffix}')
    finally:
        await conn.close()
    try:
        yield _with_database(admin_url, name)
    finally:
        conn = await _admin(admin_url)
        try:
            await conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        finally:
            await conn.close()


@pytest_asyncio.fixture
async def database(admin_url: str, template_url: str) -> AsyncIterator[Database]:
    async with scratch_database(admin_url, TEMPLATE) as url:
        db = create_database(url)
        try:
            yield db
        finally:
            await db.engine.dispose()


DEFAULT_PASSWORD = "starter-pass-1"  # the tests' stand-in for DEFAULT_ENGINEER_PASSWORD


def settings_for(environment: str = "development", default_password: str | None = DEFAULT_PASSWORD) -> Settings:
    return Settings(
        environment=environment,  # type: ignore[arg-type]
        database_url="postgresql+asyncpg://unused",
        default_engineer_password=default_password,
    )


Clients = Callable[..., httpx.AsyncClient]


@pytest_asyncio.fixture
async def make_client(database: Database) -> AsyncIterator[Clients]:
    """Builds a client for an app in the given environment, all sharing the test's database."""
    opened: list[httpx.AsyncClient] = []

    def build(environment: str = "development", **headers: str) -> httpx.AsyncClient:
        app = create_app(settings_for(environment), database)
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
            # the header the frontend sends with every change; requests that carry the session cookie need it
            headers={"X-Requested-With": "ProjectOne", **headers},
        )
        opened.append(client)
        return client

    yield build
    for client in opened:
        await client.aclose()


@pytest_asyncio.fixture
async def seeded(make_client: Clients) -> httpx.AsyncClient:
    """A development client with the invented accounts created. Use `as_user` to act as one of them."""
    client = make_client()
    response = await client.post("/dev/seed")
    assert response.status_code == 200
    return client


def as_user(make_client: Clients, username: str) -> httpx.AsyncClient:
    return make_client(**{"X-Dev-User": username})
