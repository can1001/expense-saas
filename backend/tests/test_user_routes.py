"""users 목록·생성·상세·수정·비활성화 라우트 계약 테스트. (app/api/users/* 컷오버)"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
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
        c._maker = maker  # type: ignore[attr-defined]
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def _login(client: AsyncClient, userid: str = "admin", password: str = "admin123") -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _tenant_id(client: AsyncClient) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        return (await s.execute(select(Tenant.id))).scalar_one()


# ── 목록 ──────────────────────────────────────────────────────────────
async def test_list_users_paginates_and_scopes_tenant(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        s.add(
            User(tenantId=tid, userid="member1", username="회원1", role="user")
        )
        # 다른 테넌트 사용자 — 목록에 섞이면 안 됨
        other = Tenant(name="다른교회", subdomain="other")
        s.add(other)
        await s.flush()
        s.add(User(tenantId=other.id, userid="ghost", username="유령", role="user"))
        await s.commit()

    r = await client.get("/api/users", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["pagination"] == {"page": 1, "pageSize": 20, "total": 2, "totalPages": 1}
    userids = {u["userid"] for u in body["users"]}
    assert userids == {"admin", "member1"}


async def test_list_users_requires_auth(client: AsyncClient):
    r = await client.get("/api/users")
    assert r.status_code == 401


# ── 생성 ──────────────────────────────────────────────────────────────
async def test_create_user_success_creates_membership(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)

    r = await client.post(
        "/api/users",
        json={"userid": "newbie", "username": "새회원", "role": "user"},
        headers=headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["userid"] == "newbie"
    assert body["mustChangePassword"] is True

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        membership = (
            await s.execute(select(Membership).where(Membership.userId == body["id"]))
        ).scalars().first()
        assert membership is not None
        assert membership.tenantId == tid
        assert membership.role == "MEMBER"
        assert membership.isDefault is True


async def test_create_user_duplicate_userid_conflicts(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/users", json={"userid": "admin", "username": "다른이름"}, headers=headers
    )
    assert r.status_code == 409


async def test_create_user_invalid_role_rejected(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/users",
        json={"userid": "bad", "username": "나쁜역할", "role": "not_a_role"},
        headers=headers,
    )
    assert r.status_code == 400


async def test_create_user_requires_permission(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    tid = await _tenant_id(client)
    async with maker() as s:
        s.add(
            User(
                tenantId=tid,
                userid="plain",
                username="일반",
                password=hash_password("plain123"),
                role="user",
            )
        )
        await s.commit()

    headers = await _login(client, userid="plain", password="plain123")
    r = await client.post(
        "/api/users", json={"userid": "x", "username": "x"}, headers=headers
    )
    assert r.status_code == 403


# ── 상세 ──────────────────────────────────────────────────────────────
async def test_get_user_not_found(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/users/does-not-exist", headers=headers)
    assert r.status_code == 404


# ── 수정·비활성화 ────────────────────────────────────────────────────
async def test_update_and_deactivate_user(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        u = User(tenantId=tid, userid="target", username="대상자", role="user")
        s.add(u)
        await s.commit()
        await s.refresh(u)
        user_id = u.id

    r = await client.put(
        f"/api/users/{user_id}",
        json={"department": "재정팀"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["department"] == "재정팀"
    assert r.json()["username"] == "대상자"  # 미지정 필드는 보존

    r2 = await client.delete(f"/api/users/{user_id}", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["message"] == "User deactivated successfully"
    assert r2.json()["user"]["isActive"] is False
