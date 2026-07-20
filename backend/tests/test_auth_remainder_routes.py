"""auth 잔여 라우트 계약 테스트 — signup·change-password·switch-tenant·accept-invitation.
(app/api/auth/signup, change-password, switch-tenant, accept-invitation 컷오버, A5)
"""

from datetime import datetime, timedelta, timezone

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import AuthAccount, Invitation, Membership, User
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
        t = Tenant(name="청연교회", subdomain="demo", orgType="CHURCH")
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


# ── signup ───────────────────────────────────────────────────────────
async def test_signup_creates_user_without_tenant(client: AsyncClient):
    r = await client.post(
        "/api/auth/signup",
        json={"userid": "newbie", "username": "새사용자", "password": "pass1234"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["userid"] == "newbie"
    assert data["role"] == "user"

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        user = (await s.execute(select(User).where(User.userid == "newbie"))).scalars().first()
        assert user is not None
        assert user.tenantId is None


async def test_signup_rejects_duplicate_userid(client: AsyncClient):
    r = await client.post(
        "/api/auth/signup",
        json={"userid": "admin", "username": "다른이름", "password": "pass1234"},
    )
    assert r.status_code == 409


async def test_signup_rejects_short_password(client: AsyncClient):
    r = await client.post(
        "/api/auth/signup",
        json={"userid": "shorty", "username": "짧은비번", "password": "123"},
    )
    assert r.status_code == 400


async def test_signup_requires_userid(client: AsyncClient):
    r = await client.post(
        "/api/auth/signup", json={"username": "이름만", "password": "pass1234"}
    )
    assert r.status_code == 400


# ── change-password ────────────────────────────────────────────────────
async def test_change_password_requires_auth(client: AsyncClient):
    r = await client.post(
        "/api/auth/change-password",
        json={"currentPassword": "admin123", "newPassword": "newpass1"},
    )
    assert r.status_code in (401, 403)


async def test_change_password_rejects_wrong_current_password(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/auth/change-password",
        json={"currentPassword": "WRONG", "newPassword": "newpass1"},
        headers=headers,
    )
    assert r.status_code == 401


async def test_change_password_success_allows_relogin(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/auth/change-password",
        json={"currentPassword": "admin123", "newPassword": "newpass1"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["success"] is True

    relogin = await client.post(
        "/api/auth/login", json={"userid": "admin", "password": "newpass1"}
    )
    assert relogin.status_code == 200


# ── switch-tenant ──────────────────────────────────────────────────────
async def test_switch_tenant_requires_body_tenant_id(client: AsyncClient):
    headers = await _login(client)
    r = await client.post("/api/auth/switch-tenant", json={}, headers=headers)
    assert r.status_code == 400


async def test_switch_tenant_requires_auth(client: AsyncClient):
    r = await client.post("/api/auth/switch-tenant", json={"tenantId": "whatever"})
    assert r.status_code == 401


async def test_switch_tenant_rejects_non_member(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        other = Tenant(name="소망교회", subdomain="somang", orgType="CHURCH")
        s.add(other)
        await s.commit()
        other_id = other.id

    headers = await _login(client)
    r = await client.post(
        "/api/auth/switch-tenant", json={"tenantId": other_id}, headers=headers
    )
    assert r.status_code == 403


async def test_switch_tenant_success_as_guest_member(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        admin = (await s.execute(select(User).where(User.userid == "admin"))).scalars().first()
        other = Tenant(name="소망교회", subdomain="somang", orgType="CHURCH")
        s.add(other)
        await s.flush()
        s.add(Membership(userId=admin.id, tenantId=other.id, role="MEMBER"))
        await s.commit()
        other_id = other.id

    headers = await _login(client)
    r = await client.post(
        "/api/auth/switch-tenant", json={"tenantId": other_id}, headers=headers
    )
    assert r.status_code == 200
    data = r.json()
    assert data["tenant"]["id"] == other_id
    assert data["tenant"]["subdomain"] == "somang"
    # 게스트 소속은 홈의 admin 권한이 아니라 Membership.role(MEMBER)에서 파생 — 권한 상승 방지
    assert data["user"]["role"] == "user"
    assert data["token"]


async def test_switch_tenant_rejects_inactive_target_tenant(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        admin = (await s.execute(select(User).where(User.userid == "admin"))).scalars().first()
        other = Tenant(name="비활성", subdomain="inactive", orgType="CHURCH", isActive=False)
        s.add(other)
        await s.flush()
        s.add(Membership(userId=admin.id, tenantId=other.id, role="TENANT_ADMIN"))
        await s.commit()
        other_id = other.id

    headers = await _login(client)
    r = await client.post(
        "/api/auth/switch-tenant", json={"tenantId": other_id}, headers=headers
    )
    assert r.status_code == 403


# ── accept-invitation ──────────────────────────────────────────────────
async def _seed_invitation(
    maker, *, role: str = "MEMBER", expired: bool = False, accepted: bool = False
) -> str:
    async with maker() as s:
        tenant = (await s.execute(select(Tenant))).scalars().first()
        expires = datetime.now(timezone.utc) + timedelta(days=-1 if expired else 7)
        inv = Invitation(
            tenantId=tenant.id,
            role=role,
            token="invite-token-123",
            expiresAt=expires,
            acceptedAt=datetime.now(timezone.utc) if accepted else None,
        )
        s.add(inv)
        await s.commit()
        return inv.token


async def test_accept_invitation_requires_token(client: AsyncClient):
    r = await client.post("/api/auth/accept-invitation", json={})
    assert r.status_code == 400


async def test_accept_invitation_rejects_unknown_token(client: AsyncClient):
    r = await client.post(
        "/api/auth/accept-invitation",
        json={"inviteToken": "nope", "userid": "u1", "username": "유저", "password": "pass1234"},
    )
    assert r.status_code == 404


async def test_accept_invitation_rejects_expired(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    token = await _seed_invitation(maker, expired=True)
    r = await client.post(
        "/api/auth/accept-invitation",
        json={
            "inviteToken": token, "userid": "u1", "username": "유저", "password": "pass1234",
        },
    )
    assert r.status_code == 410


async def test_accept_invitation_rejects_already_accepted(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    token = await _seed_invitation(maker, accepted=True)
    r = await client.post(
        "/api/auth/accept-invitation",
        json={
            "inviteToken": token, "userid": "u1", "username": "유저", "password": "pass1234",
        },
    )
    assert r.status_code == 409


async def test_accept_invitation_rejects_kakao_path_when_unconfigured(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    token = await _seed_invitation(maker)
    r = await client.post(
        "/api/auth/accept-invitation",
        json={"inviteToken": token, "kakaoAccessToken": "abc"},
    )
    assert r.status_code == 503


async def test_accept_invitation_success_creates_membership_and_session(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    token = await _seed_invitation(maker, role="TENANT_ADMIN")

    r = await client.post(
        "/api/auth/accept-invitation",
        json={
            "inviteToken": token, "userid": "newmember", "username": "새멤버",
            "password": "pass1234",
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["user"]["userid"] == "newmember"
    # Membership.role=TENANT_ADMIN → 인가 역할 코드 admin 파생
    assert data["user"]["role"] == "admin"
    assert data["tenant"]["subdomain"] == "demo"
    assert "orgType" not in data["tenant"]
    assert data["token"]

    async with maker() as s:
        user = (
            await s.execute(select(User).where(User.userid == "newmember"))
        ).scalars().first()
        assert user is not None
        membership = (
            await s.execute(select(Membership).where(Membership.userId == user.id))
        ).scalars().first()
        assert membership is not None
        assert membership.isDefault is True
        auth_account = (
            await s.execute(
                select(AuthAccount).where(AuthAccount.providerUserId == "newmember")
            )
        ).scalars().first()
        assert auth_account is not None
        assert auth_account.provider == "email"
        invitation = (
            await s.execute(select(Invitation).where(Invitation.token == token))
        ).scalars().first()
        assert invitation.acceptedAt is not None


async def test_accept_invitation_rejects_duplicate_userid_in_tenant(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    token = await _seed_invitation(maker)
    r = await client.post(
        "/api/auth/accept-invitation",
        json={
            "inviteToken": token, "userid": "admin", "username": "관리자2",
            "password": "pass1234",
        },
    )
    assert r.status_code == 409
