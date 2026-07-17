"""지출결의서 PUT/DELETE 라우트 계약 테스트 (C7).

레거시 app/api/expenses/[id]/route.ts 의 항목 전체교체·금액 재계산·상태별 수정 규칙·
소유권/역할 우회·삭제 규칙과의 계약 정합을 검증한다.
(test_expense_list_routes.py 픽스처 패턴 재사용)
"""

from datetime import datetime

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.enums import ApprovalStatus, PaymentStatus
from expense_api.core.models.expense import Expense
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


async def _create_user(client: AsyncClient, tid: str, *, userid: str, role: str) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        u = User(
            tenantId=tid,
            userid=userid,
            username=userid,
            password=hash_password("pass1234"),
            role=role,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u.id


def _expense_body(*, committee: str, department: str, applicant: str, request_date: str, items: list[dict] | None = None) -> dict:
    return {
        "committee": committee,
        "department": department,
        "requestDate": request_date,
        "applicantName": applicant,
        "bankName": "국민",
        "accountNumber": "111-222-333",
        "accountHolder": applicant,
        "items": items
        or [
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


async def _set_status(
    client: AsyncClient, expense_id: str, *, status: str, payment_status: str | None = None
) -> None:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        expense = await s.get(Expense, expense_id)
        expense.status = status
        if payment_status is not None:
            expense.paymentStatus = payment_status
        s.add(expense)
        await s.commit()


# ── PUT: 항목 교체 + 금액 재계산 ─────────────────────────────────────────


async def test_put_replaces_items_and_recalculates_amount(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )

    body = _expense_body(
        committee="선교위원회",
        department="1부",
        applicant="홍길동",
        request_date="2026-03-01",
        items=[
            {
                "budgetCategory": "운영비",
                "budgetSubcategory": "회의비",
                "budgetDetail": "다과비",
                "description": "새 항목",
                "unitPrice": 12345,
                "quantity": 3,
            }
        ],
    )
    r = await client.put(f"/api/expenses/{created['id']}", json=body, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["description"] == "새 항목"
    assert data["items"][0]["amount"] == 12345 * 3
    assert data["requestAmount"] == 12345 * 3


async def test_put_status_draft_to_pending_sets_submitted_at(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )
    assert created["submittedAt"] is None

    body = _expense_body(
        committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )
    body["status"] = "PENDING"
    r = await client.put(f"/api/expenses/{created['id']}", json=body, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "PENDING"
    assert data["submittedAt"] is not None


# ── PUT: 소유권 / 상태 규칙 ───────────────────────────────────────────────


async def test_put_non_owner_without_bypass_role_forbidden(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    await _create_user(client, tid, userid="member", role="user")
    member_headers = await _login(client, "member", "pass1234")

    body = _expense_body(
        committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    r = await client.put(f"/api/expenses/{created['id']}", json=body, headers=member_headers)
    assert r.status_code == 403


async def test_put_non_owner_with_edit_approved_role_bypasses(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    await _create_user(client, tid, userid="finance", role="finance_head")
    finance_headers = await _login(client, "finance", "pass1234")

    body = _expense_body(
        committee="선교위원회", department="1부", applicant="관리자수정", request_date="2026-03-01"
    )
    r = await client.put(f"/api/expenses/{created['id']}", json=body, headers=finance_headers)
    assert r.status_code == 200
    assert r.json()["applicantName"] == "관리자수정"


async def test_put_pending_status_not_editable(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )
    await _set_status(client, created["id"], status=ApprovalStatus.PENDING.value)

    body = _expense_body(
        committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )
    r = await client.put(f"/api/expenses/{created['id']}", json=body, headers=headers)
    assert r.status_code == 403


async def test_put_approved_final_pending_payment_editable_by_bypass_role_only(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _set_status(
        client,
        created["id"],
        status=ApprovalStatus.APPROVED_FINAL.value,
        payment_status=PaymentStatus.PENDING.value,
    )

    body = _expense_body(
        committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    # 작성자(admin) 본인이라도 EXPENSE_EDIT_APPROVED 권한이 없으면 불가 — admin 역할은 전체 권한이므로
    # 대신 일반 사용자 소유자로 재현
    await _create_user(client, tid, userid="owner2", role="user")
    owner_headers = await _login(client, "owner2", "pass1234")
    created2 = await _create_expense(
        client, owner_headers, committee="선교위원회", department="1부", applicant="일반회원", request_date="2026-03-01"
    )
    await _set_status(
        client,
        created2["id"],
        status=ApprovalStatus.APPROVED_FINAL.value,
        payment_status=PaymentStatus.PENDING.value,
    )
    body2 = _expense_body(
        committee="선교위원회", department="1부", applicant="일반회원", request_date="2026-03-01"
    )
    r_owner = await client.put(f"/api/expenses/{created2['id']}", json=body2, headers=owner_headers)
    assert r_owner.status_code == 403

    await _create_user(client, tid, userid="finance2", role="finance_head")
    finance_headers = await _login(client, "finance2", "pass1234")
    r = await client.put(f"/api/expenses/{created['id']}", json=body, headers=finance_headers)
    assert r.status_code == 200
    assert r.json()["status"] == ApprovalStatus.APPROVED_FINAL.value


async def test_put_cross_tenant_returns_404(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        other_tenant = Tenant(name="다른교회", subdomain="other")
        s.add(other_tenant)
        await s.flush()
        other_user = User(
            tenantId=other_tenant.id,
            userid="otheradmin",
            username="다른관리자",
            password=hash_password("pass1234"),
            role="admin",
        )
        s.add(other_user)
        await s.flush()
        other_expense = Expense(
            tenantId=other_tenant.id,
            userId=other_user.id,
            committee="타위원회",
            department="타부서",
            requestAmount=10000,
            requestDate=datetime(2026, 3, 1),
            requestTeam="타부서",
            applicantName="다른관리자",
            bankName="국민",
            accountNumber="000",
            accountHolder="다른관리자",
        )
        s.add(other_expense)
        await s.commit()
        await s.refresh(other_expense)
        other_id = other_expense.id

    body = _expense_body(
        committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )
    r = await client.put(f"/api/expenses/{other_id}", json=body, headers=headers)
    assert r.status_code == 404

    r2 = await client.delete(f"/api/expenses/{other_id}", headers=headers)
    assert r2.status_code == 404


# ── DELETE ────────────────────────────────────────────────────────────


async def test_delete_draft_by_owner_succeeds(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )

    r = await client.delete(f"/api/expenses/{created['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json() == {"success": True}

    r2 = await client.get(f"/api/expenses/{created['id']}", headers=headers)
    assert r2.status_code == 404


async def test_delete_submitted_status_forbidden(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )
    await _set_status(client, created["id"], status=ApprovalStatus.PENDING.value)

    r = await client.delete(f"/api/expenses/{created['id']}", headers=headers)
    assert r.status_code == 403


async def test_delete_non_owner_without_bypass_role_forbidden(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    await _create_user(client, tid, userid="member", role="user")
    member_headers = await _login(client, "member", "pass1234")

    r = await client.delete(f"/api/expenses/{created['id']}", headers=member_headers)
    assert r.status_code == 403


async def test_delete_non_owner_with_bypass_role_succeeds(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    await _create_user(client, tid, userid="finance", role="finance_head")
    finance_headers = await _login(client, "finance", "pass1234")

    r = await client.delete(f"/api/expenses/{created['id']}", headers=finance_headers)
    assert r.status_code == 200


async def test_delete_rejected_status_allowed(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="홍길동", request_date="2026-03-01"
    )
    await _set_status(client, created["id"], status=ApprovalStatus.REJECTED.value)

    r = await client.delete(f"/api/expenses/{created['id']}", headers=headers)
    assert r.status_code == 200
