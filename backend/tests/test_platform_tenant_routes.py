"""platform/tenants 계약 테스트. (app/api/platform/tenants* 컷오버, P2)

platform 은 테넌트 스코프 예외 — SuperAdmin 인증만 강제한다.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.provisioning import (
    AccountCategoryTemplate,
    ApprovalLineTemplate,
    ApprovalStepTemplate,
)
from expense_api.core.models.tenant import SuperAdmin, Tenant
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
                id="tenant-existing",
                name="기존테넌트",
                subdomain="existing-org",
                orgType="CHURCH",
                plan="FREE",
            )
        )

        line_template = ApprovalLineTemplate(
            id="line-tpl-1", orgType="CHURCH", name="일반 결재선", isDefault=True, sortOrder=0
        )
        s.add(line_template)
        s.add(
            ApprovalStepTemplate(templateId="line-tpl-1", stepOrder=1, roleLabel="부서장")
        )
        s.add(
            AccountCategoryTemplate(
                orgType="CHURCH", code="1001", name="십일조", group="헌금수입",
                kind="INCOME", sortOrder=1,
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


async def test_create_tenant_success_clones_templates(client: AsyncClient):
    r = await client.post(
        "/api/platform/tenants",
        json={
            "name": "새 교회",
            "subdomain": "new-church",
            "orgType": "CHURCH",
            "plan": "FREE",
            "adminEmail": "admin@new-church.example",
            "adminName": "관리자",
            "adminPassword": "adminpass123",
        },
        headers=_auth_headers(),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "새 교회"
    assert body["subdomain"] == "new-church"
    assert body["maxUsers"] == 10  # FREE plan limit
    assert body["currentUsers"] == 1  # 어드민 계정 생성됨
    assert body["settings"]["approvalLines"][0]["steps"][0]["roleLabel"] == "부서장"


async def test_create_tenant_duplicate_subdomain_returns_409(client: AsyncClient):
    r = await client.post(
        "/api/platform/tenants",
        json={"name": "중복", "subdomain": "existing-org"},
        headers=_auth_headers(),
    )
    assert r.status_code == 409


async def test_create_tenant_invalid_subdomain_returns_400(client: AsyncClient):
    r = await client.post(
        "/api/platform/tenants",
        json={"name": "짧은서브도메인", "subdomain": "ab"},
        headers=_auth_headers(),
    )
    assert r.status_code == 400


async def test_create_tenant_requires_auth(client: AsyncClient):
    r = await client.post(
        "/api/platform/tenants", json={"name": "무인증", "subdomain": "no-auth-org"}
    )
    assert r.status_code == 401


async def test_list_tenants(client: AsyncClient):
    r = await client.get("/api/platform/tenants", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["pagination"]["total"] == 1
    assert body["tenants"][0]["subdomain"] == "existing-org"
    assert body["tenants"][0]["_count"]["users"] == 0


async def test_get_tenant_detail(client: AsyncClient):
    r = await client.get("/api/platform/tenants/tenant-existing", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "tenant-existing"
    assert body["_count"]["committees"] == 0


async def test_get_tenant_detail_not_found(client: AsyncClient):
    r = await client.get("/api/platform/tenants/nope", headers=_auth_headers())
    assert r.status_code == 404


async def test_update_tenant_suspend_and_activate(client: AsyncClient):
    r = await client.put(
        "/api/platform/tenants/tenant-existing",
        json={"isActive": False},
        headers=_auth_headers(),
    )
    assert r.status_code == 200
    assert r.json()["isActive"] is False
    assert r.json()["suspendedAt"] is not None

    r2 = await client.put(
        "/api/platform/tenants/tenant-existing",
        json={"isActive": True},
        headers=_auth_headers(),
    )
    assert r2.status_code == 200
    assert r2.json()["isActive"] is True
    assert r2.json()["suspendedAt"] is None


async def test_delete_tenant_soft(client: AsyncClient):
    r = await client.delete("/api/platform/tenants/tenant-existing", headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "테넌트가 비활성화되었습니다."
    assert body["tenant"]["isActive"] is False


async def test_get_and_update_tenant_settings(client: AsyncClient):
    r = await client.get(
        "/api/platform/tenants/tenant-existing/settings", headers=_auth_headers()
    )
    assert r.status_code == 200
    body = r.json()
    assert body["tenant"]["subdomain"] == "existing-org"
    assert body["settings"]["theme"]["primaryColor"] == "#4f46e5"

    r2 = await client.put(
        "/api/platform/tenants/tenant-existing/settings",
        json={"theme": {"primaryColor": "#123456"}},
        headers=_auth_headers(),
    )
    assert r2.status_code == 200
    assert r2.json()["settings"]["theme"]["primaryColor"] == "#123456"

    r3 = await client.get(
        "/api/platform/tenants/tenant-existing/settings", headers=_auth_headers()
    )
    assert r3.json()["settings"]["theme"]["primaryColor"] == "#123456"
    # 병합된 필드가 다른 섹션(accentColor 등)을 지우지 않아야 한다
    assert r3.json()["settings"]["theme"]["accentColor"] == "#6366f1"


async def test_update_tenant_settings_invalid_color_returns_400(client: AsyncClient):
    r = await client.put(
        "/api/platform/tenants/tenant-existing/settings",
        json={"theme": {"primaryColor": "not-a-color"}},
        headers=_auth_headers(),
    )
    assert r.status_code == 400
