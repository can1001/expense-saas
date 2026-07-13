"""Phase 3 검증 — 금액 계산, 결재 엔진, 지출 CRUD, 결재 워크플로우, 격리."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.dependencies.auth import CurrentUser
from expense_api.core.domain.amount import calculate_amount, calculate_request_amount
from expense_api.core.domain.approval_engine import (
    calculate_approval_status,
    calculate_next_step,
    can_approve,
)
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.schemas.approval import ApprovalStepInput, SubmitRequest
from expense_api.core.schemas.expense import CreateExpenseRequest, ExpenseItemInput
from expense_api.core.service.approval_service import ApprovalService, WorkflowError
from expense_api.core.service.expense_service import ExpenseService


# ── 금액 계산 ─────────────────────────────────────────────────────────
def test_calculate_amount():
    assert calculate_amount(1000, 3) == 3000
    assert calculate_amount(0 + 500, 2) == 1000


def test_calculate_request_amount():
    assert calculate_request_amount([3000, 1000, 500]) == 4500
    assert calculate_request_amount([]) == 0


# ── 결재 엔진 (순수 로직) ─────────────────────────────────────────────
def test_approval_status_transitions():
    assert calculate_approval_status("SUBMIT", 0, 3) == "PENDING"
    assert calculate_approval_status("APPROVE", 1, 3) == "APPROVED_STEP_1"
    assert calculate_approval_status("APPROVE", 2, 3) == "APPROVED_STEP_2"
    assert calculate_approval_status("APPROVE", 3, 3) == "APPROVED_FINAL"
    assert calculate_approval_status("APPROVE", 1, 1) == "APPROVED_FINAL"  # 1단계 라인
    assert calculate_approval_status("REJECT", 1, 3) == "REJECTED"
    assert calculate_approval_status("WITHDRAW", 0, 0) == "DRAFT"


def test_calculate_next_step():
    a = calculate_next_step(1, 3, "APPROVE")
    assert a.next_step == 2 and not a.is_complete
    n = calculate_next_step(3, 3, "APPROVE")
    assert n.next_step == 3 and n.is_complete
    r = calculate_next_step(2, 3, "REJECT")
    assert r.next_step == 2 and not r.is_complete


def test_can_approve():
    assert can_approve("김팀장", "김팀장", 1, 1).allowed
    assert not can_approve("이회계", "김팀장", 1, 1).allowed  # 지정 결재자 아님
    assert not can_approve("김팀장", "김팀장", 1, 2).allowed  # 차례 아님


# ── DB 픽스처 ─────────────────────────────────────────────────────────
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


def _actor(user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        tenantId=user.tenantId,
        userid=user.userid,
        username=user.username,
        role=user.role,
        roles=[user.role],
    )


async def _seed(session: AsyncSession):
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    owner = User(tenantId=t.id, userid="owner", username="작성자", role="user")
    leader = User(tenantId=t.id, userid="leader", username="김팀장", role="team_leader")
    finance = User(tenantId=t.id, userid="fin", username="박재정", role="finance_head")
    session.add_all([owner, leader, finance])
    await session.flush()
    return t, owner, leader, finance


def _expense_req() -> CreateExpenseRequest:
    from datetime import datetime, timezone

    return CreateExpenseRequest(
        committee="기획본부",
        department="재정팀",
        items=[
            ExpenseItemInput(
                budgetDetail="간식비", description="회의 간식", unitPrice=1000, quantity=3
            ),
            ExpenseItemInput(budgetDetail="다과비", description="다과", unitPrice=500, quantity=2),
        ],
        requestDate=datetime(2026, 7, 13, tzinfo=timezone.utc),
        applicantName="작성자",
        bankName="국민",
        accountNumber="123",
        accountHolder="작성자",
    )


# ── 지출 생성/조회 ────────────────────────────────────────────────────
async def test_create_expense_amount_and_draft(session: AsyncSession):
    t, owner, *_ = await _seed(session)
    svc = ExpenseService(session, t.id)
    exp = await svc.create(owner.id, _expense_req())
    assert exp.status == "DRAFT"
    assert exp.requestAmount == 3000 + 1000  # 서버 계산 합산
    assert exp.items[0].amount == 3000
    assert len(exp.items) == 2


async def test_expense_tenant_isolation(session: AsyncSession):
    t, owner, *_ = await _seed(session)
    other = Tenant(name="Other", subdomain="o")
    session.add(other)
    await session.flush()
    svc = ExpenseService(session, t.id)
    exp = await svc.create(owner.id, _expense_req())
    # 다른 테넌트 서비스로는 조회 불가
    other_svc = ExpenseService(session, other.id)
    assert (await other_svc.get(exp.id)) is None


# ── 결재 워크플로우 ───────────────────────────────────────────────────
async def _create_and_submit(session, t, owner, steps) -> str:
    exp = await ExpenseService(session, t.id).create(owner.id, _expense_req())
    await ApprovalService(session, t.id).submit(exp.id, _actor(owner), SubmitRequest(steps=steps))
    return exp.id


async def test_full_approval_flow(session: AsyncSession):
    t, owner, leader, finance = await _seed(session)
    steps = [
        ApprovalStepInput(stepNumber=1, stepName="팀장", approverName="김팀장"),
        ApprovalStepInput(stepNumber=2, stepName="재정팀장", approverName="박재정"),
    ]
    eid = await _create_and_submit(session, t, owner, steps)
    asvc = ApprovalService(session, t.id)

    # 제출 후 PENDING
    exp = await asvc._get_expense(eid)
    assert exp.status == "PENDING"

    # 잘못된 결재자(2차 결재자가 1차 시도) → 403
    with pytest.raises(WorkflowError) as e:
        await asvc.approve(eid, _actor(finance), None)
    assert e.value.status_code == 403

    # 1차 승인 (김팀장) → APPROVED_STEP_1
    exp = await asvc.approve(eid, _actor(leader), None)
    assert exp.status == "APPROVED_STEP_1"

    # 2차 승인 (박재정) → APPROVED_FINAL
    exp = await asvc.approve(eid, _actor(finance), None)
    assert exp.status == "APPROVED_FINAL"
    assert exp.approvedAt is not None


async def test_reject_flow(session: AsyncSession):
    t, owner, leader, _ = await _seed(session)
    steps = [ApprovalStepInput(stepNumber=1, stepName="팀장", approverName="김팀장")]
    eid = await _create_and_submit(session, t, owner, steps)
    exp = await ApprovalService(session, t.id).reject(eid, _actor(leader), "예산 초과")
    assert exp.status == "REJECTED"
    assert exp.rejectedAt is not None


async def test_withdraw_flow(session: AsyncSession):
    t, owner, leader, _ = await _seed(session)
    steps = [ApprovalStepInput(stepNumber=1, stepName="팀장", approverName="김팀장")]
    eid = await _create_and_submit(session, t, owner, steps)
    asvc = ApprovalService(session, t.id)
    exp = await asvc.withdraw(eid, _actor(owner))
    assert exp.status == "DRAFT"
    assert exp.submittedAt is None
    assert (await asvc._get_line(eid)) is None  # 결재선 삭제됨


async def test_only_owner_can_submit(session: AsyncSession):
    t, owner, leader, _ = await _seed(session)
    exp = await ExpenseService(session, t.id).create(owner.id, _expense_req())
    steps = [ApprovalStepInput(stepNumber=1, stepName="팀장", approverName="김팀장")]
    with pytest.raises(WorkflowError) as e:
        await ApprovalService(session, t.id).submit(
            exp.id, _actor(leader), SubmitRequest(steps=steps)
        )
    assert e.value.status_code == 403


async def test_cannot_submit_twice(session: AsyncSession):
    t, owner, leader, _ = await _seed(session)
    steps = [ApprovalStepInput(stepNumber=1, stepName="팀장", approverName="김팀장")]
    eid = await _create_and_submit(session, t, owner, steps)
    with pytest.raises(WorkflowError) as e:
        await ApprovalService(session, t.id).submit(eid, _actor(owner), SubmitRequest(steps=steps))
    assert e.value.status_code == 400  # 이미 DRAFT 아님
