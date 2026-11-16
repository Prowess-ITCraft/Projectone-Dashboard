from datetime import UTC, datetime, timedelta

IST = timedelta(hours=5, minutes=30)


def financial_year(moment: datetime) -> str:
    """Indian financial year (April to March) as the four digits used in numbers: 2026-11-16 gives "2627".
    The year is decided by the date in India, so 20:00 UTC on 31 March is already 1 April."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    india = (moment.astimezone(UTC) + IST).replace(tzinfo=None)
    start = india.year if india.month >= 4 else india.year - 1
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def project_number(fy: str, n: int) -> str:
    return f"PRJ-{fy}-{n:04d}"


def customer_number(n: int) -> str:
    return f"CUS-{n:04d}"
