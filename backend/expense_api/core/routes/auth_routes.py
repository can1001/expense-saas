"""인증 라우터 — 실제 로그인/me/logout. (app/api/auth/* 이전)"""

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import derive_legacy_flags
from expense_api.core.config.settings import settings
from expense_api.core.dependencies.auth import COOKIE_NAME, CurrentUser, get_current_user
from expense_api.core.dependencies.authz import effective_permissions
from expense_api.core.db.session import get_session
from expense_api.core.repository.tenant_repository import TenantRepository
from expense_api.core.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LoginTenant,
    LoginUser,
    MeResponse,
    MeTenant,
    MeUser,
    UserPermissionFlags,
)
from expense_api.core.security.rate_limit import (
    check_login_rate_limit,
    clear_login_attempts,
    get_rate_limit_key,
    record_login_failure,
)
from expense_api.core.service.auth_service import LoginError, login

router = APIRouter()


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=LoginResponse)
async def login_route(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    x_tenant_subdomain: str | None = Header(default=None),
    x_tenant_param: str | None = Header(default=None),
) -> LoginResponse:
    subdomain = x_tenant_subdomain or x_tenant_param

    # 브루트포스 방지 (리뷰 #1)
    rl_key = get_rate_limit_key(_client_ip(request), body.userid)
    allowed, retry_after = check_login_rate_limit(rl_key)
    if not allowed:
        raise HTTPException(
            429,
            "로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        result = await login(session, body.userid, body.password, subdomain)
    except LoginError as e:
        # 인증 실패(401/403)만 실패로 집계 — 테넌트 미존재(404)는 제외
        if e.status_code in (401, 403):
            record_login_failure(rl_key)
        raise HTTPException(e.status_code, e.message)

    clear_login_attempts(rl_key)  # 성공 시 초기화
    user = result.user
    # HttpOnly 쿠키로도 토큰 발급 (프론트 호환). prod 에서만 Secure (리뷰 #3)
    response.set_cookie(
        COOKIE_NAME,
        result.token,
        httponly=True,
        samesite="lax",
        secure=settings.is_prod,
        max_age=24 * 60 * 60,
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
            LoginTenant(
                id=result.tenant.id, name=result.tenant.name, subdomain=result.tenant.subdomain
            )
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
    flags = derive_legacy_flags(user.roles, user.granted)

    tenant = None
    if user.tenantId:
        tenant_row = await TenantRepository(session).get(user.tenantId)
        if tenant_row:
            tenant = MeTenant(
                id=tenant_row.id, name=tenant_row.name, subdomain=tenant_row.subdomain
            )

    return MeResponse(
        user=MeUser(
            id=user.id,
            userid=user.userid,
            username=user.username,
            role=user.role,
            roles=user.roles,
            department=user.department,
            departmentId=None,
            permissions=UserPermissionFlags(**flags),
            permissionCodes=sorted(perms),
            canRegisterUsers=flags["canRegisterUsers"],
        ),
        tenant=tenant,
    )


@router.post("/logout")
async def logout_route(response: Response) -> dict:
    response.delete_cookie(COOKIE_NAME)
    return {"success": True, "message": "로그아웃 되었습니다."}
