"""JWT 상호호환 검증 — FastAPI ↔ Next.js 토큰 교차 수용.

전제: 동일 시크릿(SECRET_KEY == USER_JWT_SECRET). 형식(iss/aud/type)만 정렬되면
동일 시크릿 하에서 서로의 토큰을 검증할 수 있다.
"""

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.config.settings import settings
from expense_api.core.dependencies.auth import get_current_user
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.security.jwt import create_access_token, create_refresh_token, decode_token

_NEXTJS_ISS = "expense-saas"
_NEXTJS_AUD = "tenant-user"


def _nextjs_style_token(sub: str, tenant_id: str, *, type_claim: str | None = None) -> str:
    """Next.js(jose)가 발급하는 형식의 토큰을 흉내낸다 (type 클레임 없음, iss/aud 존재)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "tenantId": tenant_id,
        "userid": "u",
        "username": "U",
        "role": "admin",
        "roles": ["admin"],
        "granted": [],
        "iss": _NEXTJS_ISS,
        "aud": _NEXTJS_AUD,
        "iat": now,
        "exp": now + timedelta(hours=24),
    }
    if type_claim:
        payload["type"] = type_claim
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


# ── FastAPI 토큰이 Next.js 검증(iss/aud enforce)을 통과 ────────────────
def test_fastapi_token_has_issuer_audience():
    token = create_access_token("user1", extra={"tenantId": "t1"})
    # Next.js jwtVerify 처럼 issuer/audience 를 강제 검증 → 통과해야 함
    decoded = jwt.decode(
        token, settings.SECRET_KEY, algorithms=["HS256"],
        audience=_NEXTJS_AUD, issuer=_NEXTJS_ISS,
    )
    assert decoded["sub"] == "user1"
    assert decoded["iss"] == _NEXTJS_ISS
    assert decoded["aud"] == _NEXTJS_AUD


def test_fastapi_token_roundtrip():
    token = create_access_token("user1", extra={"tenantId": "t1"})
    claims = decode_token(token)
    assert claims["sub"] == "user1" and claims["tenantId"] == "t1"


def test_nextjs_style_token_accepted_by_decode():
    # type 없는 Next.js 토큰도 decode_token 수용 (동일 시크릿)
    token = _nextjs_style_token("user1", "t1")
    claims = decode_token(token)
    assert claims["sub"] == "user1"
    assert "type" not in claims


# ── get_current_user 교차 수용 ────────────────────────────────────────
@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


async def _seed_user(session) -> tuple[str, str]:
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    u = User(tenantId=t.id, userid="u", username="U", role="admin")
    session.add(u)
    await session.flush()
    return u.id, t.id


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


async def test_get_current_user_accepts_nextjs_token(session: AsyncSession):
    uid, tid = await _seed_user(session)
    token = _nextjs_style_token(uid, tid)  # type 없음
    cur = await get_current_user(_creds(token), session)
    assert cur.id == uid and cur.role == "admin"


async def test_get_current_user_accepts_fastapi_token(session: AsyncSession):
    uid, tid = await _seed_user(session)
    token = create_access_token(uid, extra={"tenantId": tid, "roles": ["admin"], "role": "admin"})
    cur = await get_current_user(_creds(token), session)
    assert cur.id == uid


async def test_get_current_user_rejects_refresh(session: AsyncSession):
    uid, tid = await _seed_user(session)
    refresh = create_refresh_token(uid)
    with pytest.raises(HTTPException) as e:
        await get_current_user(_creds(refresh), session)
    assert e.value.status_code == 401
