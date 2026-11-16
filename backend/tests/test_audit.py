import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.db import Database
from app.models import AuditLog, User
from app.services import audit
from app.services.seed import seed_dev_users, seed_roles
from app.services.settings import get_setting, set_setting


async def _admin(database: Database) -> User:
    async with database.sessions() as session, session.begin():
        await seed_roles(session)
        users = await seed_dev_users(session)
        return users[0]


async def _count(database: Database) -> int:
    async with database.sessions() as session:
        return int((await session.execute(select(func.count()).select_from(AuditLog))).scalar_one())


async def test_a_change_and_its_audit_row_are_saved_together(database: Database) -> None:
    admin = await _admin(database)
    async with database.sessions() as session, session.begin():
        await set_setting(session, admin, "report.brand", "ITCraft", reason="  Brand on reports  ")
    async with database.sessions() as session:
        assert await get_setting(session, "report.brand") == "ITCraft"
        row = (await session.execute(select(AuditLog).where(AuditLog.action == "setting_changed"))).scalar_one()
    assert row.actor_label == "Asha, admin"
    assert row.subject_id == "report.brand"
    assert row.before is None and row.after == {"value": "ITCraft"}
    assert row.reason == "Brand on reports"


async def test_a_failed_request_leaves_neither_the_change_nor_the_audit_row(database: Database) -> None:
    admin = await _admin(database)
    before = await _count(database)
    with pytest.raises(RuntimeError):
        async with database.sessions() as session, session.begin():
            await set_setting(session, admin, "report.brand", "ITCraft")
            raise RuntimeError("the request failed after the write")
    async with database.sessions() as session:
        assert await get_setting(session, "report.brand") is None
    assert await _count(database) == before


async def test_a_second_change_records_the_value_it_replaced(database: Database) -> None:
    admin = await _admin(database)
    for value in ("one", "two"):
        async with database.sessions() as session, session.begin():
            await set_setting(session, admin, "x", value)
    async with database.sessions() as session:
        rows = (
            (await session.execute(select(AuditLog).where(AuditLog.subject_id == "x").order_by(AuditLog.at)))
            .scalars()
            .all()
        )
    assert [r.before for r in rows] == [None, {"value": "one"}]


async def test_the_database_refuses_to_edit_a_row(database: Database) -> None:
    admin = await _admin(database)
    async with database.sessions() as session, session.begin():
        await audit.record(session, actor=admin, action="probe", subject_type="test")
    with pytest.raises(DBAPIError, match="append-only"):
        async with database.sessions() as session, session.begin():
            await session.execute(text("UPDATE audit_log SET action = 'edited'"))


async def test_the_database_refuses_to_delete_a_row(database: Database) -> None:
    admin = await _admin(database)
    async with database.sessions() as session, session.begin():
        await audit.record(session, actor=admin, action="probe", subject_type="test")
    with pytest.raises(DBAPIError, match="append-only"):
        async with database.sessions() as session, session.begin():
            await session.execute(text("DELETE FROM audit_log"))


async def test_the_database_refuses_to_truncate_the_log(database: Database) -> None:
    with pytest.raises(DBAPIError, match="append-only"):
        async with database.sessions() as session, session.begin():
            await session.execute(text("TRUNCATE audit_log"))


async def test_the_record_outlives_the_user(database: Database) -> None:
    admin = await _admin(database)
    async with database.sessions() as session, session.begin():
        await audit.record(session, actor=admin, action="probe", subject_type="test")
    async with database.sessions() as session, session.begin():
        await session.execute(text("DELETE FROM users"))
    async with database.sessions() as session:
        row = (await session.execute(select(AuditLog).where(AuditLog.action == "probe"))).scalar_one()
    assert row.actor_label == "Asha, admin"
    assert row.actor_id == admin.id


async def test_a_system_action_has_no_actor(database: Database) -> None:
    async with database.sessions() as session, session.begin():
        row = await audit.record(session, actor=None, action="startup", subject_type="system")
    assert row.actor_id is None and row.actor_label is None
