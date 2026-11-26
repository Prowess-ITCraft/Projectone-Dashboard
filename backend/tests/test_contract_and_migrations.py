"""Two guards that do not depend on any one feature:

1. Nothing financial may appear in the API document or in any table column. Project One holds no financial data,
   so a field with one of these names appearing anywhere is a defect, found here before a screen ever sees it.
2. The migrations apply, undo and reapply cleanly, and they describe exactly the models.
"""

import importlib.util
import re
from pathlib import Path
from typing import Any

import httpx
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.domain import role_matrix
from app.models import Base
from tests.conftest import BACKEND, Clients, migrate, scratch_database

# Whole words, after splitting on underscores, hyphens and capital letters. Counts are named `count`, never `total`.
DENY = {
    "rate", "rates", "amount", "amounts", "price", "prices", "pricing", "tax", "taxes", "gst", "total", "totals",
    "payment", "payments", "bank", "cost", "costs", "margin", "invoice_value", "subtotal", "grand",
}  # fmt: skip


def words(name: str) -> set[str]:
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name)
    return {w for w in re.split(r"[^A-Za-z0-9]+", spaced.lower()) if w}


def financial_names(names: list[str]) -> list[str]:
    return sorted({n for n in names if words(n) & DENY})


def schema_names(document: dict[str, Any]) -> list[str]:
    """Every property, parameter and path segment name in an OpenAPI document."""
    found: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key == "properties" and isinstance(value, dict):
                    found.extend(value.keys())
                if key == "name" and isinstance(value, str):
                    found.append(value)
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(document)
    for path in document.get("paths", {}):
        found.extend(seg.strip("{}") for seg in path.split("/") if seg)
    return found


def test_the_scanner_catches_financial_names_in_every_style() -> None:
    names = [
        "unit_rate",
        "grandTotal",
        "payment-terms",
        "bankAccount",
        "cost",
        "margin_pct",
        "order_amount",
        "GSTIN",
    ]
    assert financial_names(names) == [
        "bankAccount",
        "cost",
        "grandTotal",
        "margin_pct",
        "order_amount",
        "payment-terms",
        "unit_rate",
    ]


def test_the_scanner_leaves_ordinary_names_alone() -> None:
    names = [
        "username",
        "display_name",
        "actions",
        "request_id",
        "status",
        "gstin",
        "count",
        "moderate",
        "generate",
    ]
    assert financial_names(names) == []


def test_the_scanner_finds_names_in_a_document() -> None:
    document = {
        "paths": {"/orders/{order_total}": {}},
        "components": {"schemas": {"Line": {"properties": {"title": {}, "unitPrice": {}}}}},
    }
    assert financial_names(schema_names(document)) == ["order_total", "unitPrice"]


async def test_the_api_document_has_no_financial_field(make_client: Clients) -> None:
    document = (await make_client().get("/openapi.json")).json()
    assert financial_names(schema_names(document)) == []
    for env in ("staging", "production"):
        other = (await make_client(env).get("/openapi.json")).json()
        assert financial_names(schema_names(other)) == []


def test_no_table_has_a_financial_column() -> None:
    columns = [f"{t.name}.{c.name}" for t in Base.metadata.tables.values() for c in t.columns]
    tables = list(Base.metadata.tables)
    assert financial_names(tables) == []
    assert financial_names([c.split(".")[1] for c in columns]) == []


async def test_the_openapi_document_is_public_and_needs_no_user(make_client: Clients) -> None:
    response: httpx.Response = await make_client("production").get("/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Project One API"


async def test_migrations_apply_undo_and_apply_again(admin_url: str) -> None:
    async with scratch_database(admin_url, None) as url:
        await migrate(url)
        await migrate(url, "base", down=True)
        engine = create_async_engine(url)
        async with engine.connect() as conn:
            tables = (
                (
                    await conn.execute(
                        text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
                    )
                )
                .scalars()
                .all()
            )
        await engine.dispose()
        assert set(tables) <= {"alembic_version"}
        await migrate(url)


async def test_the_migrations_describe_exactly_the_models(admin_url: str) -> None:
    async with scratch_database(admin_url, None) as url:
        await migrate(url)
        engine = create_async_engine(url)
        async with engine.connect() as conn:
            diff = await conn.run_sync(lambda sync: compare_metadata(MigrationContext.configure(sync), Base.metadata))
        await engine.dispose()
    assert diff == []


def test_the_frozen_matrix_in_the_migration_equals_the_application_matrix() -> None:
    path = Path(BACKEND) / "migrations" / "versions" / "0003_accounts_projects_assignments.py"
    spec = importlib.util.spec_from_file_location("migration_0003", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.ROLES == role_matrix.ROLES
    # 0003 froze the matrix as it was then; 0005 (20 Nov 2026) replaced the engineer's actions and added one for Admin
    later = Path(BACKEND) / "migrations" / "versions" / "0005_engineer_checklist.py"
    spec5 = importlib.util.spec_from_file_location("migration_0005", later)
    assert spec5 and spec5.loader
    module5 = importlib.util.module_from_spec(spec5)
    spec5.loader.exec_module(module5)
    assert tuple(module5.NEW_ENGINEER) == role_matrix.ENGINEER_ACTIONS
    assert set(module.ADMIN) | {"manage_checklist"} == set(role_matrix.ADMIN_ACTIONS)
