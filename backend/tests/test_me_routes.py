"""me/config, me/memberships 라우트 계약 테스트. (app/api/me/* 컷오버)"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import Membership, User
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from main import app


@pytest_asyncio.fixture
async def client():
    _reset_all()
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
        t = Tenant(name="청연교회", subdomain="demo", orgType="CHURCH", logoUrl="https://cdn.example.com/logo.png")
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
        c._maker = maker  # type: ignore[attr-defined]
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def _login(client: AsyncClient, userid: str = "admin", password: str = "admin123") -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ── config ────────────────────────────────────────────────────────────
async def test_config_requires_auth(client: AsyncClient):
    r = await client.get("/api/me/config")
    assert r.status_code == 401


async def test_config_returns_church_labels_and_branding(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/me/config", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["tenant"]["name"] == "청연교회"
    assert data["tenant"]["orgType"] == "CHURCH"
    assert data["labels"] == {
        "department": "사역팀",
        "position": "직분",
        "budget": "예산(회계연도)",
    }
    assert data["features"] == {
        "incomeModule": True,
        "budgetModule": True,
        "vat": False,
        "taxInvoice": False,
        "offeringLink": True,
    }
    assert data["branding"] == {
        "logoUrl": "https://cdn.example.com/logo.png",
        "primaryColor": "#4f46e5",
    }


async def test_config_settings_partially_override_defaults(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        tenant = (await s.execute(select(Tenant))).scalars().first()
        tenant.settings = {
            "labels": {"department": "파트"},
            "features": {"incomeModule": False},
            "theme": {"primaryColor": "#1F3864"},
        }
        s.add(tenant)
        await s.commit()

    headers = await _login(client)
    r = await client.get("/api/me/config", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["labels"] == {
        "department": "파트",
        "position": "직분",
        "budget": "예산(회계연도)",
    }
    assert data["features"]["incomeModule"] is False
    assert data["features"]["budgetModule"] is True
    assert data["branding"]["primaryColor"] == "#1F3864"


# ── memberships ──────────────────────────────────────────────────────
async def test_memberships_requires_auth(client: AsyncClient):
    r = await client.get("/api/me/memberships")
    assert r.status_code == 401


async def test_memberships_lists_only_active_tenant_memberships(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        home_tenant = (await s.execute(select(Tenant))).scalars().first()
        admin = (await s.execute(select(User))).scalars().first()

        other_tenant = Tenant(name="소망교회", subdomain="somang", orgType="CHURCH")
        inactive_tenant = Tenant(name="비활성", subdomain="inactive", isActive=False)
        s.add_all([other_tenant, inactive_tenant])
        await s.flush()

        s.add_all(
            [
                Membership(userId=admin.id, tenantId=home_tenant.id, role="TENANT_ADMIN", isDefault=True),
                Membership(userId=admin.id, tenantId=other_tenant.id, role="MEMBER"),
                Membership(userId=admin.id, tenantId=inactive_tenant.id, role="MEMBER"),
            ]
        )
        await s.commit()

    headers = await _login(client)
    r = await client.get("/api/me/memberships", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["memberships"]) == 2

    by_tenant_name = {m["tenantName"]: m for m in data["memberships"]}
    assert by_tenant_name["청연교회"]["isCurrent"] is True
    assert by_tenant_name["청연교회"]["role"] == "TENANT_ADMIN"
    assert by_tenant_name["소망교회"]["isCurrent"] is False
    assert "비활성" not in by_tenant_name


async def test_memberships_empty_when_none_exist(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/me/memberships", headers=headers)
    assert r.status_code == 200
    assert r.json() == {"memberships": []}
