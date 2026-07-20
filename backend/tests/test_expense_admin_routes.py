"""지출결의서 필터옵션/상태수정/지급상태 라우트 계약 테스트 (B1).

레거시 app/api/expenses/filter-options, [id]/fix-status, [id]/payment-status
와의 계약 정합을 검증한다. (test_approval_routes.py 픽스처 패턴 재사용)
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
    r = await client.post(
        f"/api/expenses/{expense_id}/submit", json={"steps": steps}, headers=headers
    )
    assert r.status_code == 200
    return r.json()


# ── filter-options ───────────────────────────────────────────────────


async def test_filter_options_returns_unique_sorted_values(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _create_expense(
        client, headers, committee="교육위원회", department="2부", applicant="관리자", request_date="2026-03-02"
    )

    r = await client.get("/api/expenses/filter-options", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["committees"] == ["교육위원회", "선교위원회"]
    assert data["departments"] == ["1부", "2부"]
    assert data["budgetCategories"] == ["운영비"]


async def test_filter_options_scopes_to_own_expenses_without_read_all(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="user1", username="사용자1", role="user")

    await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    user_headers = await _login(client, "user1", "pass1234")
    await _create_expense(
        client, user_headers, committee="교육위원회", department="2부", applicant="사용자1", request_date="2026-03-02"
    )

    r = await client.get("/api/expenses/filter-options", headers=user_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["committees"] == ["교육위원회"]
    assert data["departments"] == ["2부"]


# ── fix-status ────────────────────────────────────────────────────────


async def test_fix_status_already_correct_returns_no_op_message(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "관리자"}],
    )

    r = await client.post(f"/api/expenses/{created['id']}/fix-status", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["message"] == "상태가 이미 올바릅니다."
    assert data["currentStatus"] == "PENDING"


async def test_fix_status_forbidden_without_payment_manage_permission(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "관리자"}],
    )

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.post(f"/api/expenses/{created['id']}/fix-status", headers=leader_headers)
    assert r.status_code == 403


# ── payment-status ───────────────────────────────────────────────────


async def test_get_payment_status_returns_current_fields(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    r = await client.get(f"/api/expenses/{created['id']}/payment-status", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == created["id"]
    assert data["status"] == "DRAFT"
    assert data["paymentStatus"] == "PENDING"


async def test_put_payment_status_requires_approved_final(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    r = await client.put(
        f"/api/expenses/{created['id']}/payment-status",
        json={"paymentStatus": "COMPLETED"},
        headers=admin_headers,
    )
    assert r.status_code == 400
    assert "최종 승인" in r.json()["detail"]


async def test_put_payment_status_hold_requires_reason(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "관리자"}],
    )
    await client.post(f"/api/expenses/{created['id']}/approve", json={}, headers=admin_headers)

    r = await client.put(
        f"/api/expenses/{created['id']}/payment-status",
        json={"paymentStatus": "HOLD"},
        headers=admin_headers,
    )
    assert r.status_code == 400
    assert "보류 사유" in r.json()["detail"]


async def test_put_payment_status_completed_updates_expense(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "관리자"}],
    )
    approve_result = await client.post(
        f"/api/expenses/{created['id']}/approve", json={}, headers=admin_headers
    )
    assert approve_result.json()["status"] == "APPROVED_FINAL"

    r = await client.put(
        f"/api/expenses/{created['id']}/payment-status",
        json={"paymentStatus": "COMPLETED", "note": "지급 완료 처리"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["data"]["paymentStatus"] == "COMPLETED"
    assert data["data"]["paymentCompletedBy"] == "관리자"
    assert data["data"]["paymentNote"] == "지급 완료 처리"


async def test_put_payment_status_forbidden_without_permission(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.put(
        f"/api/expenses/{created['id']}/payment-status",
        json={"paymentStatus": "COMPLETED"},
        headers=leader_headers,
    )
    assert r.status_code == 403
