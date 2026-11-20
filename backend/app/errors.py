from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.request_context import request_id_var


class ErrorBody(BaseModel):
    """The one error shape every endpoint uses. `reason` explains a locked action in plain language."""

    code: str
    message: str
    reason: str | None = None
    request_id: str | None = None


class AppError(Exception):
    """A failure the screen can show: a stable code, a plain message and, for locked actions, the reason."""

    def __init__(self, code: str, message: str, *, status: int = 400, reason: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.reason = reason


def not_signed_in(message: str = "Sign in to continue.") -> AppError:
    return AppError("not_signed_in", message, status=401)


def forbidden(message: str, *, reason: str | None = None) -> AppError:
    return AppError("forbidden", message, status=403, reason=reason)


def not_found(message: str = "That does not exist.") -> AppError:
    """Also used when something exists but the user may not know it does, so the two cannot be told apart."""
    return AppError("not_found", message, status=404)


def error_response(status: int, code: str, message: str, *, reason: str | None = None) -> JSONResponse:
    """The error shape as a response, for the few places that must reply with an error and still commit (a failed
    sign-in is recorded, and that record has to survive the refusal)."""
    body = ErrorBody(code=code, message=message, reason=reason, request_id=request_id_var.get())
    return JSONResponse(status_code=status, content=body.model_dump(exclude_none=True))
