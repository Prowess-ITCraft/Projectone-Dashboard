"""The record store the frontend's data layer saves through. Who may read and write what is decided in
`services.store`; see its description."""

from typing import Any

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, SessionDep
from app.errors import AppError
from app.schemas.common import CounterOut
from app.services.store import Op, Store

router = APIRouter(prefix="/store", tags=["store"])


class BatchIn(BaseModel):
    ops: list[Op] = Field(max_length=5000)


@router.post("/batch", status_code=204)
async def apply_batch(body: BatchIn, user: CurrentUser, session: SessionDep) -> Response:
    """Every write of one action of the data layer, applied together: all of them are saved, or none."""
    try:
        await Store(session, user).apply(body.ops)
    except IntegrityError as exc:
        raise AppError(
            "conflict", "That change conflicts with what is stored. Reload and try again.", status=409
        ) from exc
    return Response(status_code=204)


@router.post("/counters/{key}", response_model=CounterOut)
async def next_number(key: str, user: CurrentUser, session: SessionDep) -> CounterOut:
    return CounterOut(value=await Store(session, user).next_number(key))


@router.post("/reset", status_code=204)
async def reset(user: CurrentUser, session: SessionDep) -> Response:
    await Store(session, user).reset()
    return Response(status_code=204)


@router.get("/files/{key}/content")
async def file_content(key: str, user: CurrentUser, session: SessionDep) -> Response:
    file = await Store(session, user).file_content(key)
    return Response(
        content=file.content,
        media_type=file.media_type,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/{store}")
async def list_records(store: str, user: CurrentUser, session: SessionDep) -> list[dict[str, Any]]:
    return await Store(session, user).records(store)


@router.get("/{store}/{key}")
async def get_record(store: str, key: str, user: CurrentUser, session: SessionDep) -> dict[str, Any]:
    return await Store(session, user).get(store, key)
