"""Sign-in, sessions, accounts, assignments, notifications and who may see which project."""

import uuid
from datetime import timedelta
from typing import Any

import httpx
from sqlalchemy import func, select, update

from app.db import Database
from app.main import create_app
from app.models import Notification, User, UserSession
from app.services.accounts import seed_accounts
from app.services.auth import SESSION_COOKIE, hash_password, verify_password
from tests.conftest import DEFAULT_PASSWORD, Clients, settings_for

PASSWORD = "correct horse battery"


async def make_user(
    database: Database,
    email: str,
    role: str = "engineer",
    *,
    name: str | None = None,
    active: bool = True,
    must_change: bool = False,
) -> uuid.UUID:
    async with database.sessions() as session, session.begin():
        user = User(
            email=email,
            full_name=name or email.split("@")[0].title(),
            role=role,
            password_hash=await hash_password(PASSWORD),
            is_active=active,
            must_change_password=must_change,
        )
        session.add(user)
        await session.flush()
        return user.id


async def signed_in(make_client: Clients, email: str, password: str = PASSWORD) -> httpx.AsyncClient:
    client = make_client()
    response = await client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return client


async def login(client: httpx.AsyncClient, email: str, password: str) -> httpx.Response:
    return await client.post("/auth/login", json={"email": email, "password": password})


def _ms() -> int:
    return 1_763_000_000_000


async def create_project(admin: httpx.AsyncClient, number: str, customer_name: str) -> str:
    """A customer and a project, written the way the frontend's data layer writes them."""
    customer_id, project_id = str(uuid.uuid4()), str(uuid.uuid4())
    customer = {
        "id": customer_id,
        "number": f"CUS-{number[-4:]}",
        "name": customer_name,
        "gstin": "",
        "createdAt": _ms(),
    }
    project = {
        "id": project_id,
        "number": number,
        "customerId": customer_id,
        "status": "in_progress",
        "siteIds": [],
        "createdAt": _ms(),
    }
    response = await admin.post(
        "/store/batch",
        json={
            "ops": [
                {"op": "put", "store": "customers", "id": customer_id, "data": customer},
                {"op": "put", "store": "projects", "id": project_id, "data": project},
            ]
        },
    )
    assert response.status_code == 204, response.text
    return project_id


def document(project_id: str) -> dict[str, Any]:
    doc_id = str(uuid.uuid4())
    return {
        "op": "put",
        "store": "documents",
        "id": doc_id,
        "data": {"id": doc_id, "projectId": project_id, "type": "pi", "number": "PI/1"},
    }


# sign-in


async def test_sign_in_succeeds_sets_a_private_cookie_and_records_the_time(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "eng@test.com", name="Engineer One")
    client = make_client()
    response = await login(client, " ENG@test.com ", PASSWORD)
    assert response.status_code == 200
    assert response.json()["email"] == "eng@test.com"
    assert response.json()["role"] == "engineer"
    cookie = response.headers["set-cookie"]
    assert SESSION_COOKIE in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert PASSWORD not in response.text
    me = await client.get("/me")
    assert me.json()["full_name"] == "Engineer One"
    async with database.sessions() as session:
        user = (await session.execute(select(User).where(User.email == "eng@test.com"))).scalar_one()
    assert user.last_login_at is not None
    assert user.password_hash and PASSWORD not in user.password_hash


async def test_every_failed_sign_in_gives_the_same_answer(make_client: Clients, database: Database) -> None:
    await make_user(database, "eng@test.com")
    await make_user(database, "gone@test.com", active=False)
    client = make_client()
    answers = [
        await login(client, "eng@test.com", "wrong password"),
        await login(client, "nobody@test.com", PASSWORD),
        await login(client, "gone@test.com", PASSWORD),
    ]
    assert {r.status_code for r in answers} == {401}
    assert {(r.json()["code"], r.json()["message"]) for r in answers} == {
        ("invalid_credentials", "That email and password do not match.")
    }
    assert all(SESSION_COOKIE not in r.headers.get("set-cookie", "") for r in answers)


async def test_a_deactivated_user_cannot_sign_in_and_their_session_ends(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "admin@test.com", "admin")
    engineer_id = await make_user(database, "eng@test.com")
    engineer = await signed_in(make_client, "eng@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    assert (await admin.post(f"/users/{engineer_id}/deactivate")).status_code == 200
    assert (await engineer.get("/me")).status_code == 401
    refused = await login(make_client(), "eng@test.com", PASSWORD)
    assert refused.status_code == 401
    assert refused.json()["code"] == "invalid_credentials"


async def test_repeated_failures_are_limited_even_with_the_right_password_after(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "eng@test.com")
    client = make_client()
    for _ in range(5):
        assert (await login(client, "eng@test.com", "wrong password")).status_code == 401
    blocked = await login(client, "eng@test.com", PASSWORD)
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "too_many_attempts"


async def test_sign_out_ends_the_session(make_client: Clients, database: Database) -> None:
    await make_user(database, "eng@test.com")
    client = await signed_in(make_client, "eng@test.com")
    stolen = client.cookies.get(SESSION_COOKIE)
    assert (await client.post("/auth/logout")).status_code == 204
    replay = make_client()
    replay.cookies.set(SESSION_COOKIE, stolen or "")
    assert (await replay.get("/me")).status_code == 401


async def test_a_session_ends_after_inactivity_and_polling_does_not_keep_it_alive(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "eng@test.com")
    client = await signed_in(make_client, "eng@test.com")
    async with database.sessions() as session, session.begin():
        await session.execute(update(UserSession).values(last_seen_at=UserSession.last_seen_at - timedelta(minutes=20)))
    before = await _last_seen(database)
    assert (await client.get("/notifications", headers={"X-Background": "1"})).status_code == 200
    assert await _last_seen(database) == before
    async with database.sessions() as session, session.begin():
        await session.execute(update(UserSession).values(last_seen_at=UserSession.last_seen_at - timedelta(minutes=11)))
    expired = await client.get("/me")
    assert expired.status_code == 401
    assert expired.json()["code"] == "session_expired"


async def _last_seen(database: Database) -> Any:
    async with database.sessions() as session:
        return (await session.execute(select(UserSession.last_seen_at))).scalar_one()


async def test_a_change_with_the_cookie_needs_the_request_header(make_client: Clients, database: Database) -> None:
    await make_user(database, "eng@test.com")
    client = await signed_in(make_client, "eng@test.com")
    response = await client.post("/notifications/read-all", headers={"X-Requested-With": "other"})
    assert response.status_code == 403
    assert response.json()["code"] == "missing_request_header"


async def test_a_temporary_password_must_be_changed_before_anything_else(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "eng@test.com", must_change=True)
    client = await signed_in(make_client, "eng@test.com")
    assert (await client.get("/me")).json()["must_change_password"] is True
    blocked = await client.get("/my/projects")
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"
    weak = await client.post("/auth/change-password", json={"current_password": PASSWORD, "new_password": "short"})
    assert weak.status_code == 400
    wrong = await client.post(
        "/auth/change-password", json={"current_password": "not it at all", "new_password": "a much longer one"}
    )
    assert wrong.json()["code"] == "wrong_password"
    done = await client.post(
        "/auth/change-password", json={"current_password": PASSWORD, "new_password": "a much longer one"}
    )
    assert done.status_code == 200
    assert done.json()["must_change_password"] is False
    assert (await client.get("/my/projects")).status_code == 200
    assert (await login(make_client(), "eng@test.com", "a much longer one")).status_code == 200


# who sees what


async def test_an_engineer_cannot_open_a_project_they_are_not_assigned_to(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "admin@test.com", "admin")
    engineer_id = await make_user(database, "eng@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    mine = await create_project(admin, "PRJ-2627-0001", "Alpha Ltd")
    other = await create_project(admin, "PRJ-2627-0002", "Beta Ltd")
    assert (
        await admin.put(f"/projects/{mine}/assignments", json={"engineer_ids": [str(engineer_id)]})
    ).status_code == 200
    engineer = await signed_in(make_client, "eng@test.com")

    assert [p["number"] for p in (await engineer.get("/my/projects")).json()] == ["PRJ-2627-0001"]
    assert (await engineer.get(f"/projects/{mine}/work")).status_code == 200
    assert (await engineer.get(f"/projects/{mine}/checklist")).json()["steps"] == []
    for path in (
        f"/projects/{other}/work",
        f"/projects/{other}/assignments",
        f"/projects/{other}/checklist",
    ):
        response = await engineer.get(path)
        assert response.status_code == 404, path
        assert response.json()["code"] == "not_found"
    # the record store is for the Admin screens: an engineer gets nothing from it, assigned project or not
    assert (await engineer.get("/store/projects")).status_code == 403
    assert (await engineer.get(f"/store/projects/{mine}")).status_code == 403
    assert (await engineer.post("/store/batch", json={"ops": [document(mine)]})).status_code == 403


async def test_an_engineer_cannot_change_stages_projects_or_the_checklist(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "admin@test.com", "admin")
    engineer_id = await make_user(database, "eng@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    project_id = await create_project(admin, "PRJ-2627-0001", "Alpha Ltd")
    await admin.put(f"/projects/{project_id}/assignments", json={"engineer_ids": [str(engineer_id)]})
    engineer = await signed_in(make_client, "eng@test.com")
    project = (await engineer.get(f"/store/projects/{project_id}")).json()
    attempts = [
        {"op": "put", "store": "projects", "id": project_id, "data": {**project, "intake": {"by": "me"}}},
        {"op": "put", "store": "modules", "id": "m1", "data": {"id": "m1", "projectId": project_id}},
        {"op": "put", "store": "checklist", "id": "current", "data": {}},
    ]
    for op in attempts:
        response = await engineer.post("/store/batch", json={"ops": [op]})
        assert response.status_code == 403, op["store"]
    assert (await engineer.post("/store/counters/counter:customer")).status_code == 403
    assert (await engineer.post("/store/reset")).status_code == 403


async def _locked_project(make_client: Clients, database: Database, status: str) -> tuple[httpx.AsyncClient, str, dict[str, Any]]:
    await make_user(database, "admin@test.com", "admin")
    admin = await signed_in(make_client, "admin@test.com")
    project_id = await create_project(admin, "PRJ-2627-0001", "Alpha Ltd")
    project = (await admin.get(f"/store/projects/{project_id}")).json()
    locked = {**project, "status": status, "statusReason": "Waiting"}
    response = await admin.post("/store/batch", json={"ops": [_put_project(project_id, locked)]})
    assert response.status_code == 204, response.text
    return admin, project_id, locked


def _put_project(project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"op": "put", "store": "projects", "id": project_id, "data": data}


async def test_a_closed_project_cannot_be_edited_through_the_store(make_client: Clients, database: Database) -> None:
    admin, project_id, closed = await _locked_project(make_client, database, "closed")
    response = await admin.post("/store/batch", json={"ops": [_put_project(project_id, {**closed, "purpose": "x"})]})
    assert response.status_code == 409
    assert response.json()["code"] == "project_locked"


async def test_a_closed_project_cannot_be_deleted_through_the_store(make_client: Clients, database: Database) -> None:
    admin, project_id, _ = await _locked_project(make_client, database, "closed")
    response = await admin.post("/store/batch", json={"ops": [{"op": "delete", "store": "projects", "id": project_id}]})
    assert response.status_code == 409
    assert response.json()["code"] == "project_locked"
    assert (await admin.get(f"/store/projects/{project_id}")).status_code == 200


async def test_an_edit_cannot_ride_along_with_a_status_change(make_client: Clients, database: Database) -> None:
    admin, project_id, held = await _locked_project(make_client, database, "on_hold")
    edited = {**held, "status": "in_progress", "statusReason": "", "purpose": "sneaked in"}
    response = await admin.post("/store/batch", json={"ops": [_put_project(project_id, edited)]})
    assert response.status_code == 409
    assert response.json()["code"] == "project_locked"
    assert (await admin.get(f"/store/projects/{project_id}")).json()["status"] == "on_hold"


async def test_a_closed_project_cannot_be_reopened(make_client: Clients, database: Database) -> None:
    admin, project_id, closed = await _locked_project(make_client, database, "closed")
    reopened = {**closed, "status": "in_progress", "statusReason": ""}
    response = await admin.post("/store/batch", json={"ops": [_put_project(project_id, reopened)]})
    assert response.status_code == 409
    assert response.json()["code"] == "project_locked"
    assert (await admin.get(f"/store/projects/{project_id}")).json()["status"] == "closed"


async def test_an_admin_can_resume_an_on_hold_project_by_changing_only_its_status(
    make_client: Clients, database: Database
) -> None:
    admin, project_id, held = await _locked_project(make_client, database, "on_hold")
    resumed = {**held, "status": "in_progress", "statusReason": ""}
    response = await admin.post("/store/batch", json={"ops": [_put_project(project_id, resumed)]})
    assert response.status_code == 204, response.text
    assert (await admin.get(f"/store/projects/{project_id}")).json()["status"] == "in_progress"


async def test_a_project_in_progress_can_still_be_edited(make_client: Clients, database: Database) -> None:
    admin, project_id, _ = await _locked_project(make_client, database, "in_progress")
    project = (await admin.get(f"/store/projects/{project_id}")).json()
    response = await admin.post("/store/batch", json={"ops": [_put_project(project_id, {**project, "purpose": "x"})]})
    assert response.status_code == 204, response.text
    assert (await admin.get(f"/store/projects/{project_id}")).json()["purpose"] == "x"


async def test_a_batch_is_saved_completely_or_not_at_all(make_client: Clients, database: Database) -> None:
    await make_user(database, "admin@test.com", "admin")
    admin = await signed_in(make_client, "admin@test.com")
    project_id = await create_project(admin, "PRJ-2627-0001", "Alpha Ltd")
    good = document(project_id)
    bad = {"op": "put", "store": "lines", "id": "l1", "data": {"id": "l1", "projectId": str(uuid.uuid4())}}
    assert (await admin.post("/store/batch", json={"ops": [good, bad]})).status_code == 404
    assert (await admin.get("/store/documents")).json() == []


async def test_the_activity_log_takes_its_actor_from_the_session(make_client: Clients, database: Database) -> None:
    await make_user(database, "admin@test.com", "admin", name="Head Admin")
    admin = await signed_in(make_client, "admin@test.com")
    project_id = await create_project(admin, "PRJ-2627-0001", "Alpha Ltd")
    entry_id = str(uuid.uuid4())
    forged = {"id": entry_id, "action": "line_edited", "projectId": project_id, "actor": {"name": "Someone else"}}
    await admin.post("/store/batch", json={"ops": [{"op": "put", "store": "audit", "id": entry_id, "data": forged}]})
    [entry] = [a for a in (await admin.get("/store/audit")).json() if a["id"] == entry_id]
    assert entry["actor"]["name"] == "Head Admin"
    refused = await admin.post("/store/batch", json={"ops": [{"op": "delete", "store": "audit", "id": entry_id}]})
    assert refused.status_code == 403


async def test_an_engineer_cannot_open_the_users_page(make_client: Clients, database: Database) -> None:
    await make_user(database, "eng@test.com")
    engineer = await signed_in(make_client, "eng@test.com")
    for response in (
        await engineer.get("/users"),
        await engineer.post("/users", json={"full_name": "New Person", "email": "new@test.com"}),
    ):
        assert response.status_code == 403
        assert response.json()["code"] == "forbidden"


# assignments and alerts


async def test_assigning_notifies_only_the_engineer_assigned(make_client: Clients, database: Database) -> None:
    await make_user(database, "admin@test.com", "admin")
    first = await make_user(database, "one@test.com")
    await make_user(database, "two@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    project_id = await create_project(admin, "PRJ-2627-0007", "Alpha Ltd")

    assigned = await admin.put(f"/projects/{project_id}/assignments", json={"engineer_ids": [str(first)]})
    assert [a["email"] for a in assigned.json()] == ["one@test.com"]

    one = await signed_in(make_client, "one@test.com")
    two = await signed_in(make_client, "two@test.com")
    alerts = (await one.get("/notifications")).json()
    assert alerts["unread_count"] == 1
    assert alerts["items"][0]["message"] == "New project assigned: PRJ-2627-0007, Alpha Ltd"
    assert alerts["items"][0]["project_id"] == project_id
    assert (await two.get("/notifications")).json() == {"unread_count": 0, "items": []}

    # assigning the same list again changes nothing and sends nothing
    await admin.put(f"/projects/{project_id}/assignments", json={"engineer_ids": [str(first)]})
    assert (await one.get("/notifications")).json()["unread_count"] == 1

    read = await one.post(f"/notifications/{alerts['items'][0]['id']}/read")
    assert read.json()["is_read"] is True
    assert (await two.post(f"/notifications/{alerts['items'][0]['id']}/read")).status_code == 404


async def test_removing_an_engineer_notifies_them_and_closes_the_project_to_them(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "admin@test.com", "admin")
    engineer_id = await make_user(database, "one@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    project_id = await create_project(admin, "PRJ-2627-0003", "Alpha Ltd")
    await admin.put(f"/projects/{project_id}/assignments", json={"engineer_ids": [str(engineer_id)]})
    assert (await admin.delete(f"/projects/{project_id}/assignments/{engineer_id}")).status_code == 204

    engineer = await signed_in(make_client, "one@test.com")
    messages = [n["message"] for n in (await engineer.get("/notifications")).json()["items"]]
    assert messages == [
        "Removed from project: PRJ-2627-0003, Alpha Ltd",
        "New project assigned: PRJ-2627-0003, Alpha Ltd",
    ]
    assert (await engineer.get(f"/projects/{project_id}/work")).status_code == 404
    assert (await engineer.get("/my/projects")).json() == []
    assert (await engineer.get("/assignments")).json() == []
    activity = [a["action"] for a in (await admin.get("/store/audit")).json() if a.get("projectId") == project_id]
    assert activity == ["engineer_assigned", "engineer_removed"]


async def test_only_active_engineers_can_be_assigned_and_only_by_an_admin(
    make_client: Clients, database: Database
) -> None:
    admin_id = await make_user(database, "admin@test.com", "admin")
    gone = await make_user(database, "gone@test.com", active=False)
    engineer_id = await make_user(database, "one@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    project_id = await create_project(admin, "PRJ-2627-0004", "Alpha Ltd")
    for ids in ([str(gone)], [str(admin_id)]):
        response = await admin.put(f"/projects/{project_id}/assignments", json={"engineer_ids": ids})
        assert response.json()["code"] == "not_an_engineer"
    await admin.put(f"/projects/{project_id}/assignments", json={"engineer_ids": [str(engineer_id)]})
    engineer = await signed_in(make_client, "one@test.com")
    refused = await engineer.put(f"/projects/{project_id}/assignments", json={"engineer_ids": []})
    assert refused.status_code == 403


# accounts


async def test_an_admin_adds_an_engineer_with_the_default_password_and_resets_to_it(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "admin@test.com", "admin")
    admin = await signed_in(make_client, "admin@test.com")
    added = await admin.post("/users", json={"full_name": "  New   Person ", "email": "New@Test.com"})
    assert added.status_code == 201
    body = added.json()
    assert body["user"]["full_name"] == "New Person"
    assert body["user"]["email"] == "new@test.com"
    assert body["user"]["must_change_password"] is True
    assert body["user"]["password_is_default"] is True
    assert body["temporary_password"] == DEFAULT_PASSWORD
    assert (await admin.post("/users", json={"full_name": "Again", "email": "new@test.com"})).status_code == 409
    assert (await login(make_client(), "new@test.com", DEFAULT_PASSWORD)).json()["must_change_password"] is True
    async with database.sessions() as session:
        stored = (await session.execute(select(User).where(User.email == "new@test.com"))).scalar_one()
        assert DEFAULT_PASSWORD not in (stored.password_hash or "")

    # the engineer chooses their own password, then an Admin can no longer copy login details
    engineer = await signed_in(make_client, "new@test.com", DEFAULT_PASSWORD)
    changed = await engineer.post(
        "/auth/change-password", json={"current_password": DEFAULT_PASSWORD, "new_password": "my own long password"}
    )
    assert changed.status_code == 200
    user_id = body["user"]["id"]
    listed = {u["email"]: u for u in (await admin.get("/users")).json()}
    assert listed["new@test.com"]["password_is_default"] is False
    refused = await admin.get(f"/users/{user_id}/login-details")
    assert refused.status_code == 409
    assert "my own long password" not in refused.text

    # reset to default: the default works again, a change is forced, and login details are available again
    reset = await admin.post(f"/users/{user_id}/reset-password")
    assert reset.json()["temporary_password"] == DEFAULT_PASSWORD
    assert (await login(make_client(), "new@test.com", "my own long password")).status_code == 401
    assert (await login(make_client(), "new@test.com", DEFAULT_PASSWORD)).json()["must_change_password"] is True
    details = await admin.get(f"/users/{user_id}/login-details")
    assert details.json() == {"email": "new@test.com", "password": DEFAULT_PASSWORD}
    assert details.headers["cache-control"] == "no-store"
    me = (await admin.get("/me")).json()
    assert (await admin.post(f"/users/{me['id']}/deactivate")).json()["code"] == "cannot_deactivate_self"


async def test_only_an_admin_can_copy_login_details(make_client: Clients, database: Database) -> None:
    await make_user(database, "admin@test.com", "admin")
    other = await make_user(database, "other@test.com")
    await make_user(database, "eng@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    added = (await admin.post("/users", json={"full_name": "New Person", "email": "new@test.com"})).json()
    engineer = await signed_in(make_client, "eng@test.com")
    assert (await engineer.get(f"/users/{added['user']['id']}/login-details")).status_code == 403
    # an account that never held the default (made with another password) has nothing to copy
    assert (await admin.get(f"/users/{other}/login-details")).status_code == 409


async def test_without_a_default_password_engineers_cannot_be_added_or_reset(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "admin@test.com", "admin")
    engineer_id = await make_user(database, "eng@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    app = create_app(settings_for(default_password=None), database)
    admin.cookies.set(SESSION_COOKIE, admin.cookies[SESSION_COOKIE])
    client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
        headers={"X-Requested-With": "ProjectOne"},
        cookies=admin.cookies,
    )
    try:
        added = await client.post("/users", json={"full_name": "New Person", "email": "new@test.com"})
        assert added.status_code == 503
        assert added.json()["code"] == "default_password_not_set"
        assert (await client.post(f"/users/{engineer_id}/reset-password")).status_code == 503
    finally:
        await client.aclose()


async def test_an_engineer_on_the_default_password_is_blocked_until_they_change_it(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "admin@test.com", "admin")
    admin = await signed_in(make_client, "admin@test.com")
    await admin.post("/users", json={"full_name": "New Person", "email": "new@test.com"})
    engineer = await signed_in(make_client, "new@test.com", DEFAULT_PASSWORD)
    assert (await engineer.get("/me")).json()["must_change_password"] is True
    for path in ("/my/projects", "/assignments", "/notifications"):
        blocked = await engineer.get(path)
        assert blocked.status_code == 403, path
        assert blocked.json()["code"] == "password_change_required", path
    assert (await engineer.post("/notifications/read-all")).json()["code"] == "password_change_required"

    # the new password must not be the default, and must be long enough
    same = await engineer.post(
        "/auth/change-password", json={"current_password": DEFAULT_PASSWORD, "new_password": DEFAULT_PASSWORD}
    )
    assert same.status_code == 400
    assert same.json()["code"] == "weak_password"
    short = await engineer.post(
        "/auth/change-password", json={"current_password": DEFAULT_PASSWORD, "new_password": "short"}
    )
    assert short.status_code == 400
    assert (await engineer.get("/assignments")).status_code == 403

    done = await engineer.post(
        "/auth/change-password", json={"current_password": DEFAULT_PASSWORD, "new_password": "a much longer one"}
    )
    assert done.status_code == 200
    assert (await engineer.get("/assignments")).status_code == 200
    # later, choosing the default again as a new password is refused too
    again = await engineer.post(
        "/auth/change-password", json={"current_password": "a much longer one", "new_password": DEFAULT_PASSWORD}
    )
    assert again.status_code == 400


async def test_the_seed_creates_one_admin_and_ten_engineers_once_and_keeps_changed_passwords(
    database: Database,
) -> None:
    async with database.sessions() as session, session.begin():
        first = await seed_accounts(
            session,
            admin_email="Boss@Example.com",
            admin_password="a long admin pass",
            default_password=DEFAULT_PASSWORD,
        )
    # an engineer chooses their own password before the script is run again
    async with database.sessions() as session, session.begin():
        chosen = (await session.execute(select(User).where(User.email == "engineer01@example.com"))).scalar_one()
        chosen.password_hash = await hash_password("engineer one chose this")
        chosen.must_change_password = False
        chosen.password_is_default = False
    async with database.sessions() as session, session.begin():
        second = await seed_accounts(
            session,
            admin_email="boss@example.com",
            admin_password="another long pass",
            default_password="a different default",
        )
    assert [s.created for s in first] == [True] * 11
    assert not any(s.created for s in second)
    engineers = first[1:]
    assert [s.full_name for s in engineers] == [f"Engineer {n:02d}" for n in range(1, 11)]
    assert [s.email for s in engineers][:2] == ["engineer01@example.com", "engineer02@example.com"]
    async with database.sessions() as session:
        users = (await session.execute(select(User).where(User.email.like("%@example.com")))).scalars().all()
        assert (await session.execute(select(func.count()).select_from(Notification))).scalar_one() == 0
        by_email = {u.email: u for u in users}
        assert await verify_password(by_email["engineer01@example.com"].password_hash, "engineer one chose this")
        assert not by_email["engineer01@example.com"].must_change_password
        for n in range(2, 11):
            engineer = by_email[f"engineer{n:02d}@example.com"]
            assert await verify_password(engineer.password_hash, DEFAULT_PASSWORD)
            assert engineer.must_change_password and engineer.password_is_default
            assert DEFAULT_PASSWORD not in (engineer.password_hash or "")
        assert not await verify_password(by_email["boss@example.com"].password_hash, DEFAULT_PASSWORD)
    assert len(users) == 11
    assert [u.must_change_password for u in users].count(True) == 10

    assert [u.role for u in users].count("admin") == 1


async def test_one_save_adds_and_removes_and_notifies_only_the_affected_engineers(
    make_client: Clients, database: Database
) -> None:
    await make_user(database, "admin@test.com", "admin")
    kept = await make_user(database, "kept@test.com")
    dropped = await make_user(database, "dropped@test.com")
    added = await make_user(database, "added@test.com")
    bystander = await make_user(database, "bystander@test.com")
    admin = await signed_in(make_client, "admin@test.com")
    project_id = await create_project(admin, "PRJ-2627-0009", "Alpha Ltd")
    first = [str(kept), str(dropped)]
    assert (await admin.put(f"/projects/{project_id}/assignments", json={"engineer_ids": first})).status_code == 200

    async def alerts(email: str) -> list[str]:
        client = await signed_in(make_client, email)
        return [n["message"] for n in (await client.get("/notifications")).json()["items"]]

    before = {e: await alerts(e) for e in ("kept@test.com", "dropped@test.com", "added@test.com")}
    # one save: keep one engineer, drop one, add one
    wanted = [str(kept), str(added)]
    assert (await admin.put(f"/projects/{project_id}/assignments", json={"engineer_ids": wanted})).status_code == 200
    now = {e: await alerts(e) for e in before}
    assert now["kept@test.com"] == before["kept@test.com"]
    assert len(now["added@test.com"]) == len(before["added@test.com"]) + 1
    assert now["added@test.com"][0] == "New project assigned: PRJ-2627-0009, Alpha Ltd"
    assert len(now["dropped@test.com"]) == len(before["dropped@test.com"]) + 1
    assert "removed" in now["dropped@test.com"][0].lower()
    assert await alerts("bystander@test.com") == []
    assert bystander is not None
