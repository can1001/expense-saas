"""인증 라우터 — 실제 로그인/me/logout. (app/api/auth/* 이전)"""

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import effective_permissions
from expense_api.core.db.session import get_session
from expense_api.core.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LoginTenant,
    LoginUser,
    MeResponse,
    UserPermissionFlags,
)
from expense_api.core.service.auth_service import LoginError, login

router = APIRouter()

_COOKIE_NAME = "user_token"


@router.post("/login", response_model=LoginResponse)
async def login_route(
    body: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
    x_tenant_subdomain: str | None = Header(default=None),
    x_tenant_param: str | None = Header(default=None),
) -> LoginResponse:
    subdomain = x_tenant_subdomain or x_tenant_param
    try:
        result = await login(session, body.userid, body.password, subdomain)
    except LoginError as e:
        raise HTTPException(e.status_code, e.message)

    user = result.user
    # HttpOnly 쿠키로도 토큰 발급 (프론트 호환)
    response.set_cookie(
        _COOKIE_NAME, result.token, httponly=True, samesite="lax", max_age=24 * 60 * 60
    )
    return LoginResponse(
        user=LoginUser(
            id=user.id,
            userid=user.userid,
            username=user.username,
            role=user.role,
            department=user.department,
            permissions=UserPermissionFlags(**result.flags),
        ),
        tenant=(
            LoginTenant(id=result.tenant.id, name=result.tenant.name, subdomain=result.tenant.subdomain)
            if result.tenant
            else None
        ),
        token=result.token,
    )


@router.get("/me", response_model=MeResponse)
async def me_route(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    perms = await effective_permissions(user, session)
    return MeResponse(
        id=user.id,
        userid=user.userid,
        username=user.username,
        role=user.role,
        roles=user.roles,
        tenantId=user.tenantId,
        department=user.department,
        permissions=sorted(perms),
    )


@router.post("/logout")
async def logout_route(response: Response) -> dict:
    response.delete_cookie(_COOKIE_NAME)
    return {"success": True}
