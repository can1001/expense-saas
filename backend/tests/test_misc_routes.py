"""지출 템플릿·저장된 계좌 라우트 계약 테스트 (B5).

레거시 app/api/expense-templates(*)/route.ts, app/api/bank-accounts(*)/route.ts 와의
계약 정합(응답 키·상태코드·소유자 403/404 구분)을 검증한다.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
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
                userid="admin",
                username="관리자",
                password=hash_password("admin123"),
                role="admin",
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


def _template_body(**overrides) -> dict:
    body = {
        "name": "회의비 템플릿",
        "budgetCategory": "사무행정비",
        "budgetSubcategory": "회의비",
        "budgetDetail": "다과비",
        "description": "기본 적요",
        "defaultAmount": 50000,
    }
    body.update(overrides)
    return body


def _account_body(**overrides) -> dict:
    body = {
        "bankName": "국민은행",
        "accountNumber": "123-456-789",
        "accountHolder": "홍길동",
        "nickname": "개인 급여계좌",
    }
    body.update(overrides)
    return body


# ── expense-templates ────────────────────────────────────────────────
async def test_create_and_list_templates(client: AsyncClient):
    headers = await _login(client)

    r = await client.post("/api/expense-templates", json=_template_body(), headers=headers)
    assert r.status_code == 201
    created = r.json()
    assert created["name"] == "회의비 템플릿"
    assert created["usageCount"] == 0

    r2 = await client.get("/api/expense-templates", headers=headers)
    assert r2.status_code == 200
    body = r2.json()
    assert len(body["templates"]) == 1
    assert body["templates"][0]["id"] == created["id"]


async def test_create_template_max_limit(client: AsyncClient):
    headers = await _login(client)
    for i in range(20):
        r = await client.post(
            "/api/expense-templates", json=_template_body(name=f"템플릿{i}"), headers=headers
        )
        assert r.status_code == 201

    r = await client.post("/api/expense-templates", json=_template_body(), headers=headers)
    assert r.status_code == 400
    assert "20" in r.json()["detail"]


async def test_get_and_update_template(client: AsyncClient):
    headers = await _login(client)
    created = (
        await client.post("/api/expense-templates", json=_template_body(), headers=headers)
    ).json()

    r = await client.get(f"/api/expense-templates/{created['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "회의비 템플릿"

    r2 = await client.put(
        f"/api/expense-templates/{created['id']}",
        json={"name": "수정된 템플릿"},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["name"] == "수정된 템플릿"


async def test_use_template_increments_usage_count(client: AsyncClient):
    headers = await _login(client)
    created = (
        await client.post("/api/expense-templates", json=_template_body(), headers=headers)
    ).json()

    r = await client.post(f"/api/expense-templates/{created['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["usageCount"] == 1


async def test_delete_template(client: AsyncClient):
    headers = await _login(client)
    created = (
        await client.post("/api/expense-templates", json=_template_body(), headers=headers)
    ).json()

    r = await client.delete(f"/api/expense-templates/{created['id']}", headers=headers)
    assert r.status_code == 200
    assert "삭제" in r.json()["message"]

    r2 = await client.get(f"/api/expense-templates/{created['id']}", headers=headers)
    assert r2.status_code == 404


async def test_template_other_user_forbidden(client: AsyncClient):
    admin_headers = await _login(client)
    created = (
        await client.post("/api/expense-templates", json=_template_body(), headers=admin_headers)
    ).json()

    other_headers = await _login(client, userid="other", password="pass1234")
    r = await client.get(f"/api/expense-templates/{created['id']}", headers=other_headers)
    assert r.status_code == 403

    r2 = await client.put(
        f"/api/expense-templates/{created['id']}", json={"name": "x"}, headers=other_headers
    )
    assert r2.status_code == 403

    r3 = await client.delete(f"/api/expense-templates/{created['id']}", headers=other_headers)
    assert r3.status_code == 403

    r4 = await client.post(f"/api/expense-templates/{created['id']}", headers=other_headers)
    assert r4.status_code == 403


async def test_template_not_found(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/expense-templates/nonexistent1234567890", headers=headers)
    assert r.status_code == 404


# ── bank-accounts ───────────────────────────────────────────────────
async def test_create_and_list_accounts(client: AsyncClient):
    headers = await _login(client)

    r = await client.post("/api/bank-accounts", json=_account_body(), headers=headers)
    assert r.status_code == 201
    created = r.json()
    assert created["bankName"] == "국민은행"
    # 첫 계좌는 자동으로 기본 계좌
    assert created["isDefault"] is True

    r2 = await client.get("/api/bank-accounts", headers=headers)
    assert r2.status_code == 200
    body = r2.json()
    assert len(body["accounts"]) == 1
    assert body["accounts"][0]["id"] == created["id"]


async def test_second_default_account_unsets_previous(client: AsyncClient):
    headers = await _login(client)
    first = (
        await client.post("/api/bank-accounts", json=_account_body(), headers=headers)
    ).json()
    second = (
        await client.post(
            "/api/bank-accounts",
            json=_account_body(accountNumber="999-888-777", isDefault=True),
            headers=headers,
        )
    ).json()
    assert second["isDefault"] is True

    r = await client.get(f"/api/bank-accounts/{first['id']}", headers=headers)
    assert r.json()["isDefault"] is False


async def test_duplicate_account_number_conflict(client: AsyncClient):
    headers = await _login(client)
    await client.post("/api/bank-accounts", json=_account_body(), headers=headers)

    r = await client.post("/api/bank-accounts", json=_account_body(), headers=headers)
    assert r.status_code == 409
    assert "이미 등록된" in r.json()["detail"]


async def test_update_and_delete_account(client: AsyncClient):
    headers = await _login(client)
    created = (
        await client.post("/api/bank-accounts", json=_account_body(), headers=headers)
    ).json()

    r = await client.put(
        f"/api/bank-accounts/{created['id']}",
        json={"nickname": "새 별명"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["nickname"] == "새 별명"

    r2 = await client.delete(f"/api/bank-accounts/{created['id']}", headers=headers)
    assert r2.status_code == 200
    assert "삭제" in r2.json()["message"]

    r3 = await client.get(f"/api/bank-accounts/{created['id']}", headers=headers)
    assert r3.status_code == 404


async def test_account_other_user_forbidden(client: AsyncClient):
    admin_headers = await _login(client)
    created = (
        await client.post("/api/bank-accounts", json=_account_body(), headers=admin_headers)
    ).json()

    other_headers = await _login(client, userid="other", password="pass1234")
    r = await client.get(f"/api/bank-accounts/{created['id']}", headers=other_headers)
    assert r.status_code == 403

    r2 = await client.put(
        f"/api/bank-accounts/{created['id']}", json={"nickname": "x"}, headers=other_headers
    )
    assert r2.status_code == 403

    r3 = await client.delete(f"/api/bank-accounts/{created['id']}", headers=other_headers)
    assert r3.status_code == 403
