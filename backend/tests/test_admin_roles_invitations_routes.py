"""admin 역할·초대 라우트 계약 테스트.
(app/api/admin/roles, app/api/admin/roles/[id], app/api/admin/invitations 컷오버 — D4)
"""

from datetime import datetime, timezone

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import Invitation, Role, User, UserYearRole
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
        s.add(
            User(
                tenantId=t.id,
                userid="user1",
                username="사용자1",
                password=hash_password("user123"),
                role="user",
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


# ── roles ────────────────────────────────────────────────────────────


async def test_list_roles_excludes_inactive_by_default(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        tid = (await s.execute(select(Tenant.id))).scalar_one()
        s.add(Role(tenantId=tid, code="finance_head", name="재정팀장", sortOrder=1))
        s.add(Role(tenantId=tid, code="old_role", name="폐지된역할", sortOrder=2, isActive=False))
        await s.commit()

    headers = await _login(client)
    r = await client.get("/api/admin/roles", headers=headers)
    assert r.status_code == 200
    codes = [role["code"] for role in r.json()]
    assert "finance_head" in codes
    assert "old_role" not in codes

    r2 = await client.get("/api/admin/roles?includeInactive=true", headers=headers)
    codes2 = [role["code"] for role in r2.json()]
    assert "old_role" in codes2


async def test_list_roles_requires_permission(client: AsyncClient):
    headers = await _login(client, "user1", "user123")
    r = await client.get("/api/admin/roles", headers=headers)
    assert r.status_code == 403


async def test_create_role_and_reject_duplicate_code(client: AsyncClient):
    headers = await _login(client)

    r = await client.post(
        "/api/admin/roles",
        json={"code": "custom_role", "name": "커스텀역할", "permissions": ["expense:create"]},
        headers=headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["code"] == "custom_role"
    assert body["permissions"] == ["expense:create"]

    dup = await client.post(
        "/api/admin/roles", json={"code": "custom_role", "name": "다른이름"}, headers=headers
    )
    assert dup.status_code == 409


async def test_create_role_requires_code_and_name(client: AsyncClient):
    headers = await _login(client)
    r = await client.post("/api/admin/roles", json={"name": "이름만있음"}, headers=headers)
    assert r.status_code == 400


async def test_get_update_delete_role(client: AsyncClient):
    headers = await _login(client)

    created = await client.post(
        "/api/admin/roles", json={"code": "temp_role", "name": "임시역할"}, headers=headers
    )
    role_id = created.json()["id"]

    got = await client.get(f"/api/admin/roles/{role_id}", headers=headers)
    assert got.status_code == 200
    assert got.json()["name"] == "임시역할"

    updated = await client.put(
        f"/api/admin/roles/{role_id}", json={"name": "수정된역할", "isActive": True}, headers=headers
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "수정된역할"

    deleted = await client.delete(f"/api/admin/roles/{role_id}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["role"]["isActive"] is False


async def test_delete_role_rejects_protected_and_in_use(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        tid = (await s.execute(select(Tenant.id))).scalar_one()
        uid = (await s.execute(select(User.id).where(User.userid == "user1"))).scalar_one()
        admin_role = Role(tenantId=tid, code="admin", name="관리자")
        used_role = Role(tenantId=tid, code="used_role", name="사용중역할")
        s.add_all([admin_role, used_role])
        await s.flush()
        s.add(UserYearRole(tenantId=tid, userId=uid, year=2026, role="used_role", roleId=used_role.id))
        await s.commit()
        admin_role_id, used_role_id = admin_role.id, used_role.id

    headers = await _login(client)

    protected = await client.delete(f"/api/admin/roles/{admin_role_id}", headers=headers)
    assert protected.status_code == 400

    in_use = await client.delete(f"/api/admin/roles/{used_role_id}", headers=headers)
    assert in_use.status_code == 400
    assert in_use.json()["detail"]["usedBy"]["yearRoles"] == 1


async def test_get_role_not_found(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/admin/roles/does-not-exist", headers=headers)
    assert r.status_code == 404


# ── invitations ─────────────────────────────────────────────────────


async def test_create_and_list_invitations(client: AsyncClient):
    headers = await _login(client)

    created = await client.post(
        "/api/admin/invitations",
        json={"email": "invitee@example.com", "role": "MEMBER"},
        headers=headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["email"] == "invitee@example.com"
    assert body["role"] == "MEMBER"
    assert len(body["token"]) == 64

    listed = await client.get("/api/admin/invitations", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["token"] == body["token"]


async def test_create_invitation_rejects_invalid_payload(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/admin/invitations", json={"email": "not-an-email"}, headers=headers
    )
    assert r.status_code == 400

    r2 = await client.post(
        "/api/admin/invitations", json={"role": "SUPERUSER"}, headers=headers
    )
    assert r2.status_code == 400


async def test_list_invitations_scoped_to_tenant(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        other = Tenant(name="다른교회", subdomain="other")
        s.add(other)
        await s.flush()
        s.add(
            Invitation(
                tenantId=other.id,
                role="MEMBER",
                token="other-tenant-token",
                expiresAt=datetime.now(timezone.utc),
            )
        )
        await s.commit()

    headers = await _login(client)
    r = await client.get("/api/admin/invitations", headers=headers)
    assert r.status_code == 200
    assert r.json() == []


async def test_invitations_require_permission(client: AsyncClient):
    headers = await _login(client, "user1", "user123")
    r = await client.get("/api/admin/invitations", headers=headers)
    assert r.status_code == 403
