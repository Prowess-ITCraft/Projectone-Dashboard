from typing import Any

from fastapi import APIRouter, Request, Response

from app.api.deps import SessionDep, SettingsDep, SignedInUser
from app.api.identity import me_out
from app.errors import error_response
from app.schemas.common import ChangePasswordIn, LoginIn, MeOut
from app.services import auth

router = APIRouter(prefix="/auth", tags=["sign-in"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=MeOut, responses={401: {}, 429: {}})
async def login(body: LoginIn, request: Request, response: Response, session: SessionDep, settings: SettingsDep) -> Any:
    """One answer for every failure (unknown email, wrong password, deactivated account). The attempt is recorded
    and committed even when it fails, which is why errors are returned here rather than raised."""
    result = await auth.sign_in(session, settings, body.email, body.password, _client_ip(request))
    if result.error or result.user is None or result.token is None:
        error = result.error or auth.INVALID
        return error_response(error.status, error.code, error.message)
    response.set_cookie(
        auth.SESSION_COOKIE,
        result.token,
        max_age=settings.session_max_hours * 3600,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )
    return await me_out(session, result.user)


@router.post("/logout", status_code=204)
async def logout(request: Request, session: SessionDep, settings: SettingsDep) -> Response:
    token = request.cookies.get(auth.SESSION_COOKIE)
    if token:
        await auth.end_session(session, token)
    response = Response(status_code=204)
    response.delete_cookie(auth.SESSION_COOKIE, path="/", secure=settings.secure_cookies, httponly=True, samesite="lax")
    return response


@router.post("/change-password", response_model=MeOut)
async def change_password(
    body: ChangePasswordIn, request: Request, user: SignedInUser, session: SessionDep, settings: SettingsDep
) -> MeOut:
    """Also ends the user's other sessions, so a password given out by an Admin stops working everywhere else."""
    await auth.change_password(
        session,
        user,
        body.current_password,
        body.new_password,
        getattr(request.state, "session_id", None),
        settings.default_engineer_password,
    )
    return await me_out(session, user)
