"""platform/tenants/[id]/users, [id]/stats 계약 테스트. (app/api/platform/tenants/[id]/users*, [id]/stats 컷오버, P3)

platform 은 테넌트 스코프 예외 — SuperAdmin 인증만 강제한다.
"""

from datetime import datetime, timezone

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.expense import Expense
from expense_api.core.models.tenant import SuperAdmin, Tenant
from expense_api.core.models.user import User
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.platform_jwt import create_platform_admin_token
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
                id="super-1",
                email="super@example.com",
                password=hash_password("super123"),
                name="슈퍼관리자",
            )
        )
        s.add(
            Tenant(
                id="tenant-1",
                name="기존테넌트",
                subdomain="existing-org",
                orgType="CHURCH",
                plan="FREE",
                maxUsers=2,
                currentUsers=1,
            )
        )
        await s.flush()
        s.add(
            User(
                id="user-1",
                tenantId="tenant-1",
                userid="member1",
                username="김회원",
                password=hash_password("memberpass1"),
                role="user",
                isActive=True,
            )
        )
        await s.flush()
        s.add(
            Expense(
                id="expense-1",
                tenantId="tenant-1",
                userId="user-1",
                applicantName="김회원",
                requestAmount=10000,
                status="DRAFT",
                committee="위원회",
                department="사역팀",
                requestDate=datetime.now(timezone.utc),
                bankName="국민",
                accountNumber="123-456",
                accountHolder="김회원",
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


def _auth_headers() -> dict:
    token = create_platform_admin_token("super-1", "super@example.com", "슈퍼관리자")
    return {"Authorization": f"Bearer {token}"}


async def test_list_tenant_users(client: AsyncClient):
    r = await client.get("/api/platform/tenants/tenant-1/users", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["pagination"]["total"] == 1
    assert body["users"][0]["userid"] == "member1"
    assert body["users"][0]["_count"]["expenses"] == 1
    assert body["limits"]["maxUsers"] == 2


async def test_list_tenant_users_requires_auth(client: AsyncClient):
    r = await client.get("/api/platform/tenants/tenant-1/users")
    assert r.status_code == 401


async def test_list_tenant_users_tenant_not_found(client: AsyncClient):
    r = await client.get("/api/platform/tenants/nope/users", headers=_auth_headers())
    assert r.status_code == 404


async def test_create_tenant_user(client: AsyncClient):
    r = await client.post(
        "/api/platform/tenants/tenant-1/users",
        json={"userid": "newmember", "username": "새회원", "password": "newpassword1"},
        headers=_auth_headers(),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["userid"] == "newmember"
    assert body["role"] == "user"

    r2 = await client.get("/api/platform/tenants/tenant-1/users", headers=_auth_headers())
    assert r2.json()["limits"]["currentUsers"] == 2


async def test_create_tenant_user_duplicate_userid_returns_409(client: AsyncClient):
    r = await client.post(
        "/api/platform/tenants/tenant-1/users",
        json={"userid": "member1", "username": "중복", "password": "duplicatepw1"},
        headers=_auth_headers(),
    )
    assert r.status_code == 409


async def test_create_tenant_user_over_limit_returns_400(client: AsyncClient):
    await client.post(
        "/api/platform/tenants/tenant-1/users",
        json={"userid": "second", "username": "둘째", "password": "secondpass1"},
        headers=_auth_headers(),
    )
    r = await client.post(
        "/api/platform/tenants/tenant-1/users",
        json={"userid": "third", "username": "셋째", "password": "thirdpass12"},
        headers=_auth_headers(),
    )
    assert r.status_code == 400


async def test_create_tenant_user_invalid_password_returns_400(client: AsyncClient):
    r = await client.post(
        "/api/platform/tenants/tenant-1/users",
        json={"userid": "shortpw", "username": "짧은비번", "password": "short"},
        headers=_auth_headers(),
    )
    assert r.status_code == 400


async def test_get_tenant_user_detail(client: AsyncClient):
    r = await client.get(
        "/api/platform/tenants/tenant-1/users/user-1", headers=_auth_headers()
    )
    assert r.status_code == 200
    body = r.json()
    assert body["userid"] == "member1"
    assert body["_count"]["expenses"] == 1
    assert body["recentActivity"]["expenses"][0]["id"] == "expense-1"


async def test_get_tenant_user_detail_not_found(client: AsyncClient):
    r = await client.get(
        "/api/platform/tenants/tenant-1/users/nope", headers=_auth_headers()
    )
    assert r.status_code == 404


async def test_update_tenant_user(client: AsyncClient):
    r = await client.put(
        "/api/platform/tenants/tenant-1/users/user-1",
        json={"username": "김회원2", "isActive": False},
        headers=_auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "김회원2"
    assert body["isActive"] is False

    # limits.currentUsers 는 (Next 원본과 동일하게) where 필터에 매칭되는 전체 사용자 수다 —
    # 비활성화해도 행은 남아 있으므로 여전히 1이다.
    r2 = await client.get("/api/platform/tenants/tenant-1/users", headers=_auth_headers())
    assert r2.json()["limits"]["currentUsers"] == 1


async def test_delete_tenant_user_soft(client: AsyncClient):
    r = await client.delete(
        "/api/platform/tenants/tenant-1/users/user-1", headers=_auth_headers()
    )
    assert r.status_code == 200
    assert r.json()["message"] == "사용자가 비활성화되었습니다."


async def test_delete_tenant_user_hard_blocked_by_expenses(client: AsyncClient):
    r = await client.delete(
        "/api/platform/tenants/tenant-1/users/user-1?hard=true", headers=_auth_headers()
    )
    assert r.status_code == 400


async def test_get_tenant_stats(client: AsyncClient):
    r = await client.get("/api/platform/tenants/tenant-1/stats", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["tenant"]["subdomain"] == "existing-org"
    assert body["usage"]["users"]["current"] == 1
    assert body["expenses"]["total"]["count"] == 1
    assert body["expenses"]["total"]["amount"] == 10000
    assert len(body["monthlyTrend"]) == 6


async def test_get_tenant_stats_not_found(client: AsyncClient):
    r = await client.get("/api/platform/tenants/nope/stats", headers=_auth_headers())
    assert r.status_code == 404
