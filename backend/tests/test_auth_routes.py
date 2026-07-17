"""인증 라우트 통합 테스트 (리뷰 #4).

httpx ASGITransport 로 실제 FastAPI 앱을 구동하되,
get_session 을 인메모리 DB 로 오버라이드하고 lifespan(마이그레이션/시드)은 실행하지 않는다.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from main import app


@pytest_asyncio.fixture
async def client():
    _reset_all()  # 테스트 간 rate limit 상태 격리
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _fk_on(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # 시드: 테넌트 + admin 사용자 (역할 미시드 → 프리셋 폴백)
    async with maker() as s:
        t = Tenant(name="데모", subdomain="demo")
        s.add(t)
        await s.flush()
        s.add(
            User(
                tenantId=t.id,
                userid="admin",
                username="관리자",
                password=hash_password("admin123"),
                role="admin",
            )
        )
        await s.commit()

    async def _override():
        async with maker() as s:
            yield s

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def test_login_success_and_me(client: AsyncClient):
    r = await client.post("/api/auth/login", json={"userid": "admin", "password": "admin123"})
    assert r.status_code == 200
    token = r.json()["token"]
    assert token

    r2 = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["user"]["userid"] == "admin"
    assert data["user"]["role"] == "admin"
    # admin 은 프리셋 폴백으로 전체 권한 → expense:create 포함
    assert "expense:create" in data["user"]["permissionCodes"]
    assert data["user"]["permissions"]["canApprove"] is True
    assert data["tenant"]["subdomain"] == "demo"


async def test_login_wrong_password(client: AsyncClient):
    r = await client.post("/api/auth/login", json={"userid": "admin", "password": "WRONG"})
    assert r.status_code == 401


async def test_me_requires_auth(client: AsyncClient):
    r = await client.get("/api/auth/me")
    assert r.status_code in (401, 403)


async def test_me_rejects_invalid_token(client: AsyncClient):
    r = await client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


async def test_me_accepts_user_token_cookie_fallback(client: AsyncClient):
    r = await client.post("/api/auth/login", json={"userid": "admin", "password": "admin123"})
    token = r.json()["token"]

    r2 = await client.get("/api/auth/me", cookies={"user_token": token})
    assert r2.status_code == 200
    assert r2.json()["user"]["userid"] == "admin"


async def test_me_rejects_invalid_user_token_cookie(client: AsyncClient):
    r = await client.get("/api/auth/me", cookies={"user_token": "not.a.jwt"})
    assert r.status_code == 401


async def test_me_rejects_when_neither_header_nor_cookie(client: AsyncClient):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


async def test_bearer_header_takes_precedence_over_cookie(client: AsyncClient):
    # 쿠키는 만료/위조된 값이어도 Bearer 헤더가 있으면 헤더로 인증한다
    r = await client.post("/api/auth/login", json={"userid": "admin", "password": "admin123"})
    token = r.json()["token"]

    r2 = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        cookies={"user_token": "not.a.jwt"},
    )
    assert r2.status_code == 200


async def test_login_rate_limit_blocks_after_5_failures(client: AsyncClient):
    # 5회 실패 → 6회차 429 (리뷰 #1)
    for _ in range(5):
        r = await client.post("/api/auth/login", json={"userid": "admin", "password": "WRONG"})
        assert r.status_code == 401
    r6 = await client.post("/api/auth/login", json={"userid": "admin", "password": "WRONG"})
    assert r6.status_code == 429
    assert "Retry-After" in r6.headers
    # 올바른 비밀번호여도 차단 상태 유지 (창 내)
    r7 = await client.post("/api/auth/login", json={"userid": "admin", "password": "admin123"})
    assert r7.status_code == 429


async def test_login_success_clears_rate_limit(client: AsyncClient):
    # 몇 번 실패해도 성공하면 카운터 초기화
    for _ in range(3):
        await client.post("/api/auth/login", json={"userid": "admin", "password": "WRONG"})
    ok = await client.post("/api/auth/login", json={"userid": "admin", "password": "admin123"})
    assert ok.status_code == 200
    # 초기화되었으므로 다시 실패해도 즉시 차단되지 않음
    again = await client.post("/api/auth/login", json={"userid": "admin", "password": "WRONG"})
    assert again.status_code == 401
