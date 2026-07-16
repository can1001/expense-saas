"""결재선 조건부/병렬/대리 확장 검증."""

from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import expense_api.core.models  # noqa: F401
from expense_api.core.dependencies.auth import CurrentUser
from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.schemas.approval import SubmitRequest
from expense_api.core.schemas.approval_policy import ApproverType, PolicyStepRule
from expense_api.core.schemas.expense import CreateExpenseRequest, ExpenseItemInput
from expense_api.core.service.approval_policy_engine import ApprovalPolicyEngine, ExpenseContext
from expense_api.core.service.approval_service import ApprovalService, WorkflowError
from expense_api.core.service.expense_service import ExpenseService



def _actor(u: User) -> CurrentUser:
    return CurrentUser(
        id=u.id, tenantId=u.tenantId, userid=u.userid, username=u.username,
        role=u.role, roles=[u.role],
    )


async def _tenant_users(session, names: list[str]):
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    users = {}
    for n in names:
        u = User(tenantId=t.id, userid=n, username=n, role="user")
        session.add(u)
        users[n] = u
    await session.flush()
    return t, users


def _fixed(step_name, user, *, parallel=False, min_amount=None):
    return PolicyStepRule(
        stepName=step_name, approverType=ApproverType.FIXED_USER, userId=user.id,
        autoApproveWhenSelf=False, parallel=parallel, minAmount=min_amount,
    ).model_dump(mode="json")


async def _create_expense(session, tid, applicant, amount) -> str:
    req = CreateExpenseRequest(
        committee="본부", department="팀",
        items=[ExpenseItemInput(budgetDetail="세목", description="적요", unitPrice=amount, quantity=1)],
        requestDate=datetime(2026, 3, 1, tzinfo=timezone.utc),
        applicantName=applicant.username, bankName="국민", accountNumber="1", accountHolder=applicant.username,
    )
    exp = await ExpenseService(session, tid).create(applicant.id, req)
    return exp.id


# ── 조건부 (금액) ─────────────────────────────────────────────────────
async def test_conditional_step_skipped_below_threshold(session: AsyncSession):
    t, u = await _tenant_users(session, ["신청", "팀장", "임원"])
    policy = ApprovalPolicy(
        tenantId=t.id, name="p", steps=[
            _fixed("팀장", u["팀장"]),
            _fixed("임원", u["임원"], min_amount=1_000_000),  # 100만원 이상만
        ],
    )
    eng = ApprovalPolicyEngine(session)
    # 소액 → 임원 스텝 제외 (1레벨)
    small = await eng.resolve(policy, ExpenseContext(t.id, 2026, u["신청"].id, request_amount=500_000))
    assert [s.stepName for s in small.steps] == ["팀장"]
    assert small.totalSteps == 1
    # 고액 → 임원 포함 (2레벨)
    big = await eng.resolve(policy, ExpenseContext(t.id, 2026, u["신청"].id, request_amount=2_000_000))
    assert [s.stepName for s in big.steps] == ["팀장", "임원"]
    assert big.totalSteps == 2


# ── 병렬 ──────────────────────────────────────────────────────────────
async def test_parallel_same_level(session: AsyncSession):
    t, u = await _tenant_users(session, ["신청", "검토A", "검토B", "최종"])
    policy = ApprovalPolicy(
        tenantId=t.id, name="p", steps=[
            _fixed("검토A", u["검토A"]),
            _fixed("검토B", u["검토B"], parallel=True),  # A와 같은 레벨
            _fixed("최종", u["최종"]),
        ],
    )
    calc = await ApprovalPolicyEngine(session).resolve(
        policy, ExpenseContext(t.id, 2026, u["신청"].id, request_amount=1000)
    )
    assert [s.stepNumber for s in calc.steps] == [1, 1, 2]  # A,B 병렬(레벨1), 최종 레벨2
    assert calc.totalSteps == 2


async def test_parallel_partial_then_complete(session: AsyncSession):
    t, u = await _tenant_users(session, ["신청", "검토A", "검토B", "최종"])
    session.add(ApprovalPolicy(
        tenantId=t.id, name="p", isDefault=True, steps=[
            _fixed("검토A", u["검토A"]),
            _fixed("검토B", u["검토B"], parallel=True),
            _fixed("최종", u["최종"]),
        ],
    ))
    await session.flush()
    eid = await _create_expense(session, t.id, u["신청"], 1000)
    asvc = ApprovalService(session, t.id)
    await asvc.submit(eid, _actor(u["신청"]), SubmitRequest())

    # 병렬 레벨1: A만 승인 → 아직 미완료(PENDING 유지)
    exp = await asvc.approve(eid, _actor(u["검토A"]), None)
    assert exp.status == "PENDING"
    line = await asvc._get_line(eid)
    assert line.currentStep == 1  # 아직 레벨1

    # B도 승인 → 레벨1 완료 → 전진
    exp = await asvc.approve(eid, _actor(u["검토B"]), None)
    assert exp.status == "APPROVED_STEP_1"
    line = await asvc._get_line(eid)
    assert line.currentStep == 2

    # 최종 승인 → FINAL
    exp = await asvc.approve(eid, _actor(u["최종"]), None)
    assert exp.status == "APPROVED_FINAL"


async def test_parallel_reject_rejects_all(session: AsyncSession):
    t, u = await _tenant_users(session, ["신청", "검토A", "검토B"])
    session.add(ApprovalPolicy(
        tenantId=t.id, name="p", isDefault=True, steps=[
            _fixed("검토A", u["검토A"]),
            _fixed("검토B", u["검토B"], parallel=True),
        ],
    ))
    await session.flush()
    eid = await _create_expense(session, t.id, u["신청"], 1000)
    asvc = ApprovalService(session, t.id)
    await asvc.submit(eid, _actor(u["신청"]), SubmitRequest())
    await asvc.approve(eid, _actor(u["검토A"]), None)  # A 승인
    exp = await asvc.reject(eid, _actor(u["검토B"]), "반대")  # B 반려 → 전체 반려
    assert exp.status == "REJECTED"


# ── 대리결재 ──────────────────────────────────────────────────────────
async def test_delegation(session: AsyncSession):
    t, u = await _tenant_users(session, ["신청", "팀장", "대리인"])
    session.add(ApprovalPolicy(
        tenantId=t.id, name="p", isDefault=True, steps=[_fixed("팀장", u["팀장"])],
    ))
    await session.flush()
    eid = await _create_expense(session, t.id, u["신청"], 1000)
    asvc = ApprovalService(session, t.id)
    await asvc.submit(eid, _actor(u["신청"]), SubmitRequest())

    # 대리인은 아직 승인 불가
    with pytest.raises(WorkflowError) as e:
        await asvc.approve(eid, _actor(u["대리인"]), None)
    assert e.value.status_code == 403

    # 팀장이 대리인에게 위임
    await asvc.delegate(eid, _actor(u["팀장"]), 1, "대리인", "휴가")
    # 이제 대리인이 승인 가능 → FINAL
    exp = await asvc.approve(eid, _actor(u["대리인"]), None)
    assert exp.status == "APPROVED_FINAL"


async def test_only_assigned_can_delegate(session: AsyncSession):
    t, u = await _tenant_users(session, ["신청", "팀장", "타인"])
    session.add(ApprovalPolicy(
        tenantId=t.id, name="p", isDefault=True, steps=[_fixed("팀장", u["팀장"])],
    ))
    await session.flush()
    eid = await _create_expense(session, t.id, u["신청"], 1000)
    asvc = ApprovalService(session, t.id)
    await asvc.submit(eid, _actor(u["신청"]), SubmitRequest())
    with pytest.raises(WorkflowError) as e:
        await asvc.delegate(eid, _actor(u["타인"]), 1, "대리인", "무단")
    assert e.value.status_code == 403
