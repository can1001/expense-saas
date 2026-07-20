"""platform/export 계약 테스트. (P5)

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
from expense_api.core.models.tenant import PlatformActivityLog, SuperAdmin, Tenant
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
        tenant = Tenant(
            id="tenant-1", name="테스트교회", subdomain="test-church", orgType="CHURCH",
            plan="FREE", isActive=True, currentUsers=1,
        )
        s.add(tenant)
        await s.flush()
        s.add(
            User(
                id="user-1", tenantId="tenant-1", userid="member1", username="홍길동",
                password=hash_password("memberpass1"), role="user", isActive=True,
            )
        )
        await s.flush()
        s.add(
            Expense(
                id="exp-1", tenantId="tenant-1", userId="user-1", applicantName="홍길동",
                requestAmount=12000, status="PENDING",
                committee="위원회", department="사역팀",
                requestDate=datetime.now(timezone.utc),
                bankName="국민", accountNumber="123-456", accountHolder="홍길동",
                createdAt=datetime.now(timezone.utc),
            )
        )
        s.add(
            PlatformActivityLog(
                superAdminId="super-1",
                superAdminEmail="super@example.com",
                action="CREATE_TENANT",
                entityType="tenant",
                entityId="tenant-1",
                tenantId="tenant-1",
                tenantName="테스트교회",
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


def _auth_headers(admin_id: str = "super-1", email: str = "super@example.com") -> dict:
    token = create_platform_admin_token(admin_id, email, "슈퍼관리자")
    return {"Authorization": f"Bearer {token}"}


async def test_export_requires_auth(client: AsyncClient):
    r = await client.get("/api/platform/export")
    assert r.status_code == 401


async def test_export_tenants_csv_default(client: AsyncClient):
    r = await client.get("/api/platform/export", headers=_auth_headers())
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert 'filename="tenants_' in r.headers["content-disposition"]
    body = r.text
    assert body.startswith("﻿")
    assert "테스트교회" in body
    assert "test-church" in body


async def test_export_tenants_json(client: AsyncClient):
    r = await client.get(
        "/api/platform/export", params={"type": "tenants", "format": "json"}, headers=_auth_headers()
    )
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "tenants"
    assert body["count"] == 1
    assert body["data"][0]["_count"] == {"users": 1, "expenses": 1}


async def test_export_users_scoped_by_tenant(client: AsyncClient):
    r = await client.get(
        "/api/platform/export",
        params={"type": "users", "format": "json", "tenantId": "tenant-1"},
        headers=_auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert body["data"][0]["tenant"] == {"name": "테스트교회", "subdomain": "test-church"}


async def test_export_expenses_csv(client: AsyncClient):
    r = await client.get(
        "/api/platform/export", params={"type": "expenses"}, headers=_auth_headers()
    )
    assert r.status_code == 200
    assert "홍길동" in r.text
    assert "12,000" in r.text


async def test_export_activity_logs_json(client: AsyncClient):
    r = await client.get(
        "/api/platform/export",
        params={"type": "activity-logs", "format": "json"},
        headers=_auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    # 내보내기 자체의 EXPORT_DATA 로그는 데이터 조회 이후에 기록되므로 응답에는 포함되지 않는다.
    assert body["count"] == 1


async def test_export_admins_json_excludes_password(client: AsyncClient):
    r = await client.get(
        "/api/platform/export",
        params={"type": "admins", "format": "json"},
        headers=_auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert "password" not in body["data"][0]


async def test_export_unsupported_type_returns_400(client: AsyncClient):
    r = await client.get(
        "/api/platform/export", params={"type": "bogus"}, headers=_auth_headers()
    )
    assert r.status_code == 400
