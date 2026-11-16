import json
import logging
from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import APIRouter
from pydantic import BaseModel

from app.db import Database
from app.main import create_app
from app.request_context import JsonFormatter
from tests.conftest import Clients, settings_for


async def test_health_is_alive_without_a_database(make_client: Clients) -> None:
    response = await make_client().get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_checks_the_database(make_client: Clients) -> None:
    response = await make_client().get("/health/ready")
    assert response.status_code == 200


async def test_version_names_the_environment(make_client: Clients) -> None:
    body = (await make_client("staging").get("/version")).json()
    assert body == {"version": "0.1.0", "environment": "staging"}


async def test_every_response_carries_a_request_id_and_a_given_one_is_kept(make_client: Clients) -> None:
    client = make_client()
    assert client.headers.get("x-request-id") is None
    first = await client.get("/health")
    assert len(first.headers["x-request-id"]) >= 16
    second = await client.get("/health", headers={"X-Request-ID": "abc-123"})
    assert second.headers["x-request-id"] == "abc-123"


async def test_unknown_path_uses_the_error_shape(make_client: Clients) -> None:
    response = await make_client().get("/nope")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert body["message"]
    assert body["request_id"] == response.headers["x-request-id"]


async def test_no_user_is_refused_with_a_stable_code(make_client: Clients) -> None:
    response = await make_client().get("/me")
    assert response.status_code == 401
    assert response.json()["code"] == "not_signed_in"


class _Payload(BaseModel):
    customer: str
    count: int


@pytest_asyncio.fixture
async def probe(database: Database) -> AsyncIterator[httpx.AsyncClient]:
    """An app with two extra routes: one that reads a body, one that fails."""
    app = create_app(settings_for(), database)
    router = APIRouter()

    @router.post("/probe")
    async def take(payload: _Payload) -> dict[str, str]:
        return {"customer": payload.customer}

    @router.get("/boom")
    async def boom() -> None:
        raise RuntimeError("secret internal detail")

    app.include_router(router)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as client:
        yield client


async def test_validation_errors_name_fields_and_never_echo_values(probe: httpx.AsyncClient) -> None:
    response = await probe.post("/probe", json={"customer": ["GSTIN-27AAAAA0000A1Z5"], "count": "x"})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "invalid_request"
    assert "customer" in body["message"] and "count" in body["message"]
    assert "GSTIN-27AAAAA0000A1Z5" not in response.text


async def test_unexpected_errors_hide_the_detail_and_keep_the_request_id(probe: httpx.AsyncClient) -> None:
    response = await probe.get("/boom")
    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "internal_error"
    assert "secret internal detail" not in response.text
    assert body["request_id"]


async def test_logs_hold_the_method_path_and_status_but_never_the_body_or_query(
    probe: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    await probe.post("/probe?search=27AAAAA0000A1Z5", json={"customer": "Private Customer Ltd", "count": 1})
    # Only the server's own records; the test client logs its own requests, which is not the server writing them
    server = [r for r in caplog.records if not r.name.startswith("httpx")]
    text = " ".join(f"{r.getMessage()} {getattr(r, 'path', '')}" for r in server)
    assert "Private Customer Ltd" not in text
    assert "27AAAAA0000A1Z5" not in text
    request_logs = [r for r in caplog.records if r.name == "projectone.request"]
    assert request_logs
    assert request_logs[-1].path == "/probe"  # type: ignore[attr-defined]
    assert request_logs[-1].status == 200  # type: ignore[attr-defined]


async def test_the_request_log_line_carries_the_request_id(make_client: Clients) -> None:
    """Formatted at the moment it is written, as the real handler does, so the id must still be known then."""
    lines: list[str] = []

    class Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            lines.append(JsonFormatter().format(record))

    handler = Capture()
    logger = logging.getLogger("projectone.request")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        await make_client().get("/health", headers={"X-Request-ID": "trace-42"})
    finally:
        logger.removeHandler(handler)
    assert json.loads(lines[-1])["request_id"] == "trace-42"
