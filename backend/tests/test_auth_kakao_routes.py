"""카카오 로그인/계정 연결 라우트 계약 테스트 (app/api/auth/kakao, link-kakao 컷오버, A6).

kapi.kakao.com 실호출 없이 kakao_service.verify_kakao_access_token 을 monkeypatch 로 대체한다.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import AuthAccount, Membership, User
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from expense_api.core.service import kakao_service
from main import app


@pytest_asyncio.fixture
async def client(monkeypatch):
    monkeypatch.setattr(kakao_service, "is_kakao_configured", lambda: True)
    monkeypatch.setattr(kakao_service, "is_kakao_oidc_enabled", lambda: False)

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


def _mock_verify(monkeypatch, provider_user_id: str = "kakao-1"):
    async def _verify(_token: str) -> str:
        return provider_user_id

    monkeypatch.setattr(kakao_service, "verify_kakao_access_token", _verify)


async def _link_kakao(maker, userid: str, provider_user_id: str = "kakao-1") -> None:
    async with maker() as s:
        user = (await s.execute(select(User).where(User.userid == userid))).scalars().first()
        s.add(AuthAccount(userId=user.id, provider="kakao", providerUserId=provider_user_id))
        await s.commit()


# ── POST /api/auth/kakao — 설정/검증 ───────────────────────────────────
async def test_kakao_login_rejects_when_unconfigured(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(kakao_service, "is_kakao_configured", lambda: False)
    r = await client.post("/api/auth/kakao", json={"kakaoAccessToken": "token"})
    assert r.status_code == 503
    assert r.json()["detail"] == "카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요."


async def test_kakao_login_rejects_when_oidc_enabled(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(kakao_service, "is_kakao_oidc_enabled", lambda: True)
    r = await client.post("/api/auth/kakao", json={"idToken": "oidc-id-token"})
    assert r.status_code == 503


async def test_kakao_login_requires_token(client: AsyncClient):
    r = await client.post("/api/auth/kakao", json={})
    assert r.status_code == 400
    assert r.json()["detail"] == "카카오 토큰을 입력해주세요."


async def test_kakao_login_rejects_failed_verification(client: AsyncClient, monkeypatch):
    async def _fail(_token: str) -> str:
        raise kakao_service.KakaoTokenError("카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.")

    monkeypatch.setattr(kakao_service, "verify_kakao_access_token", _fail)

    r = await client.post("/api/auth/kakao", json={"kakaoAccessToken": "expired"})
    assert r.status_code == 401
    assert "set-cookie" not in r.headers


# ── POST /api/auth/kakao — 계정 연결 ───────────────────────────────────
async def test_kakao_login_unlinked_returns_no_session(client: AsyncClient, monkeypatch):
    _mock_verify(monkeypatch)

    r = await client.post("/api/auth/kakao", json={"kakaoAccessToken": "valid"})
    data = r.json()
    assert r.status_code == 200
    assert data == {
        "success": True,
        "linked": False,
        "message": "연결된 계정이 없습니다. 초대를 받은 후 이용할 수 있습니다.",
    }
    assert "set-cookie" not in r.headers


async def test_kakao_login_rejects_inactive_user(client: AsyncClient, monkeypatch):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        admin = (await s.execute(select(User).where(User.userid == "admin"))).scalars().first()
        admin.isActive = False
        s.add(admin)
        await s.commit()
    await _link_kakao(maker, "admin")
    _mock_verify(monkeypatch)

    r = await client.post("/api/auth/kakao", json={"kakaoAccessToken": "valid"})
    assert r.status_code == 403
    assert r.json()["detail"] == "계정이 비활성화되어 있습니다. 관리자에게 문의하세요."


async def test_kakao_login_rejects_inactive_tenant(client: AsyncClient, monkeypatch):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        tenant = (await s.execute(select(Tenant).where(Tenant.subdomain == "demo"))).scalars().first()
        tenant.isActive = False
        s.add(tenant)
        await s.commit()
    await _link_kakao(maker, "admin")
    _mock_verify(monkeypatch)

    r = await client.post("/api/auth/kakao", json={"kakaoAccessToken": "valid"})
    assert r.status_code == 403
    assert r.json()["detail"] == "이 조직은 현재 이용할 수 없습니다."


# ── POST /api/auth/kakao — 소속 결정 ───────────────────────────────────
async def test_kakao_login_zero_memberships_falls_back_to_home_tenant(
    client: AsyncClient, monkeypatch
):
    maker = client._maker  # type: ignore[attr-defined]
    await _link_kakao(maker, "admin")
    _mock_verify(monkeypatch)

    r = await client.post("/api/auth/kakao", json={"kakaoAccessToken": "valid"})
    data = r.json()
    assert r.status_code == 200
    assert data["linked"] is True
    assert data["tenant"]["subdomain"] == "demo"
    assert data["token"]
    assert "user_token=" in r.headers["set-cookie"]


async def test_kakao_login_single_membership_issues_session(client: AsyncClient, monkeypatch):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        admin = (await s.execute(select(User).where(User.userid == "admin"))).scalars().first()
        other = Tenant(name="소망교회", subdomain="somang", orgType="CHURCH")
        s.add(other)
        await s.flush()
        s.add(Membership(userId=admin.id, tenantId=other.id, role="MEMBER"))
        await s.commit()
    await _link_kakao(maker, "admin")
    _mock_verify(monkeypatch)

    r = await client.post("/api/auth/kakao", json={"kakaoAccessToken": "valid"})
    data = r.json()
    assert r.status_code == 200
    assert data["tenant"]["subdomain"] == "somang"
    # 게스트 소속은 홈의 admin 권한이 아니라 Membership.role(MEMBER)에서 파생
    assert data["user"]["role"] == "user"


async def test_kakao_login_multiple_memberships_requires_selection(
    client: AsyncClient, monkeypatch
):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        admin = (await s.execute(select(User).where(User.userid == "admin"))).scalars().first()
        other = Tenant(name="소망교회", subdomain="somang", orgType="CHURCH")
        s.add(other)
        await s.flush()
        s.add(Membership(userId=admin.id, tenantId=other.id, role="MEMBER"))
        # 홈 테넌트도 Membership 으로 잡혀야 복수 소속(2건)이 된다
        home = (await s.execute(select(Tenant).where(Tenant.subdomain == "demo"))).scalars().first()
        s.add(Membership(userId=admin.id, tenantId=home.id, role="TENANT_ADMIN", isDefault=True))
        await s.commit()
    await _link_kakao(maker, "admin")
    _mock_verify(monkeypatch)

    r = await client.post("/api/auth/kakao", json={"kakaoAccessToken": "valid"})
    data = r.json()
    assert r.status_code == 200
    assert data["requiresTenantSelection"] is True
    assert data["linked"] is True
    assert {m["tenantId"] for m in data["memberships"]} == {
        (await _tenant_id(maker, "demo")),
        (await _tenant_id(maker, "somang")),
    }
    assert data["token"]
    assert "user" not in data


async def _tenant_id(maker, subdomain: str) -> str:
    async with maker() as s:
        tenant = (await s.execute(select(Tenant).where(Tenant.subdomain == subdomain))).scalars().first()
        return tenant.id


# ── GET /api/auth/link-kakao ───────────────────────────────────────────
async def test_link_kakao_status_requires_auth(client: AsyncClient):
    r = await client.get("/api/auth/link-kakao")
    assert r.status_code in (401, 403)


async def test_link_kakao_status_reports_unlinked(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/auth/link-kakao", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["linked"] is False
    assert data["configured"] is True


async def test_link_kakao_status_reports_linked(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    await _link_kakao(maker, "admin")
    headers = await _login(client)
    r = await client.get("/api/auth/link-kakao", headers=headers)
    assert r.json()["linked"] is True


# ── POST /api/auth/link-kakao ──────────────────────────────────────────
async def test_link_kakao_requires_auth(client: AsyncClient):
    r = await client.post("/api/auth/link-kakao", json={"kakaoAccessToken": "valid"})
    assert r.status_code in (401, 403)


async def test_link_kakao_rejects_when_unconfigured(client: AsyncClient, monkeypatch):
    headers = await _login(client)
    monkeypatch.setattr(kakao_service, "is_kakao_configured", lambda: False)
    r = await client.post(
        "/api/auth/link-kakao", json={"kakaoAccessToken": "valid"}, headers=headers
    )
    assert r.status_code == 503


async def test_link_kakao_requires_token(client: AsyncClient):
    headers = await _login(client)
    r = await client.post("/api/auth/link-kakao", json={}, headers=headers)
    assert r.status_code == 400


async def test_link_kakao_success_creates_auth_account(client: AsyncClient, monkeypatch):
    headers = await _login(client)
    _mock_verify(monkeypatch)

    r = await client.post(
        "/api/auth/link-kakao", json={"kakaoAccessToken": "valid"}, headers=headers
    )
    assert r.status_code == 200
    assert r.json()["linked"] is True

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        account = (
            await s.execute(select(AuthAccount).where(AuthAccount.provider == "kakao"))
        ).scalars().first()
        assert account is not None
        assert account.providerUserId == "kakao-1"


async def test_link_kakao_rejects_conflict_with_other_user(client: AsyncClient, monkeypatch):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        other = User(
            tenantId=(
                await s.execute(select(Tenant).where(Tenant.subdomain == "demo"))
            ).scalars().first().id,
            userid="other",
            username="다른유저",
            password=hash_password("pass1234"),
            role="user",
        )
        s.add(other)
        await s.commit()
        s.add(AuthAccount(userId=other.id, provider="kakao", providerUserId="kakao-1"))
        await s.commit()

    headers = await _login(client)
    _mock_verify(monkeypatch)

    r = await client.post(
        "/api/auth/link-kakao", json={"kakaoAccessToken": "valid"}, headers=headers
    )
    assert r.status_code == 409


# ── DELETE /api/auth/link-kakao ────────────────────────────────────────
async def test_unlink_kakao_requires_auth(client: AsyncClient):
    r = await client.delete("/api/auth/link-kakao")
    assert r.status_code in (401, 403)


async def test_unlink_kakao_rejects_when_not_linked(client: AsyncClient):
    headers = await _login(client)
    r = await client.delete("/api/auth/link-kakao", headers=headers)
    assert r.status_code == 404


async def test_unlink_kakao_succeeds_when_password_remains(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    await _link_kakao(maker, "admin")
    headers = await _login(client)

    r = await client.delete("/api/auth/link-kakao", headers=headers)
    assert r.status_code == 200
    assert r.json()["linked"] is False


async def test_unlink_kakao_rejects_last_auth_method(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        admin = (await s.execute(select(User).where(User.userid == "admin"))).scalars().first()
        admin.password = None
        s.add(admin)
        s.add(AuthAccount(userId=admin.id, provider="kakao", providerUserId="kakao-1"))
        await s.commit()

    # 비밀번호가 없어 로그인 불가하므로 이미 발급된 토큰을 재사용할 수 없다 —
    # switch-tenant 등과 동일하게 change-password 로 우회 로그인하지 않고 직접 토큰 생성.
    from expense_api.core.security.jwt import create_access_token

    admin_id = None
    async with maker() as s:
        admin = (await s.execute(select(User).where(User.userid == "admin"))).scalars().first()
        admin_id = admin.id
    token = create_access_token(
        admin_id,
        extra={
            "tenantId": (await _tenant_id(maker, "demo")),
            "userid": "admin",
            "username": "관리자",
            "role": "admin",
            "roles": ["admin"],
            "granted": [],
            "roleId": None,
            "department": None,
        },
    )

    r = await client.delete(
        "/api/auth/link-kakao", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 400
