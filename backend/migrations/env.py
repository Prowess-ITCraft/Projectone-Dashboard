import asyncio
import os

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.models import Base

config = context.config
target_metadata = Base.metadata


def _url() -> str:
    # A caller (the tests, a deploy script) may set the URL on the config; otherwise the application settings decide.
    return config.get_main_option("sqlalchemy.url") or os.environ.get("DATABASE_URL") or get_settings().database_url


def _migrate(connection) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def _run_online() -> None:
    engine = create_async_engine(_url())
    async with engine.connect() as connection:
        await connection.run_sync(_migrate)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(_run_online())
