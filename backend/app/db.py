from collections.abc import AsyncIterator
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


@dataclass
class Database:
    engine: AsyncEngine
    sessions: async_sessionmaker[AsyncSession]

    async def session(self) -> AsyncIterator[AsyncSession]:
        """One transaction per request: it commits when the request succeeds and rolls back when it fails,
        so a change and its audit row are always saved together or not at all."""
        async with self.sessions() as session, session.begin():
            yield session


def create_database(url: str) -> Database:
    engine = create_async_engine(url, pool_pre_ping=True)
    return Database(engine=engine, sessions=async_sessionmaker(engine, expire_on_commit=False))
