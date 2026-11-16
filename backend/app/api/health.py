from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import SessionDep, SettingsDep
from app.errors import AppError
from app.schemas.common import HealthOut, VersionOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    """Liveness: the process is up. It does not touch the database."""
    return HealthOut(status="ok")


@router.get("/health/ready", response_model=HealthOut)
async def ready(session: SessionDep) -> HealthOut:
    """Readiness: the database answers."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        raise AppError("database_unavailable", "The database is not reachable.", status=503) from exc
    return HealthOut(status="ok")


@router.get("/version", response_model=VersionOut)
async def version(settings: SettingsDep) -> VersionOut:
    return VersionOut(version=settings.version, environment=settings.environment)
