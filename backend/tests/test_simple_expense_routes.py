"""간편 지출결의서 라우트 계약 테스트 (B4).

레거시 app/api/simple-expenses(*)/route.ts 와의 계약 정합
(응답 키·상태코드·결재선 자동 확정·항목별 담당자 일치 검증)을 검증한다.
(test_approval_line_preview_route.py 픽스처 패턴 재사용)
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
from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetDetailYear,
    BudgetSubcategory,
    Committee,
    Department,
    DepartmentBudgetDetail,
)
from expense_api.core.models.expense import Expense
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User, UserYearRole
from expense_api.core.schemas.approval_policy import ApproverType, PolicyStepRule
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from main import app

YEAR = 2026


def _church_policy(tid: str) -> ApprovalPolicy:
    return ApprovalPolicy(
        tenantId=tid,
        name="기본",
        isDefault=True,
        collapseDuplicateApprovers=True,
        steps=[
            PolicyStepRule(
                stepName="담당자", approverType=ApproverType.BUDGET_MANAGER, role="finance_head"
            ).model_dump(mode="json"),
            PolicyStepRule(
                stepName="회계", approverType=ApproverType.ROLE, role="accountant"
            ).model_dump(mode="json"),
            PolicyStepRule(
                stepName="재정팀장", approverType=ApproverType.ROLE, role="finance_head"
            ).model_dump(mode="json"),
        ],
    )


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


async def _login(client: AsyncClient, userid: str = "admin", password: str = "admin123") -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _seed_budget_detail(
    client: AsyncClient,
    tid: str,
    *,
    category: str = "사무행정비",
    subcategory: str = "회의비",
    detail: str = "간식비",
    committee: str = "기획본부",
    department: str = "재정팀",
    manager_username: str | None = "김담당",
) -> None:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        fin = (
            await s.execute(select(User).where(User.tenantId == tid, User.userid == "fin"))
        ).scalars().first()
        if fin is None:
            acc = User(
                tenantId=tid, userid="acc", username="이회계", password=hash_password("pw123"), role="accountant"
            )
            fin = User(
                tenantId=tid, userid="fin", username="박재정", password=hash_password("pw123"), role="finance_head"
            )
            s.add_all([acc, fin])
            await s.flush()
            s.add(UserYearRole(tenantId=tid, userId=acc.id, year=YEAR, role="accountant"))
            s.add(UserYearRole(tenantId=tid, userId=fin.id, year=YEAR, role="finance_head"))
            s.add(_church_policy(tid))

        if manager_username == "박재정":
            manager = fin
        elif manager_username is not None:
            manager = User(
                tenantId=tid, userid=f"mgr_{manager_username}", username=manager_username,
                password=hash_password("pw123"), role="team_leader",
            )
            s.add(manager)
            await s.flush()
        else:
            manager = None

        comm = Committee(tenantId=tid, name=committee)
        s.add(comm)
        await s.flush()
        dept = Department(tenantId=tid, committeeId=comm.id, name=department)
        cat = BudgetCategory(tenantId=tid, name=category)
        s.add_all([dept, cat])
        await s.flush()
        sub = BudgetSubcategory(tenantId=tid, categoryId=cat.id, name=subcategory)
        s.add(sub)
        await s.flush()
        det = BudgetDetail(tenantId=tid, subcategoryId=sub.id, name=detail)
        s.add(det)
        await s.flush()
        s.add(DepartmentBudgetDetail(tenantId=tid, departmentId=dept.id, budgetDetailId=det.id))
        s.add(
            BudgetDetailYear(
                tenantId=tid,
                budgetDetailId=det.id,
                year=YEAR,
                managerId=manager.id if manager else None,
            )
        )
        await s.commit()


def _item(*, category="사무행정비", subcategory="회의비", detail="간식비", unit_price=10000, quantity=2) -> dict:
    return {
        "budgetCategory": category,
        "budgetSubcategory": subcategory,
        "budgetDetail": detail,
        "description": "간식 구입",
        "unitPrice": unit_price,
        "quantity": quantity,
    }


def _body(*, items=None, status="DRAFT") -> dict:
    return {
        "requestDate": f"{YEAR}-03-01",
        "applicantName": "홍길동",
        "bankName": "국민",
        "accountNumber": "111-222-333",
        "accountHolder": "홍길동",
        "items": items or [_item()],
        "status": status,
    }


# ── POST 생성 ─────────────────────────────────────────────────────────


async def test_create_draft_derives_committee_and_amount(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(client, tid)

    r = await client.post("/api/simple-expenses", json=_body(), headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert data["success"] is True
    assert data["message"] == "지출결의서가 생성되었습니다."
    expense = data["expense"]
    assert expense["id"] == data["id"]
    assert expense["version"] == "4.1.4"
    assert expense["committee"] == "기획본부"
    assert expense["department"] == "재정팀"
    assert expense["requestTeam"] == "기획본부 재정팀"
    assert expense["status"] == "DRAFT"
    assert expense["requestAmount"] == 20000
    assert len(expense["items"]) == 1
    assert expense["items"][0]["amount"] == 20000


async def test_create_pending_auto_confirms_approval_line(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(client, tid, manager_username="김담당")

    r = await client.post("/api/simple-expenses", json=_body(status="PENDING"), headers=headers)
    assert r.status_code == 201
    expense = r.json()["expense"]
    assert expense["status"] == "PENDING"
    assert expense["submittedAt"] is not None
    assert expense["approvedAt"] is None


async def test_create_pending_manager_is_finance_head_auto_approves_step1(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(client, tid, manager_username="박재정")

    r = await client.post("/api/simple-expenses", json=_body(status="PENDING"), headers=headers)
    assert r.status_code == 201
    expense = r.json()["expense"]
    assert expense["status"] == "APPROVED_STEP_1"


async def test_create_manager_mismatch_across_items_returns_400(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(
        client, tid, category="사무행정비", subcategory="회의비", detail="간식비", manager_username="김담당"
    )
    await _seed_budget_detail(
        client, tid, category="선교비", subcategory="행사비", detail="현수막", manager_username="박재정"
    )

    body = _body(items=[_item(), _item(category="선교비", subcategory="행사비", detail="현수막")])
    r = await client.post("/api/simple-expenses", json=body, headers=headers)
    assert r.status_code == 400
    assert "결재선이 다릅니다" in r.json()["detail"]


async def test_create_unknown_budget_detail_returns_400(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(client, tid)

    body = _body(items=[_item(detail="존재안함")])
    r = await client.post("/api/simple-expenses", json=body, headers=headers)
    assert r.status_code == 400
    assert "예산 정보를 찾을 수 없습니다" in r.json()["detail"]


# ── GET 목록/상세 ─────────────────────────────────────────────────────


async def test_list_only_returns_simple_expenses(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(client, tid)
    await client.post("/api/simple-expenses", json=_body(), headers=headers)

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = (await s.execute(select(User.id).where(User.userid == "admin"))).scalar_one()
        s.add(
            Expense(
                tenantId=tid, userId=row, committee="본부", department="팀", requestAmount=1000,
                requestDate=datetime(2026, 3, 1), requestTeam="본부 팀", applicantName="관리자",
                bankName="국민", accountNumber="1", accountHolder="관리자", version="4.1.3",
            )
        )
        await s.commit()

    r = await client.get("/api/simple-expenses", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["pagination"] == {"page": 1, "limit": 10, "total": 1, "totalPages": 1}
    assert len(data["expenses"]) == 1
    assert data["expenses"][0]["version"] == "4.1.4"


async def test_get_detail_includes_attachments_key(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(client, tid)
    created = (await client.post("/api/simple-expenses", json=_body(), headers=headers)).json()

    r = await client.get(f"/api/simple-expenses/{created['id']}", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["attachments"] == []
    assert data["version"] == "4.1.4"


async def test_get_full_expense_via_simple_endpoint_returns_404(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = (await s.execute(select(User.id).where(User.userid == "admin"))).scalar_one()
        e = Expense(
            tenantId=tid, userId=row, committee="본부", department="팀", requestAmount=1000,
            requestDate=datetime(2026, 3, 1), requestTeam="본부 팀", applicantName="관리자",
            bankName="국민", accountNumber="1", accountHolder="관리자", version="4.1.3",
        )
        s.add(e)
        await s.commit()
        await s.refresh(e)
        eid = e.id

    r = await client.get(f"/api/simple-expenses/{eid}", headers=headers)
    assert r.status_code == 404


# ── PUT / DELETE ──────────────────────────────────────────────────────


async def test_put_replaces_items_and_recalculates_amount(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(client, tid)
    created = (await client.post("/api/simple-expenses", json=_body(), headers=headers)).json()

    r = await client.put(
        f"/api/simple-expenses/{created['id']}",
        json={"items": [_item(unit_price=5000, quantity=3)]},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["requestAmount"] == 15000
    assert len(data["items"]) == 1
    assert data["items"][0]["amount"] == 15000


async def test_delete_then_get_returns_404(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    await _seed_budget_detail(client, tid)
    created = (await client.post("/api/simple-expenses", json=_body(), headers=headers)).json()

    r = await client.delete(f"/api/simple-expenses/{created['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json() == {"success": True}

    r2 = await client.get(f"/api/simple-expenses/{created['id']}", headers=headers)
    assert r2.status_code == 404


async def test_cross_tenant_returns_404(client: AsyncClient):
    headers = await _login(client)

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        other_tenant = Tenant(name="다른교회", subdomain="other")
        s.add(other_tenant)
        await s.flush()
        other_user = User(
            tenantId=other_tenant.id, userid="otheradmin", username="다른관리자",
            password=hash_password("pass1234"), role="admin",
        )
        s.add(other_user)
        await s.flush()
        other_expense = Expense(
            tenantId=other_tenant.id, userId=other_user.id, committee="타위원회", department="타부서",
            requestAmount=1000, requestDate=datetime(2026, 3, 1), requestTeam="타부서", applicantName="다른관리자",
            bankName="국민", accountNumber="1", accountHolder="다른관리자", version="4.1.4",
        )
        s.add(other_expense)
        await s.commit()
        await s.refresh(other_expense)
        other_id = other_expense.id

    r = await client.get(f"/api/simple-expenses/{other_id}", headers=headers)
    assert r.status_code == 404

    r2 = await client.put(f"/api/simple-expenses/{other_id}", json={"applicantName": "변경"}, headers=headers)
    assert r2.status_code == 404

    r3 = await client.delete(f"/api/simple-expenses/{other_id}", headers=headers)
    assert r3.status_code == 404
