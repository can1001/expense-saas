"""admin 알림 관리 라우트 계약 테스트. (app/api/admin/notifications 컷오버 — D6)"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.notification import PushSubscription
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
        t2 = Tenant(name="다른테넌트", subdomain="other")
        s.add_all([t, t2])
        await s.flush()
        admin = User(
            tenantId=t.id,
            userid="admin",
            username="관리자",
            password=hash_password("admin123"),
            role="admin",
        )
        subscribed_user = User(
            tenantId=t.id,
            userid="user1",
            username="사용자1",
            password=hash_password("user123"),
            role="user",
        )
        unsubscribed_user = User(
            tenantId=t.id,
            userid="user2",
            username="사용자2",
            password=hash_password("user123"),
            role="user",
        )
        other_tenant_user = User(
            tenantId=t2.id,
            userid="user3",
            username="다른테넌트사용자",
            password=hash_password("user123"),
            role="user",
        )
        s.add_all([admin, subscribed_user, unsubscribed_user, other_tenant_user])
        await s.flush()
        s.add(
            PushSubscription(
                tenantId=t.id,
                userId=subscribed_user.id,
                endpoint="https://push.example.com/1",
                p256dh="p256dh-key",
                auth="auth-key",
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


async def test_send_notification_to_all_partial_success(client: AsyncClient):
    headers = await _login(client)

    r = await client.post(
        "/api/admin/notifications",
        json={"title": "공지", "message": "점검 안내", "targetType": "ALL"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    # admin + 구독자 + 미구독자 = 3명 대상, 구독 보유자만 발송 성공
    assert body["summary"]["targetCount"] == 3
    assert body["summary"]["sentCount"] == 1
    assert body["summary"]["failedCount"] == 0
    assert body["notification"]["status"] == "SENT"
    assert body["notification"]["targetValue"] is None

    r = await client.get("/api/admin/notifications", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["pagination"]["total"] == 1
    assert data["notifications"][0]["title"] == "공지"


async def test_send_notification_to_role_no_subscribers_fails(client: AsyncClient):
    headers = await _login(client)

    r = await client.post(
        "/api/admin/notifications",
        json={"title": "공지", "message": "점검 안내", "targetType": "ROLE", "targetValue": "admin"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    # admin 역할 사용자(admin 본인)는 구독 없음 → 발송 실패
    assert body["summary"]["targetCount"] == 1
    assert body["summary"]["sentCount"] == 0
    assert body["notification"]["status"] == "FAILED"


async def test_send_notification_to_user_cross_tenant_not_found(client: AsyncClient):
    headers = await _login(client)

    # 다른 테넌트 사용자를 targetValue 로 지정 — 대상 없음
    r = await client.post(
        "/api/admin/notifications",
        json={"title": "공지", "message": "안내", "targetType": "USER", "targetValue": "no-such-id"},
        headers=headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "발송 대상 사용자가 없습니다."


async def test_send_notification_validation_errors(client: AsyncClient):
    headers = await _login(client)

    r = await client.post("/api/admin/notifications", json={"title": "공지"}, headers=headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "제목, 메시지, 대상 타입은 필수입니다."

    r = await client.post(
        "/api/admin/notifications",
        json={"title": "공지", "message": "안내", "targetType": "INVALID"},
        headers=headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "유효하지 않은 대상 타입입니다."

    r = await client.post(
        "/api/admin/notifications",
        json={"title": "공지", "message": "안내", "targetType": "ROLE"},
        headers=headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "대상 값이 필요합니다."


async def test_send_notification_requires_permission(client: AsyncClient):
    # user 역할은 NOTIFICATION_SEND 권한이 없음(기본 프리셋)
    headers = await _login(client, userid="user1", password="user123")
    r = await client.post(
        "/api/admin/notifications",
        json={"title": "공지", "message": "안내", "targetType": "ALL"},
        headers=headers,
    )
    assert r.status_code == 403
