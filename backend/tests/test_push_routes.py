"""웹 푸시 라우트 계약 테스트 — vapid-public-key/subscribe/unsubscribe/history.
(app/api/push/* 컷오버, N1)

lib/services/notification/web-push-provider.ts + app/api/push/*/route.ts 의 응답 형태를
검증한다.
"""

from datetime import datetime

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.config.settings import settings
from expense_api.core.db.session import get_session
from expense_api.core.models.expense import Expense
from expense_api.core.models.notification import PushSubscription, WebPushLog
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
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
                userid="user1",
                username="사용자1",
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


async def _login(client: AsyncClient) -> dict:
    r = await client.post("/api/auth/login", json={"userid": "user1", "password": "pass1234"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ── vapid-public-key ─────────────────────────────────────────────────


async def test_vapid_public_key_returns_configured_key(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "test-public-key")
    r = await client.get("/api/push/vapid-public-key")
    assert r.status_code == 200
    assert r.json() == {"publicKey": "test-public-key"}


async def test_vapid_public_key_unconfigured_returns_503(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", None)
    r = await client.get("/api/push/vapid-public-key")
    assert r.status_code == 503


# ── subscribe ─────────────────────────────────────────────────────────


async def test_subscribe_creates_subscription(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/push/subscribe",
        headers=headers,
        json={
            "subscription": {
                "endpoint": "https://push.example.com/abc",
                "keys": {"p256dh": "pkey", "auth": "akey"},
            },
            "deviceName": "내 아이폰",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "subscriptionId" in body

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        sub = (
            await s.execute(
                select(PushSubscription).where(PushSubscription.endpoint == "https://push.example.com/abc")
            )
        ).scalars().first()
        assert sub is not None
        assert sub.p256dh == "pkey"
        assert sub.auth == "akey"
        assert sub.deviceName == "내 아이폰"
        assert sub.isActive is True


async def test_subscribe_resubscribe_same_endpoint_updates_existing(client: AsyncClient):
    headers = await _login(client)
    payload = {
        "subscription": {
            "endpoint": "https://push.example.com/same",
            "keys": {"p256dh": "pkey1", "auth": "akey1"},
        }
    }
    r1 = await client.post("/api/push/subscribe", headers=headers, json=payload)
    first_id = r1.json()["subscriptionId"]

    payload["subscription"]["keys"] = {"p256dh": "pkey2", "auth": "akey2"}
    r2 = await client.post("/api/push/subscribe", headers=headers, json=payload)
    assert r2.json()["subscriptionId"] == first_id

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        rows = (
            await s.execute(
                select(PushSubscription).where(PushSubscription.endpoint == "https://push.example.com/same")
            )
        ).scalars().all()
        assert len(rows) == 1
        assert rows[0].p256dh == "pkey2"


async def test_subscribe_invalid_payload_returns_400(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/push/subscribe",
        headers=headers,
        json={"subscription": {"endpoint": "https://push.example.com/x", "keys": {"p256dh": "only"}}},
    )
    assert r.status_code == 400
    assert "유효하지 않은 구독 정보" in r.json()["detail"]


# ── unsubscribe ───────────────────────────────────────────────────────


async def test_unsubscribe_by_endpoint_removes_row(client: AsyncClient):
    headers = await _login(client)
    await client.post(
        "/api/push/subscribe",
        headers=headers,
        json={
            "subscription": {
                "endpoint": "https://push.example.com/rm",
                "keys": {"p256dh": "p", "auth": "a"},
            }
        },
    )
    r = await client.post("/api/push/unsubscribe", headers=headers, json={"endpoint": "https://push.example.com/rm"})
    assert r.status_code == 200
    assert r.json() == {"success": True, "message": "구독이 해제되었습니다."}

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        rows = (
            await s.execute(
                select(PushSubscription).where(PushSubscription.endpoint == "https://push.example.com/rm")
            )
        ).scalars().all()
        assert rows == []


async def test_unsubscribe_all_removes_every_subscription(client: AsyncClient):
    headers = await _login(client)
    for i in range(2):
        await client.post(
            "/api/push/subscribe",
            headers=headers,
            json={
                "subscription": {
                    "endpoint": f"https://push.example.com/all-{i}",
                    "keys": {"p256dh": "p", "auth": "a"},
                }
            },
        )
    r = await client.post("/api/push/unsubscribe", headers=headers, json={"all": True})
    assert r.status_code == 200
    assert r.json() == {"success": True, "message": "모든 구독이 해제되었습니다."}

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        rows = (await s.execute(select(PushSubscription))).scalars().all()
        assert rows == []


async def test_unsubscribe_without_endpoint_or_all_returns_400(client: AsyncClient):
    headers = await _login(client)
    r = await client.post("/api/push/unsubscribe", headers=headers, json={})
    assert r.status_code == 400
    assert "endpoint가 필요합니다" in r.json()["detail"]


# ── history ───────────────────────────────────────────────────────────


async def test_history_lists_logs_with_expense_join_and_pagination(client: AsyncClient):
    headers = await _login(client)
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        tid = (await s.execute(select(Tenant.id))).scalar_one()
        uid = (await s.execute(select(User.id).where(User.userid == "user1"))).scalar_one()

        expense = Expense(
            tenantId=tid, userId=uid, committee="위원회", department="부서",
            requestAmount=10000, requestDate=datetime(2026, 7, 1),
            applicantName="사용자1", bankName="국민", accountNumber="1234", accountHolder="사용자1",
        )
        s.add(expense)
        await s.flush()

        s.add_all(
            [
                WebPushLog(
                    tenantId=tid, userId=uid, expenseId=expense.id, eventType="SUBMIT",
                    title="결재요청", body="지출결의서가 제출되었습니다.", status="SENT",
                ),
                WebPushLog(
                    tenantId=tid, userId=uid, eventType="APPROVE",
                    title="승인", body="승인되었습니다.", status="FAILED", errorMessage="구독 없음",
                ),
            ]
        )
        await s.commit()

    r = await client.get("/api/push/history", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    assert body["page"] == 1
    assert body["limit"] == 20
    assert body["totalPages"] == 1
    assert len(body["data"]) == 2

    with_expense = next(row for row in body["data"] if row["expenseId"] is not None)
    assert with_expense["expense"]["applicantName"] == "사용자1"
    assert with_expense["expense"]["requestAmount"] == 10000

    without_expense = next(row for row in body["data"] if row["expenseId"] is None)
    assert without_expense["expense"] is None
    assert without_expense["errorMessage"] == "구독 없음"

    r_filtered = await client.get("/api/push/history", headers=headers, params={"eventType": "SUBMIT"})
    assert r_filtered.json()["total"] == 1

    r_status = await client.get("/api/push/history", headers=headers, params={"status": "FAILED"})
    assert r_status.json()["total"] == 1

    r_page = await client.get("/api/push/history", headers=headers, params={"limit": 1, "page": 2})
    assert r_page.json()["total"] == 2
    assert r_page.json()["totalPages"] == 2
    assert len(r_page.json()["data"]) == 1


async def test_history_only_returns_current_user_logs(client: AsyncClient):
    headers = await _login(client)
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        tid = (await s.execute(select(Tenant.id))).scalar_one()
        other = User(tenantId=tid, userid="user2", username="사용자2", password=hash_password("pass1234"), role="user")
        s.add(other)
        await s.flush()
        s.add(
            WebPushLog(
                tenantId=tid, userId=other.id, eventType="SUBMIT", title="타인 알림", body="본문", status="SENT",
            )
        )
        await s.commit()

    r = await client.get("/api/push/history", headers=headers)
    assert r.json()["total"] == 0
