from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.identifiers import customer_number, financial_year, project_number


async def next_counter(session: AsyncSession, key: str) -> int:
    """Atomic: one statement inserts or increments and returns the new value, so two requests at once
    can never receive the same number."""
    result = await session.execute(
        text(
            "INSERT INTO counters (key, value) VALUES (:key, 1) "
            "ON CONFLICT (key) DO UPDATE SET value = counters.value + 1 RETURNING value"
        ),
        {"key": key},
    )
    return int(result.scalar_one())


async def next_project_number(session: AsyncSession, now: datetime | None = None) -> str:
    fy = financial_year(now or datetime.now(UTC))
    return project_number(fy, await next_counter(session, f"project:{fy}"))


async def next_customer_number(session: AsyncSession) -> str:
    return customer_number(await next_counter(session, "customer"))
