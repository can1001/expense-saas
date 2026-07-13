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


def create_access_token(subject: str, extra: dict | None = None) -> str:
    expire = _now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict = {"sub": subject, "type": "access", "exp": expire, "iat": _now()}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = _now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": subject, "type": "refresh", "exp": expire, "iat": _now()}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """검증 실패 시 JWTError 를 던진다."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "JWTError",
]
