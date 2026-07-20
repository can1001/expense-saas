"""JWT 발급/검증 + 비밀번호 해시 (Phase 0 골격).

Phase 1 에서 User 모델과 연결된다. 지금은 파이프라인 검증용 유틸.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from expense_api.core.config.settings import settings


# ── 비밀번호 ──────────────────────────────────────────────
# bcrypt 를 직접 사용한다. bcryptjs($2a/$2b) 해시와 포맷 호환되므로 기존 데이터 검증 가능.
# bcrypt 는 72바이트까지만 사용하므로 명시적으로 truncate 한다 (bcryptjs 와 동일 동작).
def hash_password(raw: str) -> str:
    pw = raw.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ── 토큰 ─────────────────────────────────────────────────
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _base_claims(subject: str) -> dict:
    # iss/aud 를 Next.js 형식과 맞춰 상호 검증 가능하게 한다.
    return {"sub": subject, "iss": settings.JWT_ISSUER, "aud": settings.JWT_AUDIENCE, "iat": _now()}


def create_access_token(subject: str, extra: dict | None = None) -> str:
    expire = _now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict = {**_base_claims(subject), "type": "access", "exp": expire}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = _now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {**_base_claims(subject), "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# B2: 복수 소속 조직 선택용 임시 토큰 (Next lib/auth/user.ts createPendingSelectionToken 이전).
# tenantId 클레임 없이 짧게 발급 — 정식 세션으로는 쓰이지 않고 switch-tenant(B3)에서만 읽는다.
PENDING_SELECTION_TOKEN_EXPIRE_MINUTES = 10


def create_pending_selection_token(user_id: str, userid: str, username: str) -> str:
    expire = _now() + timedelta(minutes=PENDING_SELECTION_TOKEN_EXPIRE_MINUTES)
    payload = {
        **_base_claims(user_id),
        "userid": userid,
        "username": username,
        "pendingTenantSelection": True,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """검증 실패 시 JWTError 를 던진다.

    상호호환: 서명(공유 시크릿)+만료만 강제하고 aud 는 강제하지 않는다
    (Next.js 발급 토큰도, FastAPI 토큰도 동일 시크릿이면 수용).
    """
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"verify_aud": False},
    )


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "create_pending_selection_token",
    "decode_token",
    "JWTError",
]
