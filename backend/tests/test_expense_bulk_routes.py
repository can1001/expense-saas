"""지출결의서 일괄 처리 라우트 계약 테스트 (B3).

레거시 app/api/expenses/bulk, bulk-expense-date, bulk-payment-status 와의
계약 정합을 검증한다. (test_expense_admin_routes.py 픽스처 패턴 재사용)
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


async def _tenant_id(client: AsyncClient) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = (await s.execute(select(Tenant.id))).first()
        return row[0]


async def _login(client: AsyncClient, userid: str, password: str) -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _create_user(client: AsyncClient, tid: str, *, userid: str, username: str, role: str) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        u = User(
            tenantId=tid,
            userid=userid,
            username=username,
            password=hash_password("pass1234"),
            role=role,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u.id


async def _create_other_tenant_admin(client: AsyncClient) -> dict:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        t2 = Tenant(name="타사", subdomain="other")
        s.add(t2)
        await s.flush()
        s.add(
            User(
                tenantId=t2.id,
                userid="admin2",
                username="타사관리자",
                password=hash_password("admin123"),
                role="admin",
            )
        )
        await s.commit()
    return await _login(client, "admin2", "admin123")


def _expense_body(*, committee: str, department: str, applicant: str, request_date: str) -> dict:
    return {
        "committee": committee,
        "department": department,
        "requestDate": request_date,
        "applicantName": applicant,
        "bankName": "국민",
        "accountNumber": "111-222-333",
        "accountHolder": applicant,
        "items": [
            {
                "budgetCategory": "운영비",
                "budgetSubcategory": "회의비",
                "budgetDetail": "다과비",
                "description": "간식 구입",
                "unitPrice": 10000,
                "quantity": 2,
            }
        ],
    }


async def _create_expense(client: AsyncClient, headers: dict, **kwargs) -> dict:
    r = await client.post("/api/expenses", json=_expense_body(**kwargs), headers=headers)
    assert r.status_code == 201
    return r.json()


async def _submit(client: AsyncClient, headers: dict, expense_id: str, steps: list[dict]) -> dict:
    r = await client.post(f"/api/expenses/{expense_id}/submit", json={"steps": steps}, headers=headers)
    assert r.status_code == 200
    return r.json()


async def _approve_final(client: AsyncClient, headers: dict, expense_id: str) -> dict:
    created_steps = [{"stepNumber": 1, "stepName": "팀장", "approverName": "관리자"}]
    await _submit(client, headers, expense_id, created_steps)
    r = await client.post(f"/api/expenses/{expense_id}/approve", json={}, headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "APPROVED_FINAL"
    return r.json()


# ── bulk (일괄 조회) ─────────────────────────────────────────────────


async def test_bulk_fetch_returns_expense_and_approval_line(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(client, headers, created["id"], [{"stepNumber": 1, "stepName": "팀장", "approverName": "관리자"}])

    r = await client.post("/api/expenses/bulk", json={"ids": [created["id"]]}, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["total"] == 1
    assert data["requested"] == 1
    item = data["expenses"][0]
    assert item["expense"]["id"] == created["id"]
    assert item["expense"]["attachments"] == []
    assert item["approvalLine"]["totalSteps"] == 1
    assert item["approvalLine"]["steps"][0]["approverName"] == "관리자"


async def test_bulk_fetch_rejects_empty_ids(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    r = await client.post("/api/expenses/bulk", json={"ids": []}, headers=headers)
    assert r.status_code == 400


async def test_bulk_fetch_excludes_other_tenant_expense(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    other_headers = await _create_other_tenant_admin(client)
    other_created = await _create_expense(
        client, other_headers, committee="타사위원회", department="타부", applicant="타사관리자", request_date="2026-03-01"
    )

    r = await client.post("/api/expenses/bulk", json={"ids": [other_created["id"]]}, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0
    assert data["requested"] == 1
    assert data["expenses"] == []


# ── bulk-expense-date ─────────────────────────────────────────────────


async def test_bulk_expense_date_updates_only_null_by_default(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    e1 = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    e2 = await _create_expense(
        client, headers, committee="교육위원회", department="2부", applicant="관리자", request_date="2026-03-02"
    )

    r = await client.put(
        "/api/expenses/bulk-expense-date",
        json={"ids": [e1["id"], e2["id"]], "expenseDate": "2026-03-10", "overwriteExisting": False},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["data"]["actualUpdated"] == 2
    assert data["data"]["skipped"] == 0

    r2 = await client.put(
        "/api/expenses/bulk-expense-date",
        json={"ids": [e1["id"]], "expenseDate": "2026-03-15", "overwriteExisting": False},
        headers=headers,
    )
    assert r2.status_code == 400


async def test_bulk_expense_date_forbidden_without_permission(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.put(
        "/api/expenses/bulk-expense-date",
        json={"ids": [created["id"]], "expenseDate": "2026-03-10"},
        headers=leader_headers,
    )
    assert r.status_code == 403


async def test_bulk_expense_date_ignores_other_tenant_ids(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    other_headers = await _create_other_tenant_admin(client)
    mine = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    other_created = await _create_expense(
        client, other_headers, committee="타사위원회", department="타부", applicant="타사관리자", request_date="2026-03-01"
    )

    r = await client.put(
        "/api/expenses/bulk-expense-date",
        json={"ids": [mine["id"], other_created["id"]], "expenseDate": "2026-03-10"},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["data"]["totalSelected"] == 2
    assert data["data"]["actualUpdated"] == 1

    other_get = await client.get(f"/api/expenses/{other_created['id']}", headers=other_headers)
    assert other_get.json()["expenseDate"] is None


# ── bulk-payment-status ───────────────────────────────────────────────


async def test_bulk_payment_status_completes_approved_expenses(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    e1 = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    e2 = await _create_expense(
        client, headers, committee="교육위원회", department="2부", applicant="관리자", request_date="2026-03-02"
    )
    await _approve_final(client, headers, e1["id"])
    await _approve_final(client, headers, e2["id"])

    r = await client.put(
        "/api/expenses/bulk-payment-status",
        json={"ids": [e1["id"], e2["id"]], "paymentStatus": "COMPLETED", "note": "일괄 지급"},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["data"]["updatedCount"] == 2
    assert data["data"]["skipped"] == {"notApproved": 0, "alreadySameStatus": 0}

    check = await client.get(f"/api/expenses/{e1['id']}/payment-status", headers=headers)
    assert check.json()["paymentStatus"] == "COMPLETED"


async def test_bulk_payment_status_skips_non_approved(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    draft = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    r = await client.put(
        "/api/expenses/bulk-payment-status",
        json={"ids": [draft["id"]], "paymentStatus": "COMPLETED"},
        headers=headers,
    )
    assert r.status_code == 400


async def test_bulk_payment_status_forbidden_without_permission(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.put(
        "/api/expenses/bulk-payment-status",
        json={"ids": [created["id"]], "paymentStatus": "COMPLETED"},
        headers=leader_headers,
    )
    assert r.status_code == 403


async def test_bulk_payment_status_rejects_invalid_status_value(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    r = await client.put(
        "/api/expenses/bulk-payment-status",
        json={"ids": [created["id"]], "paymentStatus": "HOLD"},
        headers=headers,
    )
    assert r.status_code == 400
