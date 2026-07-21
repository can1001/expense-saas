"""FCM 라우트 계약 테스트 — fcm-subscribe/fcm-test. (app/api/push/fcm-*, N2 컷오버)

lib/services/notification/fcm-provider.ts + app/api/push/fcm-*/route.ts 의 응답 형태를
검증한다. firebase-admin 실호출은 push_provider 를 monkeypatch 해 대체한다.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.notification import FcmLog, FcmToken
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from expense_api.core.service import push_provider
from main import app

VALID_TOKEN = "a" * 40
OTHER_TOKEN = "b" * 40


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
                userid="user1",
                username="사용자1",
                password=hash_password("pass1234"),
                role="user",
            )
        )
        s.add(
            User(
                tenantId=t.id,
                userid="user2",
                username="사용자2",
                password=hash_password("pass1234"),
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


async def _login(client: AsyncClient, userid: str = "user1") -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": "pass1234"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ── fcm-subscribe ────────────────────────────────────────────────────


async def test_fcm_subscribe_creates_token(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/push/fcm-subscribe",
        headers=headers,
        json={"token": VALID_TOKEN, "platform": "android", "deviceModel": "Pixel 8", "appVersion": "1.0.0"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "tokenId" in body

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        tok = (await s.execute(select(FcmToken).where(FcmToken.token == VALID_TOKEN))).scalars().first()
        assert tok is not None
        assert tok.platform == "android"
        assert tok.deviceModel == "Pixel 8"
        assert tok.isActive is True


async def test_fcm_subscribe_invalid_token_returns_400(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/push/fcm-subscribe",
        headers=headers,
        json={"token": "short", "platform": "android"},
    )
    assert r.status_code == 400
    assert "유효하지 않은 FCM 토큰" in r.json()["detail"]


async def test_fcm_subscribe_invalid_platform_returns_400(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/push/fcm-subscribe",
        headers=headers,
        json={"token": VALID_TOKEN, "platform": "windows"},
    )
    assert r.status_code == 400
    assert "android" in r.json()["detail"]


async def test_fcm_subscribe_resubscribe_same_token_updates_existing(client: AsyncClient):
    headers = await _login(client)
    r1 = await client.post(
        "/api/push/fcm-subscribe",
        headers=headers,
        json={"token": VALID_TOKEN, "platform": "android"},
    )
    first_id = r1.json()["tokenId"]

    r2 = await client.post(
        "/api/push/fcm-subscribe",
        headers=headers,
        json={"token": VALID_TOKEN, "platform": "ios", "appVersion": "2.0.0"},
    )
    assert r2.json()["tokenId"] == first_id

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        rows = (await s.execute(select(FcmToken).where(FcmToken.token == VALID_TOKEN))).scalars().all()
        assert len(rows) == 1
        assert rows[0].platform == "ios"
        assert rows[0].appVersion == "2.0.0"


async def test_fcm_subscribe_token_owned_by_other_user_returns_500(client: AsyncClient):
    headers1 = await _login(client, "user1")
    await client.post(
        "/api/push/fcm-subscribe",
        headers=headers1,
        json={"token": VALID_TOKEN, "platform": "android"},
    )

    headers2 = await _login(client, "user2")
    r = await client.post(
        "/api/push/fcm-subscribe",
        headers=headers2,
        json={"token": VALID_TOKEN, "platform": "android"},
    )
    assert r.status_code == 500


async def test_fcm_unsubscribe_removes_token(client: AsyncClient):
    headers = await _login(client)
    await client.post(
        "/api/push/fcm-subscribe",
        headers=headers,
        json={"token": VALID_TOKEN, "platform": "android"},
    )

    r = await client.request("DELETE", "/api/push/fcm-subscribe", headers=headers, json={"token": VALID_TOKEN})
    assert r.status_code == 200
    assert r.json() == {"success": True}

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        rows = (await s.execute(select(FcmToken).where(FcmToken.token == VALID_TOKEN))).scalars().all()
        assert rows == []


async def test_fcm_unsubscribe_invalid_body_returns_400(client: AsyncClient):
    headers = await _login(client)
    r = await client.request("DELETE", "/api/push/fcm-subscribe", headers=headers, json={})
    assert r.status_code == 400


# ── fcm-test ─────────────────────────────────────────────────────────


async def test_fcm_test_unconfigured_returns_503(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(push_provider, "is_fcm_configured", lambda: False)
    headers = await _login(client)
    r = await client.post("/api/push/fcm-test", headers=headers)
    assert r.status_code == 503


async def test_fcm_test_no_token_returns_404_with_code(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(push_provider, "is_fcm_configured", lambda: True)
    headers = await _login(client)
    r = await client.post("/api/push/fcm-test", headers=headers)
    assert r.status_code == 404
    assert r.json()["code"] == "NO_FCM_TOKEN"


async def test_fcm_test_success_sends_and_logs(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(push_provider, "is_fcm_configured", lambda: True)

    async def _fake_send(token, title, body, data):
        return None

    monkeypatch.setattr(push_provider, "send_fcm", _fake_send)

    headers = await _login(client)
    await client.post(
        "/api/push/fcm-subscribe",
        headers=headers,
        json={"token": VALID_TOKEN, "platform": "android"},
    )

    r = await client.post("/api/push/fcm-test", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "성공: 1" in body["message"]

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        log = (await s.execute(select(FcmLog).where(FcmLog.status == "SENT"))).scalars().first()
        assert log is not None
        assert log.title == "테스트 알림 (앱)"


async def test_fcm_test_invalid_token_deactivates_and_returns_500(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(push_provider, "is_fcm_configured", lambda: True)

    async def _fake_send(token, title, body, data):
        raise push_provider.FcmSendError("등록되지 않은 토큰", invalid_token=True)

    monkeypatch.setattr(push_provider, "send_fcm", _fake_send)

    headers = await _login(client)
    await client.post(
        "/api/push/fcm-subscribe",
        headers=headers,
        json={"token": VALID_TOKEN, "platform": "android"},
    )

    r = await client.post("/api/push/fcm-test", headers=headers)
    assert r.status_code == 500
    assert r.json()["details"] == ["등록되지 않은 토큰"]

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        tok = (await s.execute(select(FcmToken).where(FcmToken.token == VALID_TOKEN))).scalars().first()
        assert tok.isActive is False
