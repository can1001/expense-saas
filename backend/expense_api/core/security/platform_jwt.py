"""플랫폼(SuperAdmin) 전용 JWT. (lib/auth/super-admin.ts createSuperAdminToken/verifySuperAdminToken 이전)

일반 사용자 세션(security/jwt.py)과 별도 시크릿·발급자·오디언스를 쓰는 독립 세션 체계다.
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from expense_api.core.config.settings import settings

PLATFORM_JWT_ISSUER = "expense-saas-platform"
PLATFORM_JWT_AUDIENCE = "super-admin"
PLATFORM_TOKEN_EXPIRE_HOURS = 8  # Next createTokenCookie 와 동일 (8시간)


def create_platform_admin_token(admin_id: str, email: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": admin_id,
        "email": email,
        "name": name,
        "iat": now,
        "iss": PLATFORM_JWT_ISSUER,
        "aud": PLATFORM_JWT_AUDIENCE,
        "exp": now + timedelta(hours=PLATFORM_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.SUPER_ADMIN_JWT_SECRET, algorithm="HS256")


def decode_platform_admin_token(token: str) -> dict:
    """검증 실패 시 JWTError 를 던진다. iss/aud 를 엄격히 검증한다(별도 세션 체계)."""
    return jwt.decode(
        token,
        settings.SUPER_ADMIN_JWT_SECRET,
        algorithms=["HS256"],
        issuer=PLATFORM_JWT_ISSUER,
        audience=PLATFORM_JWT_AUDIENCE,
    )


__all__ = [
    "PLATFORM_JWT_ISSUER",
    "PLATFORM_JWT_AUDIENCE",
    "PLATFORM_TOKEN_EXPIRE_HOURS",
    "create_platform_admin_token",
    "decode_platform_admin_token",
    "JWTError",
]
