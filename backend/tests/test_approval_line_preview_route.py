"""결재선 미리보기 라우트 계약 테스트 (C10).

레거시 `app/api/approval-line/calculate/route.ts` POST 와의 계약 정합
(요청: budgetCategory/budgetSubcategory/items/requestDate,
 응답: budgetDetailId·managerName·isDirectApproval·steps·budget)을 검증한다.
(test_approval_routes.py 픽스처 패턴 재사용)
"""

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
)
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
                stepName="회계",
                approverType=ApproverType.ROLE,
                role="accountant",
                autoApproveWhenSelf=False,
            ).model_dump(mode="json"),
            PolicyStepRule(
                stepName="재정팀장",
                approverType=ApproverType.ROLE,
                role="finance_head",
                autoApproveWhenSelf=False,
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


async def _login(client: AsyncClient, userid: str, password: str) -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _setup_budget_and_roles(
    client: AsyncClient, tid: str, *, manager_username: str
) -> None:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
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

        if manager_username == "박재정":
            manager = fin
        else:
            manager = User(
                tenantId=tid,
                userid="mgr",
                username=manager_username,
                password=hash_password("pw123"),
                role="team_leader",
            )
            s.add(manager)
            await s.flush()

        cat = BudgetCategory(tenantId=tid, name="사무행정비")
        s.add(cat)
        await s.flush()
        sub = BudgetSubcategory(tenantId=tid, categoryId=cat.id, name="회의비")
        s.add(sub)
        await s.flush()
        detail = BudgetDetail(tenantId=tid, subcategoryId=sub.id, name="간식비")
        s.add(detail)
        await s.flush()
        s.add(
            BudgetDetailYear(
                tenantId=tid,
                budgetDetailId=detail.id,
                year=YEAR,
                managerId=manager.id,
                budgetAmount=100_000,
                usedAmount=30_000,
            )
        )
        s.add(_church_policy(tid))
        await s.commit()


def _calc_body(*, budget_detail: str = "간식비") -> dict:
    return {
        "budgetCategory": "사무행정비",
        "budgetSubcategory": "회의비",
        "items": [{"budgetDetail": budget_detail}],
        "requestDate": f"{YEAR}-03-01",
    }


async def test_general_case_returns_manager_accountant_finance_head(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _setup_budget_and_roles(client, tid, manager_username="김팀장")

    r = await client.post("/api/approval-line/calculate", json=_calc_body(), headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert [s["approverName"] for s in data["steps"]] == ["김팀장", "이회계", "박재정"]
    assert [s["isAutoApproved"] for s in data["steps"]] == [False, False, False]
    assert data["totalSteps"] == 3
    assert data["year"] == YEAR
    assert data["budgetDetailId"]
    assert data["budgetDetailName"] == "간식비"
    assert data["managerName"] == "김팀장"
    assert data["isDirectApproval"] is False
    assert data["budget"] == {
        "budgetAmount": 100_000,
        "usedAmount": 30_000,
        "remainingAmount": 70_000,
        "isOverBudget": False,
    }


async def test_manager_is_finance_head_auto_approves_step1(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _setup_budget_and_roles(client, tid, manager_username="박재정")

    r = await client.post("/api/approval-line/calculate", json=_calc_body(), headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["isDirectApproval"] is True
    assert data["steps"][0]["approverName"] == "박재정"
    assert data["steps"][0]["isAutoApproved"] is True


async def test_unknown_budget_detail_falls_back_to_role_default(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _setup_budget_and_roles(client, tid, manager_username="김팀장")

    r = await client.post(
        "/api/approval-line/calculate", json=_calc_body(budget_detail="존재안함"), headers=headers
    )
    assert r.status_code == 200
    data = r.json()
    assert data["budgetDetailId"] is None
    assert data["budget"] is None
    assert data["managerId"] is None
    # 담당자 미지정 → BUDGET_MANAGER 규칙이 role 폴백(finance_head)으로 resolve
    assert data["steps"][0]["approverName"] == "박재정"


async def test_no_default_policy_returns_400(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        cat = BudgetCategory(tenantId=tid, name="사무행정비")
        s.add(cat)
        await s.flush()
        sub = BudgetSubcategory(tenantId=tid, categoryId=cat.id, name="회의비")
        s.add(sub)
        await s.flush()
        s.add(BudgetDetail(tenantId=tid, subcategoryId=sub.id, name="간식비"))
        await s.commit()

    r = await client.post("/api/approval-line/calculate", json=_calc_body(), headers=headers)
    assert r.status_code == 400
    assert "정책" in r.json()["detail"]


async def test_missing_accountant_role_returns_400(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        fin = User(
            tenantId=tid, userid="fin", username="박재정", password=hash_password("pw123"), role="finance_head"
        )
        s.add(fin)
        await s.flush()
        s.add(UserYearRole(tenantId=tid, userId=fin.id, year=YEAR, role="finance_head"))
        cat = BudgetCategory(tenantId=tid, name="사무행정비")
        s.add(cat)
        await s.flush()
        sub = BudgetSubcategory(tenantId=tid, categoryId=cat.id, name="회의비")
        s.add(sub)
        await s.flush()
        s.add(BudgetDetail(tenantId=tid, subcategoryId=sub.id, name="간식비"))
        s.add(_church_policy(tid))
        await s.commit()

    r = await client.post("/api/approval-line/calculate", json=_calc_body(), headers=headers)
    assert r.status_code == 400
    assert "회계" in r.json()["detail"]
