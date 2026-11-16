import asyncio
from datetime import UTC, datetime

from app.db import Database
from app.domain.identifiers import customer_number, financial_year, project_number
from app.services.counters import next_counter, next_customer_number, next_project_number


def test_financial_year_runs_april_to_march() -> None:
    assert financial_year(datetime(2026, 11, 16, 10, tzinfo=UTC)) == "2627"
    assert financial_year(datetime(2027, 3, 31, 10, tzinfo=UTC)) == "2627"
    assert financial_year(datetime(2027, 4, 1, 10, tzinfo=UTC)) == "2728"


def test_financial_year_follows_the_date_in_india() -> None:
    # 20:00 UTC on 31 March is already 01:30 on 1 April in India
    assert financial_year(datetime(2027, 3, 31, 20, tzinfo=UTC)) == "2728"
    assert financial_year(datetime(2027, 3, 31, 18, tzinfo=UTC)) == "2627"


def test_numbers_are_padded() -> None:
    assert project_number("2627", 1) == "PRJ-2627-0001"
    assert customer_number(42) == "CUS-0042"


async def test_project_numbers_are_sequential_within_a_year(database: Database) -> None:
    async with database.sessions() as session, session.begin():
        first = await next_project_number(session, datetime(2026, 11, 16, tzinfo=UTC))
        second = await next_project_number(session, datetime(2026, 11, 17, tzinfo=UTC))
        next_year = await next_project_number(session, datetime(2027, 4, 2, tzinfo=UTC))
        customer = await next_customer_number(session)
    assert (first, second, next_year, customer) == (
        "PRJ-2627-0001",
        "PRJ-2627-0002",
        "PRJ-2728-0001",
        "CUS-0001",
    )


async def test_twenty_requests_at_once_never_share_a_number(database: Database) -> None:
    async def take() -> int:
        async with database.sessions() as session, session.begin():
            return await next_counter(session, "race")

    numbers = await asyncio.gather(*(take() for _ in range(20)))
    assert sorted(numbers) == list(range(1, 21))
