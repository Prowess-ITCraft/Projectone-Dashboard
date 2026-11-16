import httpx
from sqlalchemy import select, text

from app.db import Database
from app.domain.role_matrix import ADMIN_ACTIONS, ENGINEER_ACTIONS, ROLE_ACTIONS, ROLES
from app.models import Role, RoleAction, User
from app.services.permissions import can
from tests.conftest import Clients, as_user


async def _user(database: Database, username: str) -> User:
    async with database.sessions() as session:
        return (await session.execute(select(User).where(User.username == username))).scalar_one()


async def test_the_database_holds_exactly_the_matrix(database: Database) -> None:
    async with database.sessions() as session:
        roles = {r.key: r.label for r in (await session.execute(select(Role))).scalars()}
        rows = (await session.execute(select(RoleAction))).scalars().all()
    assert roles == ROLES
    held: dict[str, set[str]] = {}
    for row in rows:
        held.setdefault(row.role_key, set()).add(row.action)
    assert held == {role: set(actions) for role, actions in ROLE_ACTIONS.items()}


async def test_admin_may_do_everything_an_engineer_may_and_more(seeded: httpx.AsyncClient, database: Database) -> None:
    admin, engineer = await _user(database, "asha"), await _user(database, "ravi")
    async with database.sessions() as session:
        for action in ENGINEER_ACTIONS:
            assert await can(session, engineer, action)
            assert await can(session, admin, action)
        for action in set(ADMIN_ACTIONS) - set(ENGINEER_ACTIONS):
            assert await can(session, admin, action)
            assert not await can(session, engineer, action)


async def test_only_an_admin_may_manage_users_and_decide_duplicates(
    seeded: httpx.AsyncClient, database: Database
) -> None:
    engineer = await _user(database, "ravi")
    async with database.sessions() as session:
        assert not await can(session, engineer, "manage_users")
        assert not await can(session, engineer, "resolve_duplicate")


async def test_nobody_and_an_inactive_user_may_do_nothing(seeded: httpx.AsyncClient, database: Database) -> None:
    async with database.sessions() as session, session.begin():
        assert not await can(session, None, "upload")
        user = (await session.execute(select(User).where(User.username == "asha"))).scalar_one()
        user.active = False
        await session.flush()
        assert not await can(session, user, "upload")


async def test_an_unknown_action_or_role_is_refused(seeded: httpx.AsyncClient, database: Database) -> None:
    admin = await _user(database, "asha")
    async with database.sessions() as session:
        assert not await can(session, admin, "teleport")


async def test_no_action_is_financial(database: Database) -> None:
    banned = ("financ", "money", "price", "amount", "rate", "tax", "payment", "bank", "cost", "margin")
    actions = {a for actions in ROLE_ACTIONS.values() for a in actions}
    assert not [a for a in actions if any(word in a for word in banned)]


async def test_a_new_role_is_data_and_needs_no_code(database: Database) -> None:
    async with database.sessions() as session, session.begin():
        await session.execute(text("INSERT INTO roles (key, label) VALUES ('observer', 'Observer')"))
        await session.execute(text("INSERT INTO role_actions (role_key, action) VALUES ('observer', 'upload')"))
        session.add(User(username="olive", display_name="Olive", role_key="observer"))
    async with database.sessions() as session:
        olive = (await session.execute(select(User).where(User.username == "olive"))).scalar_one()
        assert await can(session, olive, "upload")
        assert not await can(session, olive, "classify")


async def test_me_returns_the_user_and_what_the_role_may_do(seeded: httpx.AsyncClient, make_client: Clients) -> None:
    body = (await as_user(make_client, "ravi").get("/me")).json()
    assert body["username"] == "ravi"
    assert body["role"] == "engineer"
    assert body["actions"] == sorted(ENGINEER_ACTIONS)
    assert "id" in body and "display_name" in body


async def test_roles_lists_permissions_as_data(seeded: httpx.AsyncClient, make_client: Clients) -> None:
    body = (await as_user(make_client, "asha").get("/roles")).json()
    assert {r["key"]: r["actions"] for r in body} == {k: sorted(v) for k, v in ROLE_ACTIONS.items()}


async def test_roles_needs_a_signed_in_user(seeded: httpx.AsyncClient, make_client: Clients) -> None:
    assert (await make_client().get("/roles")).status_code == 401


async def test_an_unknown_dev_user_is_refused(seeded: httpx.AsyncClient, make_client: Clients) -> None:
    response = await as_user(make_client, "nobody").get("/me")
    assert response.status_code == 401
    assert response.json()["code"] == "not_signed_in"
