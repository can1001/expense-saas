"""platform/{admins,activity-logs,settings,stats} 계약 테스트. (P4)

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
        s.add(
            SuperAdmin(
                id="super-2",
                email="second@example.com",
                password=hash_password("super123"),
                name="두번째관리자",
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
                requestAmount=10000, status="PENDING",
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


# ── admins ────────────────────────────────────────────────────────────────


async def test_list_admins_returns_stats(client: AsyncClient):
    r = await client.get("/api/platform/admins", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert len(body["admins"]) == 2
    assert body["stats"] == {"total": 2, "active": 2}


async def test_list_admins_requires_auth(client: AsyncClient):
    r = await client.get("/api/platform/admins")
    assert r.status_code == 401


async def test_create_admin_success(client: AsyncClient):
    r = await client.post(
        "/api/platform/admins",
        json={"email": "new@example.com", "password": "newpass123", "name": "신규관리자"},
        headers=_auth_headers(),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "new@example.com"
    assert body["isActive"] is True
    assert "password" not in body


async def test_create_admin_duplicate_email_returns_409(client: AsyncClient):
    r = await client.post(
        "/api/platform/admins",
        json={"email": "super@example.com", "password": "newpass123", "name": "중복관리자"},
        headers=_auth_headers(),
    )
    assert r.status_code == 409


async def test_update_admin_deactivate_last_active_blocked(client: AsyncClient):
    # super-2 를 비활성화 후 super-1 도 비활성화 시도 → 마지막 활성 관리자 보호
    r1 = await client.put(
        "/api/platform/admins/super-2", json={"isActive": False}, headers=_auth_headers()
    )
    assert r1.status_code == 200

    r2 = await client.put(
        "/api/platform/admins/super-1", json={"isActive": False}, headers=_auth_headers()
    )
    assert r2.status_code == 400


async def test_delete_admin_self_forbidden(client: AsyncClient):
    r = await client.delete("/api/platform/admins/super-1", headers=_auth_headers())
    assert r.status_code == 400


async def test_delete_admin_success(client: AsyncClient):
    r = await client.delete("/api/platform/admins/super-2", headers=_auth_headers())
    assert r.status_code == 200
    assert r.json()["message"] == "관리자가 삭제되었습니다."


# ── activity-logs ────────────────────────────────────────────────────────


async def test_list_activity_logs(client: AsyncClient):
    r = await client.get("/api/platform/activity-logs", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["pagination"]["total"] == 1
    assert body["logs"][0]["action"] == "CREATE_TENANT"
    assert body["stats"]["byAction"]["CREATE_TENANT"] == 1


async def test_list_activity_logs_filters_by_tenant(client: AsyncClient):
    r = await client.get(
        "/api/platform/activity-logs", params={"tenantId": "no-such-tenant"},
        headers=_auth_headers(),
    )
    assert r.status_code == 200
    assert r.json()["pagination"]["total"] == 0


# ── settings ─────────────────────────────────────────────────────────────


async def test_get_settings_returns_defaults(client: AsyncClient):
    r = await client.get("/api/platform/settings", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["settings"]["general"]["platformName"] == "Expense SaaS"
    assert body["updatedAt"] is None


async def test_update_settings_persists_and_merges(client: AsyncClient):
    r = await client.put(
        "/api/platform/settings",
        json={"general": {"platformName": "새 플랫폼"}},
        headers=_auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    # PUT 응답은 Next 원본과 동일하게 저장된 값만 병합(기본값은 GET 에서만 병합됨)
    assert body["settings"] == {"general": {"platformName": "새 플랫폼"}}

    # GET 은 기본값과 병합되어 다른 섹션도 함께 반환된다
    r2 = await client.get("/api/platform/settings", headers=_auth_headers())
    settings = r2.json()["settings"]
    assert settings["general"]["platformName"] == "새 플랫폼"
    assert settings["security"]["defaultSessionTimeoutMinutes"] == 60


async def test_update_settings_validation_error(client: AsyncClient):
    r = await client.put(
        "/api/platform/settings",
        json={"security": {"maxLoginAttempts": 100}},
        headers=_auth_headers(),
    )
    assert r.status_code == 400


# ── stats ────────────────────────────────────────────────────────────────


async def test_platform_stats(client: AsyncClient):
    r = await client.get("/api/platform/stats", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["overview"]["tenants"]["total"] == 1
    assert body["overview"]["expenses"]["total"]["count"] == 1
    assert body["overview"]["expenses"]["total"]["amount"] == 10000
    assert len(body["monthlyTrend"]) == 6
    assert body["recentTenants"][0]["subdomain"] == "test-church"
