"""admin 대시보드/연도 설정 현황 라우트 계약 테스트. (app/api/admin/dashboard,
app/api/admin/year-setup-status 컷오버 — D1)
"""

from datetime import datetime

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetDetailYear,
    Committee,
    Department,
    DepartmentBudgetDetail,
)
from expense_api.core.models.budget import BudgetSubcategory
from expense_api.core.models.expense import Expense
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User, UserYearRole
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from main import app

YEAR = 2026


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
                userid="user1",
                username="사용자1",
                password=hash_password("user123"),
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


async def _seed(client: AsyncClient) -> dict:
    """위원회→사역팀→항→목→세목(연도설정+담당자) + 지출 2건 + 역할 시드."""
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        tid = (await s.execute(select(Tenant.id))).scalar_one()
        admin_id = (await s.execute(select(User.id).where(User.userid == "admin"))).scalar_one()
        user_id = (await s.execute(select(User.id).where(User.userid == "user1"))).scalar_one()

        manager = User(tenantId=tid, userid="mgr", username="김담당", role="user")
        s.add(manager)
        await s.flush()

        comm = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        s.add(comm)
        await s.flush()
        dept = Department(tenantId=tid, committeeId=comm.id, name="재정팀", sortOrder=1)
        cat = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
        s.add_all([dept, cat])
        await s.flush()
        sub = BudgetSubcategory(tenantId=tid, categoryId=cat.id, name="회의비", sortOrder=1)
        s.add(sub)
        await s.flush()
        detail_done = BudgetDetail(tenantId=tid, subcategoryId=sub.id, name="간식비", sortOrder=1)
        detail_missing = BudgetDetail(tenantId=tid, subcategoryId=sub.id, name="교통비", sortOrder=2)
        s.add_all([detail_done, detail_missing])
        await s.flush()
        s.add(
            BudgetDetailYear(
                tenantId=tid, budgetDetailId=detail_done.id, year=YEAR,
                managerId=manager.id, budgetAmount=1_000_000, usedAmount=300_000,
            )
        )
        s.add_all(
            [
                DepartmentBudgetDetail(tenantId=tid, departmentId=dept.id, budgetDetailId=detail_done.id),
                DepartmentBudgetDetail(tenantId=tid, departmentId=dept.id, budgetDetailId=detail_missing.id),
            ]
        )
        s.add(UserYearRole(tenantId=tid, userId=user_id, year=YEAR, role="user"))

        now = datetime.now()
        pending = Expense(
            tenantId=tid, userId=admin_id, committee="기획본부", department="재정팀",
            expenseDate=now, requestAmount=50_000, requestDate=now, applicantName="관리자",
            bankName="은행", accountNumber="1-2-3", accountHolder="관리자",
            status="PENDING", paymentStatus="PENDING",
        )
        approved = Expense(
            tenantId=tid, userId=admin_id, committee="기획본부", department="재정팀",
            expenseDate=now, requestAmount=120_000, requestDate=now, applicantName="관리자",
            bankName="은행", accountNumber="1-2-3", accountHolder="관리자",
            status="APPROVED_FINAL", paymentStatus="COMPLETED",
        )
        s.add_all([pending, approved])
        await s.commit()

    return {"tenantId": tid}


async def test_dashboard_kpi(client: AsyncClient):
    headers = await _login(client)
    await _seed(client)

    r = await client.get(f"/api/admin/dashboard?year={YEAR}", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["year"] == YEAR
    assert body["kpi"]["totalBudget"] == 1_000_000
    assert body["kpi"]["totalUsed"] == 300_000
    assert body["kpi"]["executionRate"] == 30.0
    assert body["kpi"]["pendingApprovals"] == 1
    assert body["kpi"]["pendingPayments"] == 0
    assert body["yearly"]["totalExpense"] == 120_000
    assert body["yearly"]["expenseCount"] == 1
    assert len(body["recentExpenses"]) == 2


async def test_dashboard_requires_permission(client: AsyncClient):
    headers = await _login(client, "user1", "user123")
    r = await client.get("/api/admin/dashboard", headers=headers)
    assert r.status_code == 403


async def test_year_setup_status(client: AsyncClient):
    headers = await _login(client)
    await _seed(client)

    r = await client.get(f"/api/admin/year-setup-status?year={YEAR}", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["year"] == YEAR
    assert body["summary"]["roleSetup"]["total"] == 3
    assert body["summary"]["roleSetup"]["completed"] == 1
    assert body["summary"]["managerAssignment"]["total"] == 2
    assert body["summary"]["managerAssignment"]["completed"] == 1
    assert body["summary"]["budgetInput"]["completed"] == 1
    assert body["summary"]["budgetInput"]["totalAmount"] == 1_000_000
    missing_detail_names = {m["name"] for m in body["missing"]["managers"]}
    assert "교통비" in missing_detail_names
    missing_budget_names = {m["name"] for m in body["missing"]["budgets"]}
    assert "교통비" in missing_budget_names


async def test_year_setup_status_requires_permission(client: AsyncClient):
    headers = await _login(client, "user1", "user123")
    r = await client.get("/api/admin/year-setup-status", headers=headers)
    assert r.status_code == 403
