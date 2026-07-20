"""플랫폼(SuperAdmin) 인증 의존성. (lib/auth/super-admin.ts withSuperAdmin 이전)

일반 사용자 인증(dependencies/auth.py)과 별도 세션 체계 — 별도 시크릿/쿠키/발급자를 쓴다.
"""

from dataclasses import dataclass

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import SuperAdmin
from expense_api.core.security.platform_jwt import JWTError, decode_platform_admin_token

# Next.js lib/auth/super-admin.ts COOKIE_NAME 과 동일 — platform_auth_routes.py 도 이 이름을 쓴다.
PLATFORM_COOKIE_NAME = "super_admin_token"

_bearer = HTTPBearer(auto_error=False)

_AUTH_REQUIRED_MESSAGE = "인증이 필요합니다. 플랫폼 관리자로 로그인하세요."


@dataclass
class CurrentPlatformAdmin:
    id: str
    email: str
    name: str


async def get_current_platform_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
    super_admin_token: str | None = Cookie(default=None),
) -> CurrentPlatformAdmin:
    # 1) Authorization 헤더 우선, 없으면 쿠키로 폴백 (Next getSuperAdminFromRequest 와 동일 순서)
    token = credentials.credentials if credentials else super_admin_token
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _AUTH_REQUIRED_MESSAGE)

    try:
        payload = decode_platform_admin_token(token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _AUTH_REQUIRED_MESSAGE)

    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _AUTH_REQUIRED_MESSAGE)

    # 2) DB 에서 활성 상태 확인 (토큰만 믿지 않는다)
    admin = await session.get(SuperAdmin, admin_id)
    if admin is None or not admin.isActive:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _AUTH_REQUIRED_MESSAGE)

    return CurrentPlatformAdmin(id=admin.id, email=admin.email, name=admin.name)
