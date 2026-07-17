"""인증 의존성.

get_current_user: Bearer 토큰(또는 user_token 쿠키 폴백) → DB User 조회 →
활성/테넌트 일치 검증 → 현재 사용자(CurrentUser) 반환. (lib/auth/user.ts getUserFromRequest 이전)
"""

from dataclasses import dataclass, field

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.models.user import User
from expense_api.core.security.jwt import JWTError, decode_token

# Next.js lib/auth/user.ts COOKIE_NAME 과 동일 — auth_routes.py 쿠키 발급/삭제도 이 이름을 쓴다.
COOKIE_NAME = "user_token"

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: str
    tenantId: str | None
    userid: str
    username: str
    role: str
    roles: list[str]
    granted: list[str] = field(default_factory=list)
    roleId: str | None = None
    department: str | None = None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
    user_token: str | None = Cookie(default=None),
) -> CurrentUser:
    # 0) Bearer 헤더 우선, 없으면 user_token 쿠키로 폴백
    token = credentials.credentials if credentials else user_token
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "인증 정보가 없습니다.")

    # 1) 토큰 검증
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 토큰입니다.")
    # refresh 토큰만 거부. type 이 없는 Next.js 발급 토큰도 수용(상호호환).
    if payload.get("type") == "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "access 토큰이 아닙니다.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "토큰에 사용자 정보가 없습니다.")

    # 2) DB 에서 활성 상태 + 테넌트 일치 확인 (토큰만 믿지 않는다)
    user = await session.get(User, user_id)
    if user is None or not user.isActive:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 사용자입니다.")
    if (user.tenantId or "") != (payload.get("tenantId") or ""):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "테넌트가 일치하지 않습니다.")

    roles = payload.get("roles") or [user.role]
    return CurrentUser(
        id=user.id,
        tenantId=user.tenantId,
        userid=user.userid,
        username=user.username,
        role=user.role,
        roles=roles,
        granted=payload.get("granted") or [],
        roleId=user.roleId,
        department=user.department,
    )
