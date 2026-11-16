import httpx
import pytest
from sqlalchemy import func, select

from app.db import Database
from app.models import AuditLog, Counter, User
from app.services.counters import next_customer_number
from tests.conftest import Clients, as_user


async def test_seed_creates_an_admin_and_an_engineer_and_can_run_twice(
    make_client: Clients, database: Database
) -> None:
    client = make_client()
    first = await client.post("/dev/seed")
    second = await client.post("/dev/seed")
    assert first.json() == second.json() == {"users": ["asha", "ravi"]}
    async with database.sessions() as session:
        users = (await session.execute(select(User).order_by(User.username))).scalars().all()
    assert [(u.username, u.role_key) for u in users] == [("asha", "admin"), ("ravi", "engineer")]


async def test_reset_is_for_an_admin_only(seeded: httpx.AsyncClient, make_client: Clients) -> None:
    anonymous = await make_client().post("/dev/reset")
    engineer = await as_user(make_client, "ravi").post("/dev/reset")
    assert anonymous.status_code == 401
    assert engineer.status_code == 403
    assert engineer.json()["code"] == "forbidden"


async def test_reset_clears_counters_and_keeps_the_audit_log_with_its_own_entry(
    seeded: httpx.AsyncClient, make_client: Clients, database: Database
) -> None:
    async with database.sessions() as session, session.begin():
        await next_customer_number(session)
    response = await as_user(make_client, "asha").post("/dev/reset")
    assert response.status_code == 200
    async with database.sessions() as session:
        assert (await session.execute(select(func.count()).select_from(Counter))).scalar_one() == 0
        entry = (await session.execute(select(AuditLog).where(AuditLog.action == "dev_reset"))).scalar_one()
        assert (await session.execute(select(func.count()).select_from(User))).scalar_one() == 2
    assert entry.actor_label == "Asha, admin"


@pytest.mark.parametrize("environment", ["staging", "production"])
async def test_the_development_tools_do_not_exist_outside_development(make_client: Clients, environment: str) -> None:
    client = make_client(environment)
    assert (await client.post("/dev/seed")).status_code == 404
    assert (await client.post("/dev/reset")).status_code == 404
    paths = (await client.get("/openapi.json")).json()["paths"]
    assert not [p for p in paths if p.startswith("/dev")]


@pytest.mark.parametrize("environment", ["staging", "production"])
async def test_the_stand_in_header_is_refused_outside_development(
    seeded: httpx.AsyncClient, make_client: Clients, environment: str
) -> None:
    response = await make_client(environment, **{"X-Dev-User": "asha"}).get("/me")
    assert response.status_code == 401
    assert response.json()["code"] == "dev_header_not_allowed"


async def test_outside_development_nobody_is_signed_in_at_all(seeded: httpx.AsyncClient, make_client: Clients) -> None:
    response = await make_client("production").get("/me")
    assert response.status_code == 401
    assert response.json()["code"] == "not_signed_in"


async def test_documentation_pages_are_development_only(make_client: Clients) -> None:
    assert (await make_client("development").get("/docs")).status_code == 200
    assert (await make_client("production").get("/docs")).status_code == 404
