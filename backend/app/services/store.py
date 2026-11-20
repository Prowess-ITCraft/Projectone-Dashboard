"""The record store behind the frontend's data layer.

The frontend's ProjectOneApi keeps its intake rules in the browser for now and saves records through a small storage
interface (get, put, delete, list by store). This service is that storage, in PostgreSQL. It decides who may read and
write each record:

- reads: a user who sees every project reads everything; anyone else reads only their assigned projects, the
  customers of those projects, the sites those projects cover, and the records, files and activity of those projects.
  Anything else is answered as not found.
- writes: each store needs a permission (customers, sites and projects need `create_project`; documents and files
  `upload`; order lines `edit_lines` or `classify`; modules and entitlements `confirm_classification`; the shared
  records `view_all_projects`), plus a visible project that is in progress for anything stored per project.
- the activity log is append-only, and its actor is always the signed-in user, never what the browser sends.

A batch of writes is applied in the request's single transaction, so it is saved completely or not at all.
"""

import base64
import binascii
import hashlib
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError, forbidden, not_found
from app.models import AppRecord, AuditLog, Counter, Customer, Project, ProjectRecord, Site, StoredFile, User
from app.models.work import PROJECT_RECORD_STORES
from app.services import audit
from app.services.access import parse_uuid, visible_project_ids
from app.services.counters import next_counter
from app.services.permissions import can

MAX_FILE_BYTES = 25 * 1024 * 1024
APP_STORES = ("rules", "checklist")
STORES = ("customers", "sites", "projects", *PROJECT_RECORD_STORES, "files", "audit", *APP_STORES)
COUNTER_KEYS = ("counter:customer",)

WRITE_ACTIONS: dict[str, tuple[str, ...]] = {
    "customers": ("create_project",),
    "sites": ("create_project",),
    "projects": ("create_project",),
    "documents": ("upload",),
    "files": ("upload",),
    "lines": ("edit_lines", "classify"),
    "modules": ("confirm_classification",),
    "entitlements": ("confirm_classification",),
    "rules": ("view_all_projects",),
    "checklist": ("view_all_projects",),
}
AUDIT_FIELDS = ("id", "at", "actor", "action", "reason", "before", "after")


class Op(BaseModel):
    op: Literal["put", "delete"]
    store: str = Field(max_length=40)
    id: str = Field(min_length=1, max_length=80)
    data: dict[str, Any] | None = None


def _ms(moment: datetime) -> int:
    return int(moment.timestamp() * 1000)


def _from_ms(value: object) -> datetime:
    try:
        return datetime.fromtimestamp(float(value) / 1000, UTC)  # type: ignore[arg-type]
    except (TypeError, ValueError, OverflowError):
        return datetime.now(UTC)


def _text(data: dict[str, Any], key: str, limit: int, *, required: bool = True) -> str:
    value = data.get(key)
    if not isinstance(value, str) or (required and not value.strip()):
        if required:
            raise AppError("invalid_record", f"The record needs a {key}.", status=400)
        return ""
    return value[:limit]


def _known(store: str) -> None:
    if store not in STORES:
        raise not_found("That store does not exist.")


class Store:
    """One request's view of the store, for one user. Visibility is looked up once and kept for the request."""

    def __init__(self, session: AsyncSession, user: User) -> None:
        self.session = session
        self.user = user
        self._visible: set[uuid.UUID] | None = None
        self._loaded = False

    async def visible(self) -> set[uuid.UUID] | None:
        if not self._loaded:
            self._visible = await visible_project_ids(self.session, self.user)
            self._loaded = True
        return self._visible

    async def _sees(self, project_id: uuid.UUID) -> bool:
        visible = await self.visible()
        return visible is None or project_id in visible

    async def _projects(self) -> list[Project]:
        visible = await self.visible()
        query = select(Project).order_by(Project.created_at)
        if visible is not None:
            query = query.where(Project.id.in_(visible))
        return list((await self.session.execute(query)).scalars())

    async def _admin_only(self) -> None:
        """The record store serves the Admin screens. An engineer never reads or writes through it: their view of a
        project comes from `/projects/{id}/work`, which carries only the order lines and the checklist."""
        if not await can(self.session, self.user, "view_all_projects"):
            raise forbidden("Your role cannot use this.")

    # reads

    async def records(self, store: str) -> list[dict[str, Any]]:
        await self._admin_only()
        _known(store)
        visible = await self.visible()
        if store == "projects":
            return [p.data for p in await self._projects()]
        if store == "customers":
            customers = select(Customer).order_by(Customer.name)
            if visible is not None:
                customers = customers.where(Customer.id.in_({p.customer_id for p in await self._projects()}))
            return [c.data for c in (await self.session.execute(customers)).scalars()]
        if store == "sites":
            sites = select(Site).order_by(Site.name)
            if visible is not None:
                found = {parse_uuid(s) for p in await self._projects() for s in p.data.get("siteIds") or []}
                sites = sites.where(Site.id.in_({i for i in found if i is not None}))
            return [s.data for s in (await self.session.execute(sites)).scalars()]
        if store in PROJECT_RECORD_STORES:
            records = select(ProjectRecord).where(ProjectRecord.store == store)
            if visible is not None:
                records = records.where(ProjectRecord.project_id.in_(visible))
            return [r.data for r in (await self.session.execute(records)).scalars()]
        if store == "files":
            files = select(StoredFile)
            if visible is not None:
                files = files.where(StoredFile.project_id.in_(visible))
            return [self._file_out(f) for f in (await self.session.execute(files)).scalars()]
        if store == "audit":
            entries = select(AuditLog).where(AuditLog.details.is_not(None)).order_by(AuditLog.at)
            if visible is not None:
                entries = entries.where(AuditLog.details["projectId"].astext.in_([str(v) for v in visible]))
            return [self._audit_out(a) for a in (await self.session.execute(entries)).scalars()]
        rows = await self.session.execute(select(AppRecord).where(AppRecord.store == store))
        return [r.data for r in rows.scalars()]

    async def get(self, store: str, key: str) -> dict[str, Any]:
        await self._admin_only()
        _known(store)
        found: dict[str, Any] | None = None
        if store in ("customers", "sites", "projects", "files", "audit"):
            key_id = parse_uuid(key)
            if key_id is None:
                raise not_found()
            if store == "projects":
                project = await self.session.get(Project, key_id)
                found = project.data if project and await self._sees(project.id) else None
            elif store == "files":
                file = await self.session.get(StoredFile, key_id)
                found = self._file_out(file) if file and await self._sees(file.project_id) else None
            else:
                found = next((r for r in await self.records(store) if r.get("id") == key), None)
        elif store in PROJECT_RECORD_STORES:
            record = await self.session.get(ProjectRecord, (store, key))
            found = record.data if record and await self._sees(record.project_id) else None
        else:
            app = await self.session.get(AppRecord, (store, key))
            found = app.data if app else None
        if found is None:
            raise not_found()
        return found

    async def file_content(self, key: str) -> StoredFile:
        await self._admin_only()
        file_id = parse_uuid(key)
        file = await self.session.get(StoredFile, file_id) if file_id else None
        if file is None or not await self._sees(file.project_id):
            raise not_found()
        return file

    @staticmethod
    def _file_out(file: StoredFile) -> dict[str, Any]:
        return {
            "id": str(file.id),
            "projectId": str(file.project_id),
            "name": file.name,
            "type": file.media_type,
            "size": file.size,
            "hash": file.sha256,
        }

    @staticmethod
    def _audit_out(row: AuditLog) -> dict[str, Any]:
        details = dict(row.details or {})
        return {
            **details,
            "id": str(row.id),
            "at": _ms(row.at),
            "actor": details.get("actor"),
            "action": row.action,
            "reason": row.reason,
            "before": row.before,
            "after": row.after,
        }

    # writes

    async def _require(self, store: str) -> None:
        for action in WRITE_ACTIONS[store]:
            if await can(self.session, self.user, action):
                return
        raise forbidden("Your role cannot make this change.")

    async def _open_project(self, value: object) -> Project:
        """The project a per-project record belongs to: it must exist, be visible to the user and be in progress."""
        project_id = parse_uuid(value)
        project = await self.session.get(Project, project_id) if project_id else None
        if project is None or not await self._sees(project.id):
            raise not_found("That project does not exist.")
        if project.status != "in_progress":
            raise AppError("project_locked", "This project is not in progress, so it cannot be changed.", status=409)
        return project

    async def apply(self, ops: list[Op]) -> None:
        await self._admin_only()
        for op in ops:
            _known(op.store)
            if op.store == "audit":
                if op.op == "delete":
                    raise forbidden("The activity log cannot be changed.")
                await self._put_audit(op.id, op.data or {})
                continue
            await self._require(op.store)
            if op.op == "put" and not isinstance(op.data, dict):
                raise AppError("invalid_record", "A put needs the record.", status=400)
            if op.store == "customers":
                await self._customer(op)
            elif op.store == "sites":
                await self._site(op)
            elif op.store == "projects":
                await self._project(op)
            elif op.store in PROJECT_RECORD_STORES:
                await self._record(op)
            elif op.store == "files":
                await self._file(op)
            else:
                await self._app(op)
            await self.session.flush()

    async def _customer(self, op: Op) -> None:
        key = parse_uuid(op.id) or self._bad_id()
        row = await self.session.get(Customer, key)
        if op.op == "delete":
            if row:
                await self.session.delete(row)
            return
        data = {**(op.data or {}), "id": op.id}
        fields = {
            "number": _text(data, "number", 20),
            "name": _text(data, "name", 300),
            "gstin": _text(data, "gstin", 15, required=False) or None,
            "data": data,
        }
        if row is None:
            self.session.add(Customer(id=key, created_at=_from_ms(data.get("createdAt")), **fields))
        else:
            for name, value in fields.items():
                setattr(row, name, value)

    async def _site(self, op: Op) -> None:
        key = parse_uuid(op.id) or self._bad_id()
        row = await self.session.get(Site, key)
        if op.op == "delete":
            if row:
                await self.session.delete(row)
            return
        data = {**(op.data or {}), "id": op.id}
        customer_id = parse_uuid(data.get("customerId")) or self._bad_id()
        fields = {"customer_id": customer_id, "name": _text(data, "name", 300), "data": data}
        if row is None:
            self.session.add(Site(id=key, created_at=_from_ms(data.get("createdAt")), **fields))
        else:
            for name, value in fields.items():
                setattr(row, name, value)

    async def _project(self, op: Op) -> None:
        key = parse_uuid(op.id) or self._bad_id()
        row = await self.session.get(Project, key)
        if op.op == "delete":
            if row:
                await self.session.delete(row)
            return
        data = {**(op.data or {}), "id": op.id}
        fields = {
            "number": _text(data, "number", 20),
            "customer_id": parse_uuid(data.get("customerId")) or self._bad_id(),
            "status": _text(data, "status", 20, required=False) or "in_progress",
            "data": data,
        }
        if row is None:
            self.session.add(Project(id=key, created_at=_from_ms(data.get("createdAt")), **fields))
        else:
            for name, value in fields.items():
                setattr(row, name, value)

    async def _record(self, op: Op) -> None:
        row = await self.session.get(ProjectRecord, (op.store, op.id))
        if row is not None:
            await self._open_project(row.project_id)
        if op.op == "delete":
            if row:
                await self.session.delete(row)
            return
        data = {**(op.data or {}), "id": op.id}
        project = await self._open_project(data.get("projectId"))
        if row is None:
            self.session.add(ProjectRecord(store=op.store, id=op.id, project_id=project.id, data=data))
        elif row.project_id != project.id:
            raise AppError("invalid_record", "A record cannot move to another project.", status=400)
        else:
            row.data = data
            row.updated_at = datetime.now(UTC)

    async def _file(self, op: Op) -> None:
        key = parse_uuid(op.id) or self._bad_id()
        row = await self.session.get(StoredFile, key)
        if op.op == "delete":
            if row:
                await self._open_project(row.project_id)
                await self.session.delete(row)
            return
        if row is not None:
            raise AppError("conflict", "A stored file cannot be replaced.", status=409)
        data = op.data or {}
        project = await self._open_project(data.get("projectId"))
        try:
            content = base64.b64decode(str(data.get("content") or ""), validate=True)
        except (binascii.Error, ValueError) as exc:
            raise AppError("invalid_record", "The file content could not be read.", status=400) from exc
        if not content:
            raise AppError("invalid_record", "The file is empty.", status=400)
        if len(content) > MAX_FILE_BYTES:
            raise AppError("file_too_large", "This file is larger than 25 MB.", status=413)
        self.session.add(
            StoredFile(
                id=key,
                project_id=project.id,
                name=_text(data, "name", 300),
                media_type=_text(data, "type", 120, required=False) or "application/octet-stream",
                size=len(content),
                sha256=hashlib.sha256(content).hexdigest(),
                content=content,
            )
        )

    async def _app(self, op: Op) -> None:
        row = await self.session.get(AppRecord, (op.store, op.id))
        if op.op == "delete":
            if row:
                await self.session.delete(row)
            return
        if row is None:
            self.session.add(AppRecord(store=op.store, id=op.id, data=op.data or {}))
        else:
            row.data = op.data or {}
            row.updated_at = datetime.now(UTC)

    async def _put_audit(self, key: str, data: dict[str, Any]) -> None:
        project_id = data.get("projectId")
        if project_id:
            pid = parse_uuid(project_id)
            if pid is None or not await self._sees(pid):
                raise not_found("That project does not exist.")
        elif not await can(self.session, self.user, "create_project"):
            raise forbidden("Your role cannot make this change.")
        action = _text(data, "action", 80)
        rest = {k: v for k, v in data.items() if k not in AUDIT_FIELDS}
        subject = rest.get("subject")
        await audit.record(
            self.session,
            actor=self.user,
            action=action,
            subject_type="project" if project_id else "customer" if rest.get("customerId") else "system",
            subject_id=str(project_id or rest.get("customerId") or "") or None,
            subject_label=str(subject)[:300] if subject else None,
            before=data.get("before") if isinstance(data.get("before"), dict) else None,
            after=data.get("after") if isinstance(data.get("after"), dict) else None,
            reason=data.get("reason") if isinstance(data.get("reason"), str) else None,
            details={**rest, "actor": audit.actor_details(self.user)},
            id=parse_uuid(key) or uuid.uuid4(),
        )

    @staticmethod
    def _bad_id() -> uuid.UUID:
        raise AppError("invalid_record", "The record id is not valid.", status=400)

    # counters and reset

    async def next_number(self, key: str) -> int:
        """The next value of a readable-number counter. Keys are those the data layer uses: `counter:customer` and
        `counter:project:<financial year>`."""
        if not await can(self.session, self.user, "create_project"):
            raise forbidden("Your role cannot create projects.")
        name = key.removeprefix("counter:")
        fy = name.removeprefix("project:")
        if key not in COUNTER_KEYS and not (name.startswith("project:") and len(fy) == 4 and fy.isdigit()):
            raise not_found("That counter does not exist.")
        return await next_counter(self.session, name)

    async def reset(self) -> None:
        """Deletes every customer, site, project and what belongs to them, and the shared records. Accounts and the
        audit log are kept; the reset is recorded in the log."""
        if not await can(self.session, self.user, "reset_data"):
            raise forbidden("Only an Admin can reset the data.")
        await self.session.execute(delete(Project))
        await self.session.execute(delete(Customer))
        await self.session.execute(delete(AppRecord))
        await self.session.execute(delete(Counter).where(or_(Counter.key == "customer", Counter.key.like("project:%"))))
        await audit.record(self.session, actor=self.user, action="data_reset", subject_type="system")
