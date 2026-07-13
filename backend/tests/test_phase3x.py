"""Phase 3.x 검증 — ApprovalPolicy 설정형 결재선 (§15.3).

교회 하드코딩 3케이스를 정책으로 재현:
- 일반: 담당자 → 회계 → 재정팀장 (전결 없음)
- 신청자=담당자: 1차 자동승인(전결)
- 담당자=재정팀장: 1차 자동승인(중복 collapse)
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.budget import BudgetDetail, BudgetDetailYear
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User, UserYearRole
from expense_api.core.schemas.approval_policy import ApproverType, PolicyStepRule
from expense_api.core.service.approval_policy_engine import (
    ApprovalPolicyEngine,
    ExpenseContext,
    PolicyResolutionError,
)

YEAR = 2026


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


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


async def _scenario(session, *, manager_username: str, manager_role: str = "team_leader"):
    """tenant + 회계/재정팀장 연도역할 + 세목담당자 구성. manager 를 지정해 케이스 분기."""
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    applicant = User(tenantId=t.id, userid="applicant", username="신청자", role="user")
    acc = User(tenantId=t.id, userid="acc", username="이회계", role="accountant")
    fin = User(tenantId=t.id, userid="fin", username="박재정", role="finance_head")
    session.add_all([applicant, acc, fin])
    await session.flush()
    session.add(UserYearRole(tenantId=t.id, userId=acc.id, year=YEAR, role="accountant"))
    session.add(UserYearRole(tenantId=t.id, userId=fin.id, year=YEAR, role="finance_head"))

    # 담당자 결정
    if manager_username == "박재정":
        manager = fin
    elif manager_username == "신청자":
        manager = applicant
    else:
        manager = User(tenantId=t.id, userid="mgr", username=manager_username, role=manager_role)
        session.add(manager)
        await session.flush()

    detail = BudgetDetail(tenantId=t.id, subcategoryId="sub1", name="간식비")
    session.add(detail)
    await session.flush()
    session.add(
        BudgetDetailYear(tenantId=t.id, budgetDetailId=detail.id, year=YEAR, managerId=manager.id)
    )
    session.add(_church_policy(t.id))
    await session.flush()
    return t, applicant


async def _resolve(session, t, applicant):
    policy = _church_policy(t.id)  # 동일 규칙
    ctx = ExpenseContext(
        tenant_id=t.id, year=YEAR, applicant_user_id=applicant.id, budget_detail_name="간식비"
    )
    return await ApprovalPolicyEngine(session).resolve(policy, ctx)


async def test_general_case(session: AsyncSession):
    t, applicant = await _scenario(session, manager_username="김팀장")
    calc = await _resolve(session, t, applicant)
    assert [s.approverName for s in calc.steps] == ["김팀장", "이회계", "박재정"]
    assert calc.firstPendingStep == 1  # 전결 없음
    assert not calc.allAutoApproved
    assert [s.isAutoApproved for s in calc.steps] == [False, False, False]


async def test_submitter_is_manager_auto_approves_step1(session: AsyncSession):
    t, applicant = await _scenario(session, manager_username="신청자")
    calc = await _resolve(session, t, applicant)
    # 담당자 = 신청자 → 1차 전결
    assert calc.steps[0].isAutoApproved is True
    assert calc.firstPendingStep == 2


async def test_manager_is_finance_head_collapses_step1(session: AsyncSession):
    t, applicant = await _scenario(session, manager_username="박재정")
    calc = await _resolve(session, t, applicant)
    # 담당자(박재정) == 3차 재정팀장(박재정) → 중복 collapse 로 1차 전결
    assert calc.steps[0].approverName == "박재정"
    assert calc.steps[0].isAutoApproved is True
    assert calc.firstPendingStep == 2


async def test_missing_role_raises(session: AsyncSession):
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    applicant = User(tenantId=t.id, userid="a", username="신청자", role="user")
    session.add(applicant)
    detail = BudgetDetail(tenantId=t.id, subcategoryId="s", name="간식비")
    session.add(detail)
    await session.flush()
    session.add(
        BudgetDetailYear(tenantId=t.id, budgetDetailId=detail.id, year=YEAR, managerId=applicant.id)
    )
    await session.flush()
    # 회계/재정팀장 연도역할 없음 → resolve 실패
    with pytest.raises(PolicyResolutionError):
        await _resolve(session, t, applicant)


# ── submit 정책 연동 ──────────────────────────────────────────────────
async def test_submit_uses_policy_and_pre_approves(session: AsyncSession):
    from datetime import datetime, timezone

    from expense_api.core.dependencies.auth import CurrentUser
    from expense_api.core.schemas.approval import SubmitRequest
    from expense_api.core.schemas.expense import CreateExpenseRequest, ExpenseItemInput
    from expense_api.core.service.approval_service import ApprovalService
    from expense_api.core.service.expense_service import ExpenseService

    # 신청자 == 담당자 시나리오
    t, applicant = await _scenario(session, manager_username="신청자")

    req = CreateExpenseRequest(
        committee="본부",
        department="팀",
        items=[
            ExpenseItemInput(budgetDetail="간식비", description="간식", unitPrice=1000, quantity=2)
        ],
        requestDate=datetime(YEAR, 3, 1, tzinfo=timezone.utc),
        applicantName="신청자",
        bankName="국민",
        accountNumber="1",
        accountHolder="신청자",
    )
    exp = await ExpenseService(session, t.id).create(applicant.id, req)
    actor = CurrentUser(
        id=applicant.id,
        tenantId=t.id,
        userid="applicant",
        username="신청자",
        role="user",
        roles=["user"],
    )

    # 명시적 steps 없이 제출 → 정책 산출 + 1차 전결 선완료
    result = await ApprovalService(session, t.id).submit(exp.id, actor, SubmitRequest())
    assert result.status == "APPROVED_STEP_1"  # 1차 전결 완료 → STEP_1

    line = await ApprovalService(session, t.id)._get_line(exp.id)
    assert line.currentStep == 2  # 2차(회계)부터 대기
