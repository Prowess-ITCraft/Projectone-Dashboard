"""The engineer's checklist: order, evidence, comments, and everything an engineer must not be able to do.

Steps here are temporary test data made through the Admin route; the app itself ships no sample steps."""

import base64
import uuid
from typing import Any

import httpx
import pytest

from app.db import Database
from tests.conftest import Clients
from tests.test_accounts_and_access import create_project, make_user, signed_in

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 64
HEIC = b"\x00\x00\x00\x18ftypheic" + b"0" * 64
PDF = b"%PDF-1.4\n" + b"0" * 64


def b64(content: bytes) -> str:
    return base64.b64encode(content).decode()


class World:
    def __init__(self, admin: httpx.AsyncClient, eng: httpx.AsyncClient, other: httpx.AsyncClient, project: str):
        self.admin, self.eng, self.other, self.project = admin, eng, other, project
        self.steps: list[str] = []

    def url(self, tail: str = "") -> str:
        return f"/projects/{self.project}/checklist{tail}"

    async def checklist(self, client: httpx.AsyncClient | None = None) -> list[dict[str, Any]]:
        response = await (client or self.eng).get(self.url())
        assert response.status_code == 200, response.text
        steps: list[dict[str, Any]] = response.json()["steps"]
        return steps

    async def evidence(self, index: int, name: str = "photo.png", content: bytes = PNG) -> httpx.Response:
        return await self.eng.post(
            self.url(f"/steps/{self.steps[index]}/evidence"), json={"name": name, "content": b64(content)}
        )

    async def tick(self, index: int) -> httpx.Response:
        return await self.eng.post(self.url(f"/steps/{self.steps[index]}/complete"))

    async def finish(self, index: int) -> None:
        """Marks a step done, attaches one file and finishes it, as an engineer does."""
        assert (await self.tick(index)).status_code == 204
        assert (await self.evidence(index)).status_code == 204
        assert (await self.tick(index)).status_code == 204


@pytest.fixture
async def world(make_client: Clients, database: Database) -> World:
    await make_user(database, "admin@test.com", "admin")
    await make_user(database, "eng@test.com", "engineer", name="Eng One")
    await make_user(database, "other@test.com", "engineer", name="Eng Two")
    admin = await signed_in(make_client, "admin@test.com")
    eng = await signed_in(make_client, "eng@test.com")
    other = await signed_in(make_client, "other@test.com")
    project = await create_project(admin, "PRJ-2026-0001", "Acme Ltd")
    engineers = (await admin.get("/users")).json()
    eng_id = next(u["id"] for u in engineers if u["email"] == "eng@test.com")
    assert (await admin.put(f"/projects/{project}/assignments", json={"engineer_ids": [eng_id]})).status_code == 200
    w = World(admin, eng, other, project)
    for phase, title in (
        ("installation", "Rack the server"),
        ("installation", "Cable the server"),
        ("configuration", "Install the operating system"),
    ):
        created = await admin.post(w.url("/steps"), json={"phase": phase, "title": title})
        assert created.status_code == 201, created.text
        w.steps.append(created.json()["id"])
    return w


# who sees what


async def test_an_engineer_opens_only_assigned_projects(world: World) -> None:
    mine = await world.eng.get("/my/projects")
    assert [p["number"] for p in mine.json()] == ["PRJ-2026-0001"]
    assert mine.json()[0]["step_count"] == 3 and mine.json()[0]["steps_done"] == 0
    assert (await world.eng.get(f"/projects/{world.project}/work")).status_code == 200
    assert (await world.other.get("/my/projects")).json() == []
    assert (await world.other.get(f"/projects/{world.project}/work")).status_code == 404
    assert (await world.other.get(world.url())).status_code == 404
    assert (await world.other.post(world.url(f"/steps/{world.steps[0]}/complete"))).status_code == 404
    assert (
        await world.other.post(world.url(f"/steps/{world.steps[0]}/comments"), json={"body": "hi"})
    ).status_code == 404


async def test_the_engineer_response_carries_only_the_order_lines_and_the_checklist(world: World) -> None:
    doc, other_doc = str(uuid.uuid4()), str(uuid.uuid4())
    lines = [
        {
            "id": "l1",
            "no": 1,
            "title": "Firewall",
            "qty": 2,
            "kind": "product",
            "moduleType": "firewall",
            "documentId": doc,
            "documentOrder": 1,
            "projectId": world.project,
            "unitPrice": 99,
            "suggestion": {"moduleType": "x"},
        },
        {
            "id": "l2",
            "no": 2,
            "title": "Install",
            "qty": 1,
            "kind": "service",
            "pairedToLineId": "l1",
            "documentId": doc,
            "documentOrder": 1,
            "projectId": world.project,
        },
        {
            "id": "l3",
            "no": 3,
            "title": "Old",
            "qty": 1,
            "kind": "product",
            "documentId": other_doc,
            "documentOrder": 2,
            "projectId": world.project,
        },
    ]
    docs = [
        {"id": doc, "projectId": world.project, "type": "po", "active": True, "number": "PO/1", "fileName": "a.pdf"},
        {"id": other_doc, "projectId": world.project, "type": "po", "active": False, "number": "PO/0"},
    ]
    ops = [{"op": "put", "store": "documents", "id": d["id"], "data": d} for d in docs]
    ops += [{"op": "put", "store": "lines", "id": ln["id"], "data": ln} for ln in lines]
    assert (await world.admin.post("/store/batch", json={"ops": ops})).status_code == 204
    body = (await world.eng.get(f"/projects/{world.project}/work")).json()
    assert set(body) == {"project", "lines", "limits", "steps"}
    assert set(body["project"]) == {"id", "number", "customer_name"}
    assert [
        (ln["number"], ln["description"], ln["quantity"], ln["kind"], ln["module"], ln["pairing"])
        for ln in body["lines"]
    ] == [
        (1, "Firewall", 2, "product", "firewall", None),
        (2, "Install", 1, "service", None, "Line 1"),
    ]
    assert set(body["lines"][0]) == {"id", "number", "description", "quantity", "kind", "module", "pairing"}
    text = str(body).lower()
    for word in ("document", "coverage", "sites", "activity", "stage", "price", "fileName".lower()):
        assert word not in text
    # the checklist response of an engineer holds only checklist data too
    assert set((await world.eng.get(world.url())).json()) == {"limits", "steps"}


async def test_an_engineer_is_refused_every_admin_and_editing_route(world: World) -> None:
    step = world.steps[0]
    calls = [
        ("POST", world.url("/steps"), {"phase": "installation", "title": "x"}),
        ("PATCH", world.url(f"/steps/{step}"), {"title": "x"}),
        ("PATCH", world.url(f"/steps/{step}"), {"progress": 100}),
        ("DELETE", world.url(f"/steps/{step}"), None),
        ("PUT", world.url("/order"), {"step_ids": world.steps}),
        ("POST", world.url(f"/steps/{step}/reset"), None),
        ("POST", world.url(f"/steps/{step}/force-complete"), None),
        ("GET", world.url("/export.csv"), None),
        ("PUT", f"/projects/{world.project}/assignments", {"engineer_ids": []}),
        ("DELETE", f"/projects/{world.project}/assignments/{uuid.uuid4()}", None),
        ("GET", "/users", None),
        ("POST", "/users", {"full_name": "A", "email": "a@test.com"}),
        ("GET", "/store/lines", None),
        ("GET", "/store/documents", None),
        ("GET", f"/store/projects/{world.project}", None),
        (
            "POST",
            "/store/batch",
            {"ops": [{"op": "put", "store": "lines", "id": "l9", "data": {"projectId": world.project}}]},
        ),
        (
            "POST",
            "/store/batch",
            {"ops": [{"op": "put", "store": "documents", "id": "d9", "data": {"projectId": world.project}}]},
        ),
        ("POST", "/store/batch", {"ops": [{"op": "put", "store": "projects", "id": str(uuid.uuid4()), "data": {}}]}),
    ]
    for method, url, body in calls:
        response = await world.eng.request(method, url, json=body)
        assert response.status_code == 403, f"{method} {url}: {response.status_code} {response.text}"
    steps = await world.checklist()
    assert [s["title"] for s in steps] == ["Rack the server", "Cable the server", "Install the operating system"]


async def test_admin_keeps_the_admin_controls(world: World) -> None:
    step = world.steps[0]
    assert (
        await world.admin.patch(world.url(f"/steps/{step}"), json={"title": "Rack it", "progress": 20})
    ).status_code == 204
    assert (
        await world.admin.put(world.url("/order"), json={"step_ids": list(reversed(world.steps[:2])) + world.steps[2:]})
    ).status_code == 204
    steps = await world.checklist(world.admin)
    assert [s["title"] for s in steps][:2] == ["Cable the server", "Rack it"]
    csv = await world.admin.get(world.url("/export.csv"))
    assert csv.status_code == 200 and "Cable the server" in csv.text
    assert (await world.admin.post(world.url(f"/steps/{step}/force-complete"))).status_code == 204
    assert (await world.admin.post(world.url(f"/steps/{step}/reset"))).status_code == 204
    assert (await world.admin.delete(world.url(f"/steps/{step}"))).status_code == 204
    assert len(await world.checklist(world.admin)) == 2


# order and completion


async def test_a_step_cannot_be_completed_before_the_one_before_it(world: World) -> None:
    locked = await world.tick(1)
    assert locked.status_code == 409 and locked.json()["code"] == "step_locked"
    assert locked.json()["reason"] == "Complete step 1 first"
    steps = await world.checklist()
    assert steps[1]["locked"] and steps[1]["locked_reason"] == "Complete step 1 first"
    assert steps[2]["locked_reason"] == "Complete the last Installation step first"
    assert not steps[0]["locked"]
    assert (await world.evidence(1)).status_code == 409
    assert (
        await world.eng.post(world.url(f"/steps/{world.steps[1]}/comments"), json={"body": "early"})
    ).status_code == 409
    await world.finish(0)
    assert (await world.tick(1)).status_code == 204


async def test_a_step_is_complete_only_after_evidence(world: World) -> None:
    assert (await world.tick(0)).status_code == 204
    assert (await world.checklist())[0]["state"] == "awaiting_evidence"
    early = await world.tick(0)
    assert early.status_code == 409 and early.json()["code"] == "evidence_required"
    assert (await world.checklist())[0]["state"] == "awaiting_evidence"
    assert (await world.tick(1)).status_code == 409
    assert (await world.evidence(0)).status_code == 204
    assert (await world.tick(0)).status_code == 204
    done = (await world.checklist())[0]
    assert done["state"] == "complete" and done["done"] and done["progress"] == 100
    assert not (await world.checklist())[1]["locked"]


async def test_evidence_needs_a_marked_step(world: World) -> None:
    assert (await world.evidence(0)).status_code == 409  # still pending


async def test_wrong_type_or_size_is_rejected(world: World, database: Database) -> None:
    assert (await world.tick(0)).status_code == 204
    wrong = [
        ("notes.txt", b"just text"),
        ("photo.jpg", b"plain text pretending to be a photo"),
        ("photo.jpg", PDF),  # a PDF called a JPG
        ("report.pdf", PNG),  # a PNG called a PDF
        ("setup.exe", b"MZ" + b"0" * 64),
        ("shot.png", b""),
        ("noext", PNG),
        ("vector.svg", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
    ]
    for name, content in wrong:
        response = await world.evidence(0, name, content)
        assert response.status_code in (400, 415, 422), f"{name}: {response.status_code}"
    big = await world.evidence(0, "big.png", PNG + b"0" * (10 * 1024 * 1024))
    assert big.status_code == 413 and big.json()["code"] == "file_too_large"
    assert (await world.checklist())[0]["evidence"] == []
    bad = await world.eng.post(
        world.url(f"/steps/{world.steps[0]}/evidence"), json={"name": "a.png", "content": "not base64!!"}
    )
    assert bad.status_code == 400
    for name, content in (("a.jpg", JPEG), ("b.JPEG", JPEG), ("c.png", PNG), ("d.heic", HEIC), ("e.pdf", PDF)):
        assert (await world.evidence(0, name, content)).status_code == 204
    types = {e["name"]: e["media_type"] for e in (await world.checklist())[0]["evidence"]}
    assert types == {
        "a.jpg": "image/jpeg",
        "b.JPEG": "image/jpeg",
        "c.png": "image/png",
        "d.heic": "image/heic",
        "e.pdf": "application/pdf",
    }
    sixth = await world.evidence(0, "f.png", PNG)
    assert sixth.status_code == 409 and sixth.json()["code"] == "too_many_files"


async def test_evidence_records_who_and_when_and_can_be_opened(world: World) -> None:
    await world.tick(0)
    await world.evidence(0, "rack.png", PNG)
    item = (await world.checklist())[0]["evidence"][0]
    assert item["uploaded_by_name"] == "Eng One" and item["uploaded_at"] and item["can_remove"]
    opened = await world.eng.get(world.url(f"/evidence/{item['id']}/content"))
    assert opened.status_code == 200 and opened.content == PNG
    assert opened.headers["content-type"] == "image/png" and opened.headers["x-content-type-options"] == "nosniff"
    assert (await world.other.get(world.url(f"/evidence/{item['id']}/content"))).status_code == 404
    seen_by_admin = (await world.checklist(world.admin))[0]["evidence"]
    assert seen_by_admin and not seen_by_admin[0]["can_remove"]


async def test_evidence_can_be_replaced_while_the_step_awaits_it(world: World) -> None:
    await world.tick(0)
    await world.evidence(0, "first.png", PNG)
    first = (await world.checklist())[0]["evidence"][0]["id"]
    removed = await world.eng.delete(world.url(f"/steps/{world.steps[0]}/evidence/{first}"))
    assert removed.status_code == 204
    assert (await world.checklist())[0]["evidence"] == []
    assert (await world.tick(0)).status_code == 409  # nothing left, so it cannot finish
    await world.evidence(0, "second.jpg", JPEG)
    assert (await world.tick(0)).status_code == 204


async def test_unticking_a_step_that_awaits_evidence_returns_it_to_pending(world: World) -> None:
    await world.tick(0)
    await world.evidence(0)
    assert (await world.eng.post(world.url(f"/steps/{world.steps[0]}/untick"))).status_code == 204
    step = (await world.checklist())[0]
    assert step["state"] == "pending" and step["evidence"] == []


async def test_a_complete_step_is_locked_for_the_engineer(world: World) -> None:
    await world.finish(0)
    evidence_id = (await world.checklist())[0]["evidence"][0]["id"]
    step = world.steps[0]
    removed = await world.eng.delete(world.url(f"/steps/{step}/evidence/{evidence_id}"))
    assert removed.status_code == 403
    assert (await world.eng.post(world.url(f"/steps/{step}/untick"))).status_code == 403
    assert (await world.evidence(0, "more.png", PNG)).status_code == 409
    again = await world.tick(0)
    assert again.status_code == 409
    done = (await world.checklist())[0]
    assert done["state"] == "complete" and len(done["evidence"]) == 1 and not done["evidence"][0]["can_remove"]


async def test_an_engineer_cannot_remove_someone_elses_evidence(
    world: World, database: Database, make_client: Clients
) -> None:
    await world.tick(0)
    await world.evidence(0)
    evidence_id = (await world.checklist())[0]["evidence"][0]["id"]
    users = (await world.admin.get("/users")).json()
    other_id = next(u["id"] for u in users if u["email"] == "other@test.com")
    eng_id = next(u["id"] for u in users if u["email"] == "eng@test.com")
    await world.admin.put(f"/projects/{world.project}/assignments", json={"engineer_ids": [eng_id, other_id]})
    response = await world.other.delete(world.url(f"/steps/{world.steps[0]}/evidence/{evidence_id}"))
    assert response.status_code == 403


async def test_an_engineer_cannot_change_a_step_by_calling_the_api(world: World) -> None:
    await world.finish(0)
    before = (await world.checklist())[0]
    for body in (
        {"title": "Hacked"},
        {"progress": 0},
        {"start_date": "2026-01-01"},
        {"end_date": "2026-01-02"},
        {"phase": "configuration"},
        {"state": "pending"},
        {"done": False},
    ):
        assert (await world.eng.patch(world.url(f"/steps/{world.steps[0]}"), json=body)).status_code == 403
    assert (await world.eng.put(world.url(f"/steps/{world.steps[0]}"), json={"title": "x"})).status_code in (
        403,
        404,
        405,
    )
    after = (await world.checklist())[0]
    assert {k: after[k] for k in ("title", "state", "progress", "start_date", "end_date", "phase")} == {
        k: before[k] for k in ("title", "state", "progress", "start_date", "end_date", "phase")
    }


# comments


async def test_comments_are_added_by_an_engineer_even_on_a_complete_step_and_never_changed(world: World) -> None:
    step = world.steps[0]
    assert (
        await world.eng.post(world.url(f"/steps/{step}/comments"), json={"body": "  Started racking  "})
    ).status_code == 204
    await world.finish(0)
    assert (
        await world.eng.post(world.url(f"/steps/{step}/comments"), json={"body": "Verified after"})
    ).status_code == 204
    assert (await world.eng.post(world.url(f"/steps/{step}/comments"), json={"body": "   "})).status_code in (400, 422)
    comments = (await world.checklist())[0]["comments"]
    assert [c["body"] for c in comments] == ["Started racking", "Verified after"]
    assert comments[0]["author_name"] == "Eng One" and comments[0]["created_at"]
    assert (await world.checklist())[0]["state"] == "complete"
    comment_id = comments[0]["id"]
    for method in ("PATCH", "PUT", "DELETE"):
        response = await world.eng.request(
            method, world.url(f"/steps/{step}/comments/{comment_id}"), json={"body": "x"}
        )
        assert response.status_code in (403, 404, 405)
    assert [c["body"] for c in (await world.checklist(world.admin))[0]["comments"]] == [
        "Started racking",
        "Verified after",
    ]


async def test_a_comment_does_not_change_the_state(world: World) -> None:
    await world.eng.post(world.url(f"/steps/{world.steps[0]}/comments"), json={"body": "note"})
    assert (await world.checklist())[0]["state"] == "pending"


# development tools


async def test_sample_steps_exist_only_in_development(make_client: Clients, database: Database) -> None:
    await make_user(database, "admin@test.com", "admin")
    admin = await signed_in(make_client, "admin@test.com")
    project = await create_project(admin, "PRJ-2026-0009", "Beta Ltd")
    # a signed-in client of a production app has no development route at all
    production = make_client("production")
    assert (await production.post("/dev/checklist-steps", json={"project_id": project, "count": 2})).status_code == 404
    # in development the Admin can add them
    created = await admin.post("/dev/checklist-steps", json={"project_id": project, "count": 4})
    assert created.status_code == 201
    assert len((await admin.get(f"/projects/{project}/checklist")).json()["steps"]) == 4
