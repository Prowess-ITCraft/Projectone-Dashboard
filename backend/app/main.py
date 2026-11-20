import logging
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import auth, checklist, dev, health, identity, notifications, projects, store, users, work
from app.config import Settings, get_settings
from app.db import Database, create_database
from app.errors import AppError, error_response
from app.request_context import configure_logging, request_id_var
from app.services.auth import SESSION_COOKIE

log = logging.getLogger("projectone.request")


_error = error_response
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def create_app(settings: Settings | None = None, database: Database | None = None) -> FastAPI:
    settings = settings or get_settings()
    owns_database = database is None
    database = database or create_database(settings.database_url)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        if owns_database:
            await database.engine.dispose()

    app = FastAPI(
        title="Project One API",
        version=settings.version,
        lifespan=lifespan,
        # No documentation pages outside development; the OpenAPI document is still published for the contract.
        docs_url="/docs" if settings.is_development else None,
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.database = database

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        """Gives every request an id and logs one line for it: method, path, status and time. Never the query
        string, headers or body, because those can hold customer data or file contents."""
        rid = (request.headers.get("x-request-id") or uuid.uuid4().hex)[:64]
        token = request_id_var.set(rid)
        started = time.perf_counter()
        try:
            try:
                # A request carrying the session cookie that changes something must also carry this header. A form
                # or link on another site cannot add it, so a signed-in browser cannot be made to act unknowingly.
                if (
                    request.method in UNSAFE_METHODS
                    and SESSION_COOKIE in request.cookies
                    and request.headers.get("x-requested-with") != "ProjectOne"
                ):
                    response: Response = _error(
                        403, "missing_request_header", "This request was refused. Reload the page."
                    )
                else:
                    response = await call_next(request)
            except Exception:
                # Handled here rather than by an exception handler, so the request id is still known for the reply.
                log.error("unhandled error", exc_info=True)
                response = _error(500, "internal_error", "Something went wrong. Note the request id if you report it.")
            response.headers["X-Request-ID"] = rid
            log.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            return response
        finally:
            request_id_var.reset(token)

    @app.exception_handler(AppError)
    async def app_error(_request: Request, exc: AppError) -> JSONResponse:
        return _error(exc.status, exc.code, exc.message, reason=exc.reason)

    @app.exception_handler(RequestValidationError)
    async def invalid(_request: Request, exc: RequestValidationError) -> JSONResponse:
        # Field names only. The submitted values are never echoed back or logged.
        fields = sorted({".".join(str(p) for p in e["loc"][1:]) or str(e["loc"][0]) for e in exc.errors()})
        return _error(422, "invalid_request", f"Check these fields: {', '.join(fields)}.")

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        codes = {404: "not_found", 405: "method_not_allowed"}
        message = "That does not exist." if exc.status_code == 404 else "That request is not allowed."
        return _error(exc.status_code, codes.get(exc.status_code, "http_error"), message)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(identity.router)
    app.include_router(users.router)
    app.include_router(projects.router)
    app.include_router(checklist.router)
    app.include_router(work.router)
    app.include_router(notifications.router)
    app.include_router(store.router)
    if settings.is_development:
        app.include_router(dev.router)
    return app


def build() -> FastAPI:
    configure_logging()
    return create_app()
