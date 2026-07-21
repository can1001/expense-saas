"""platform/auth 계약 테스트 — login/logout/me. (app/api/platform/auth/* 컷오버, P1)

일반 사용자 인증과 별도 세션 체계(별도 시크릿/쿠키/발급자)이므로 SuperAdmin 만 시딩한다.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import SuperAdmin
from expense_api.core.security.jwt import hash_password
from main import app


@pytest_asyncio.fixture
async def client():
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

    async with maker() as s:
        s.add(
            SuperAdmin(
                email="super@example.com",
                password=hash_password("super123"),
                name="슈퍼관리자",
            )
        )
        s.add(
            SuperAdmin(
                email="inactive@example.com",
                password=hash_password("super123"),
                name="비활성관리자",
                isActive=False,
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
    r = await client.post(
        "/api/platform/auth/login",
        json={"email": "super@example.com", "password": "super123"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "로그인 성공"
    assert body["admin"]["email"] == "super@example.com"
    assert body["admin"]["name"] == "슈퍼관리자"
    token = body["token"]
    assert token

    r2 = await client.get(
        "/api/platform/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r2.status_code == 200
    me = r2.json()["admin"]
    assert me["email"] == "super@example.com"
    assert me["isActive"] is True
    assert "createdAt" in me


async def test_login_wrong_password_returns_401(client: AsyncClient):
    r = await client.post(
        "/api/platform/auth/login",
        json={"email": "super@example.com", "password": "wrong-password"},
    )
    assert r.status_code == 401
    assert "이메일 또는 비밀번호" in r.json()["detail"]


async def test_login_unknown_email_returns_401(client: AsyncClient):
    r = await client.post(
        "/api/platform/auth/login",
        json={"email": "nobody@example.com", "password": "super123"},
    )
    assert r.status_code == 401


async def test_login_inactive_account_returns_403(client: AsyncClient):
    r = await client.post(
        "/api/platform/auth/login",
        json={"email": "inactive@example.com", "password": "super123"},
    )
    assert r.status_code == 403


async def test_login_invalid_email_format_returns_400(client: AsyncClient):
    r = await client.post(
        "/api/platform/auth/login",
        json={"email": "not-an-email", "password": "super123"},
    )
    assert r.status_code == 400


async def test_me_without_token_returns_401(client: AsyncClient):
    r = await client.get("/api/platform/auth/me")
    assert r.status_code == 401


async def test_me_rejects_regular_user_token(client: AsyncClient):
    """별도 세션 체계 — 일반 사용자 토큰은 platform/auth/me 를 통과하지 못한다."""
    from expense_api.core.security.jwt import create_access_token

    fake_user_token = create_access_token("some-user-id")
    r = await client.get(
        "/api/platform/auth/me",
        headers={"Authorization": f"Bearer {fake_user_token}"},
    )
    assert r.status_code == 401


async def test_login_cookie_set_and_logout_clears_it(client: AsyncClient):
    r = await client.post(
        "/api/platform/auth/login",
        json={"email": "super@example.com", "password": "super123"},
    )
    assert "super_admin_token" in r.cookies

    r2 = await client.post("/api/platform/auth/logout")
    assert r2.status_code == 200
    assert r2.json()["message"] == "로그아웃 되었습니다."
