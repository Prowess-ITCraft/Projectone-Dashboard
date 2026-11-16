from pydantic import BaseModel


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
