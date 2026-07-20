"""자동이체·시스템 설정 라우트 계약 테스트 (B6).

레거시 app/api/recurring-expenses*/route.ts, app/api/settings/route.ts 와의
계약 정합(응답 키·상태코드·권한/소유권 분기)을 검증한다.
"""

from datetime import datetime, timedelta, timezone

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.models.recurring_expense import RecurringExpense
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import Role, User
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from expense_api.core.routes import recurring_routes
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
                userid="plain",
                username="일반사용자",
                password=hash_password("pass1234"),
                role="team_leader",  # RECURRING_READ 없는 프리셋 — 접근 자체가 막히는 케이스
            )
        )
        # "user" 역할에 RECURRING_READ 만 부여(MANAGE_ALL 없음) — 본인 소유 스코프 테스트용
        s.add(
            Role(
                tenantId=t.id,
                code="user",
                name="사용자",
                permissions=[PERMISSIONS.RECURRING_READ],
            )
        )
        s.add(
            User(
                tenantId=t.id,
                userid="owner",
                username="소유자",
                password=hash_password("pass1234"),
                role="user",
            )
        )
        s.add(
            User(
                tenantId=t.id,
                userid="other",
                username="다른사용자",
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


async def _login(client: AsyncClient, userid: str = "admin", password: str = "admin123") -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _recurring_body(**overrides) -> dict:
    body = {
        "name": "월세",
        "committee": "기획위원회",
        "department": "재정팀",
        "budgetCategory": "사무행정비",
        "budgetSubcategory": "임차료",
        "budgetDetail": "사무실 월세",
        "recipientName": "홍길동",
        "bankName": "국민은행",
        "accountNumber": "123-456-789",
        "baseAmount": 500000,
        "frequency": "MONTHLY",
        "dayOfMonth": 25,
        "startDate": "2026-01-01T00:00:00Z",
        "advanceDays": 7,
    }
    body.update(overrides)
    return body


# ── recurring-expenses ──────────────────────────────────────────────
async def test_create_and_list_recurring_expenses(client: AsyncClient):
    headers = await _login(client)

    r = await client.post(
        "/api/recurring-expenses", json=_recurring_body(), headers=headers
    )
    assert r.status_code == 201
    created = r.json()
    assert created["name"] == "월세"
    assert created["status"] == "ACTIVE"
    assert created["nextGenerationDate"] is not None

    r2 = await client.get("/api/recurring-expenses", headers=headers)
    assert r2.status_code == 200
    body = r2.json()
    assert body["hasMore"] is False
    assert len(body["recurringExpenses"]) == 1
    assert body["recurringExpenses"][0]["id"] == created["id"]
    assert body["recurringExpenses"][0]["user"]["username"] == "관리자"


async def test_recurring_access_forbidden_without_permission(client: AsyncClient):
    headers = await _login(client, userid="plain", password="pass1234")

    r = await client.get("/api/recurring-expenses", headers=headers)
    assert r.status_code == 403
    assert "자동이체 접근 권한" in r.json()["detail"]

    r2 = await client.post(
        "/api/recurring-expenses", json=_recurring_body(), headers=headers
    )
    assert r2.status_code == 403


async def test_get_update_delete_recurring_expense(client: AsyncClient):
    headers = await _login(client)
    created = (
        await client.post("/api/recurring-expenses", json=_recurring_body(), headers=headers)
    ).json()

    r = await client.get(f"/api/recurring-expenses/{created['id']}", headers=headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["generatedExpenses"] == []
    assert detail["user"]["id"] == detail["userId"]

    r2 = await client.put(
        f"/api/recurring-expenses/{created['id']}",
        json={"name": "월세(수정)", "dayOfMonth": 10},
        headers=headers,
    )
    assert r2.status_code == 200
    updated = r2.json()
    assert updated["name"] == "월세(수정)"
    assert updated["dayOfMonth"] == 10
    # dayOfMonth 변경 → nextGenerationDate 재계산되어 원래 값과 달라짐
    assert updated["nextGenerationDate"] != created["nextGenerationDate"]

    r3 = await client.delete(f"/api/recurring-expenses/{created['id']}", headers=headers)
    assert r3.status_code == 200
    assert "취소" in r3.json()["message"]

    r4 = await client.delete(f"/api/recurring-expenses/{created['id']}", headers=headers)
    assert r4.status_code == 400
    assert "이미 취소된" in r4.json()["detail"]

    r5 = await client.put(
        f"/api/recurring-expenses/{created['id']}", json={"name": "재수정"}, headers=headers
    )
    assert r5.status_code == 400
    assert "취소되거나 완료된" in r5.json()["detail"]


async def test_recurring_expense_not_found(client: AsyncClient):
    headers = await _login(client)
    r = await client.get(
        "/api/recurring-expenses/nonexistent1234567890", headers=headers
    )
    assert r.status_code == 404


async def test_ownership_scoping_between_users(client: AsyncClient):
    owner_headers = await _login(client, userid="owner", password="pass1234")
    other_headers = await _login(client, userid="other", password="pass1234")

    created = (
        await client.post(
            "/api/recurring-expenses", json=_recurring_body(), headers=owner_headers
        )
    ).json()

    # 소유자 아닌 사용자는 목록에서 보이지 않고, 상세 조회는 403
    r = await client.get("/api/recurring-expenses", headers=other_headers)
    assert r.status_code == 200
    assert r.json()["recurringExpenses"] == []

    r2 = await client.get(f"/api/recurring-expenses/{created['id']}", headers=other_headers)
    assert r2.status_code == 403

    r3 = await client.put(
        f"/api/recurring-expenses/{created['id']}",
        json={"name": "x"},
        headers=other_headers,
    )
    assert r3.status_code == 403

    r4 = await client.delete(
        f"/api/recurring-expenses/{created['id']}", headers=other_headers
    )
    assert r4.status_code == 403

    # 소유자 본인은 정상 조회 가능
    r5 = await client.get(f"/api/recurring-expenses/{created['id']}", headers=owner_headers)
    assert r5.status_code == 200


async def test_generate_recurring_expense_creates_expense_once_per_month(
    client: AsyncClient,
):
    headers = await _login(client)
    created = (
        await client.post("/api/recurring-expenses", json=_recurring_body(), headers=headers)
    ).json()

    r = await client.post(
        f"/api/recurring-expenses/{created['id']}/generate", headers=headers
    )
    assert r.status_code == 201
    expense_id = r.json()["expenseId"]
    assert expense_id

    detail = (
        await client.get(f"/api/recurring-expenses/{created['id']}", headers=headers)
    ).json()
    assert len(detail["generatedExpenses"]) == 1
    assert detail["generatedExpenses"][0]["id"] == expense_id
    assert detail["generatedExpenses"][0]["accountHolder"] == "홍길동"

    # 같은 달 재생성 시도는 실패
    r2 = await client.post(
        f"/api/recurring-expenses/{created['id']}/generate", headers=headers
    )
    assert r2.status_code == 400
    assert "이미 생성된" in r2.json()["detail"]


async def test_process_recurring_expenses_cron_endpoint(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(recurring_routes.settings, "CRON_SECRET", None)
    headers = await _login(client)
    created = (
        await client.post("/api/recurring-expenses", json=_recurring_body(), headers=headers)
    ).json()

    # nextGenerationDate 를 과거로 직접 조정 (API 로는 항상 미래로 계산됨)
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = await s.get(RecurringExpense, created["id"])
        row.nextGenerationDate = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
        s.add(row)
        await s.commit()

    r = await client.post("/api/recurring-expenses/process")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["result"]["generated"] == 1

    async with maker() as s:
        row = await s.get(RecurringExpense, created["id"])
        assert row.lastGeneratedDate is not None


async def test_process_recurring_expenses_requires_secret_when_configured(
    client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(recurring_routes.settings, "CRON_SECRET", "cron-secret-value")

    r = await client.post("/api/recurring-expenses/process")
    assert r.status_code == 401

    r2 = await client.post(
        "/api/recurring-expenses/process",
        headers={"Authorization": "Bearer cron-secret-value"},
    )
    assert r2.status_code == 200


# ── settings ─────────────────────────────────────────────────────────
async def test_settings_missing_key_returns_null(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/settings?key=paymentSignatureRequired", headers=headers)
    assert r.status_code == 200
    assert r.json() == {"key": "paymentSignatureRequired", "value": None}


async def test_settings_put_then_get_single_key(client: AsyncClient):
    headers = await _login(client)
    r = await client.put(
        "/api/settings",
        json={"key": "paymentSignatureRequired", "value": True, "description": "지급 서명 필수"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["setting"]["value"] is True

    r2 = await client.get("/api/settings?key=paymentSignatureRequired", headers=headers)
    assert r2.status_code == 200
    assert r2.json() == {
        "key": "paymentSignatureRequired",
        "value": True,
        "description": "지급 서명 필수",
    }


async def test_settings_get_multiple_and_all(client: AsyncClient):
    headers = await _login(client)
    await client.put(
        "/api/settings", json={"key": "a", "value": 1}, headers=headers
    )
    await client.put(
        "/api/settings", json={"key": "b", "value": "two"}, headers=headers
    )

    r = await client.get("/api/settings?keys=a,b,missing", headers=headers)
    assert r.status_code == 200
    assert r.json() == {"a": 1, "b": "two", "missing": None}

    r2 = await client.get("/api/settings", headers=headers)
    assert r2.status_code == 200
    body = r2.json()
    assert body["a"]["value"] == 1
    assert body["b"]["value"] == "two"


async def test_settings_put_requires_key(client: AsyncClient):
    headers = await _login(client)
    r = await client.put("/api/settings", json={"value": 1}, headers=headers)
    assert r.status_code == 400
    assert "설정 키가 필요합니다" in r.json()["detail"]


async def test_settings_put_forbidden_without_permission(client: AsyncClient):
    headers = await _login(client, userid="plain", password="pass1234")
    r = await client.put(
        "/api/settings", json={"key": "a", "value": 1}, headers=headers
    )
    assert r.status_code == 403
