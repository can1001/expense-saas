"""플랫폼(SuperAdmin) 인증 라우터 — login/logout/me. (app/api/platform/auth/* 이전)

일반 사용자 인증(auth_routes.py)과 별도 세션 체계 — 별도 시크릿/쿠키(super_admin_token)/
발급자를 쓴다. platform 도메인은 테넌트 스코프 예외이므로 tenantId 조건이 없다.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.config.settings import settings
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.platform_auth import (
    PLATFORM_COOKIE_NAME,
    CurrentPlatformAdmin,
    get_current_platform_admin,
)
from expense_api.core.models.tenant import SuperAdmin
from expense_api.core.security.jwt import verify_password
from expense_api.core.security.platform_jwt import (
    PLATFORM_TOKEN_EXPIRE_HOURS,
    create_platform_admin_token,
)

router = APIRouter()

# Next zod loginSchema 의 .email() 과 동일 수준(형식 검증용) — admin_routes.py 의 것과 동일 패턴.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class PlatformLoginRequest(BaseModel):
    email: str
    password: str


def _set_platform_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        PLATFORM_COOKIE_NAME,
        token,
        httponly=True,
        samesite="strict",
        secure=settings.is_prod,
        max_age=PLATFORM_TOKEN_EXPIRE_HOURS * 60 * 60,
    )


@router.post("/login")
async def platform_login_route(
    body: PlatformLoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    email = (body.email or "").strip()
    password = body.password or ""

    if not email or not _EMAIL_RE.match(email):
        raise HTTPException(400, "입력 데이터가 유효하지 않습니다.")
    if not password:
        raise HTTPException(400, "입력 데이터가 유효하지 않습니다.")

    admin = (
        await session.execute(select(SuperAdmin).where(SuperAdmin.email == email))
    ).scalars().first()
    if admin is None:
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")

    if not admin.isActive:
        raise HTTPException(403, "계정이 비활성화되어 있습니다. 관리자에게 문의하세요.")

    if not verify_password(password, admin.password):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")

    token = create_platform_admin_token(admin.id, admin.email, admin.name)
    _set_platform_cookie(response, token)

    return {
        "message": "로그인 성공",
        "admin": {"id": admin.id, "email": admin.email, "name": admin.name},
        "token": token,
    }


@router.post("/logout")
async def platform_logout_route(response: Response) -> dict:
    response.delete_cookie(PLATFORM_COOKIE_NAME)
    return {"message": "로그아웃 되었습니다."}


@router.get("/me")
async def platform_me_route(
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await session.get(SuperAdmin, admin.id)
    if row is None:
        raise HTTPException(404, "관리자 정보를 찾을 수 없습니다.")

    return {
        "admin": {
            "id": row.id,
            "email": row.email,
            "name": row.name,
            "isActive": row.isActive,
            "createdAt": row.createdAt,
            "updatedAt": row.updatedAt,
        }
    }
