"""RESUBMIT / MODIFY_LINE 검증."""

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.dependencies.auth import CurrentUser
from expense_api.core.models.approval import ApprovalLog
from expense_api.core.models.enums import ApprovalAction
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.schemas.approval import ApprovalStepInput, SubmitRequest
from expense_api.core.schemas.expense import CreateExpenseRequest, ExpenseItemInput
from expense_api.core.service.approval_service import ApprovalService, WorkflowError
from expense_api.core.service.expense_service import ExpenseService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    # 실앱과 동일하게 FK 강제 (삭제 순서 버그를 테스트가 잡도록)
    @event.listens_for(engine.sync_engine, "connect")
    def _fk_on(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


def _actor(u: User) -> CurrentUser:
    return CurrentUser(
        id=u.id, tenantId=u.tenantId, userid=u.userid, username=u.username, role=u.role, roles=[u.role]
    )


async def _seed(session, names):
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


async def _create(session, tid, applicant) -> str:
    req = CreateExpenseRequest(
        committee="본부", department="팀",
        items=[ExpenseItemInput(budgetDetail="세목", description="적요", unitPrice=1000, quantity=1)],
        requestDate=datetime(2026, 3, 1, tzinfo=timezone.utc),
        applicantName=applicant.username, bankName="국민", accountNumber="1", accountHolder=applicant.username,
    )
    exp = await ExpenseService(session, tid).create(applicant.id, req)
    return exp.id


def _step(n, name, approver):
    return ApprovalStepInput(stepNumber=n, stepName=name, approverName=approver)


# ── RESUBMIT ──────────────────────────────────────────────────────────
async def test_resubmit_after_reject(session: AsyncSession):
    t, u = await _seed(session, ["신청", "팀장"])
    eid = await _create(session, t.id, u["신청"])
    asvc = ApprovalService(session, t.id)
    await asvc.submit(eid, _actor(u["신청"]), SubmitRequest(steps=[_step(1, "팀장", "팀장")]))
    await asvc.reject(eid, _actor(u["팀장"]), "보완요망")
    exp = await asvc._get_expense(eid)
    assert exp.status == "REJECTED"

    # 재제출 → PENDING, 새 결재선
    exp = await asvc.resubmit(eid, _actor(u["신청"]), SubmitRequest(steps=[_step(1, "팀장", "팀장")]))
    assert exp.status == "PENDING"
    assert exp.rejectedAt is None
    line = await asvc._get_line(eid)
    assert line is not None and line.currentStep == 1
    # RESUBMIT 로그 기록됨
    logs = (await session.execute(select(ApprovalLog).where(ApprovalLog.expenseId == eid))).scalars().all()
    assert any(log.action == ApprovalAction.RESUBMIT.value for log in logs)


async def test_resubmit_requires_rejected(session: AsyncSession):
    t, u = await _seed(session, ["신청", "팀장"])
    eid = await _create(session, t.id, u["신청"])
    asvc = ApprovalService(session, t.id)
    await asvc.submit(eid, _actor(u["신청"]), SubmitRequest(steps=[_step(1, "팀장", "팀장")]))
    # PENDING 상태에서 재제출 불가
    with pytest.raises(WorkflowError) as e:
        await asvc.resubmit(eid, _actor(u["신청"]), SubmitRequest(steps=[_step(1, "팀장", "팀장")]))
    assert e.value.status_code == 400


async def test_resubmit_only_owner(session: AsyncSession):
    t, u = await _seed(session, ["신청", "팀장", "타인"])
    eid = await _create(session, t.id, u["신청"])
    asvc = ApprovalService(session, t.id)
    await asvc.submit(eid, _actor(u["신청"]), SubmitRequest(steps=[_step(1, "팀장", "팀장")]))
    await asvc.reject(eid, _actor(u["팀장"]), "x")
    with pytest.raises(WorkflowError) as e:
        await asvc.resubmit(eid, _actor(u["타인"]), SubmitRequest(steps=[_step(1, "팀장", "팀장")]))
    assert e.value.status_code == 403


# ── MODIFY_LINE ───────────────────────────────────────────────────────
async def test_modify_line_replaces_remaining_preserves_completed(session: AsyncSession):
    t, u = await _seed(session, ["신청", "A", "B", "C", "X", "Y"])
    eid = await _create(session, t.id, u["신청"])
    asvc = ApprovalService(session, t.id)
    await asvc.submit(
        eid, _actor(u["신청"]),
        SubmitRequest(steps=[_step(1, "1차", "A"), _step(2, "2차", "B"), _step(3, "3차", "C")]),
    )
    # 1차(A) 승인 → currentStep 2
    await asvc.approve(eid, _actor(u["A"]), None)
    line = await asvc._get_line(eid)
    assert line.currentStep == 2

    # 잔여(2,3차)를 [X, Y]로 교체
    await asvc.modify_line(eid, _actor(u["신청"]), [_step(1, "신규2차", "X"), _step(2, "신규3차", "Y")])
    steps = await asvc._get_steps((await asvc._get_line(eid)).id)
    by_level = {s.stepNumber: s.approverName for s in steps}
    assert by_level[1] == "A"  # 완료 단계 보존
    assert by_level[2] == "X"  # 교체
    assert by_level[3] == "Y"

    # 감사 스냅샷 기록
    logs = (await session.execute(select(ApprovalLog).where(ApprovalLog.expenseId == eid))).scalars().all()
    ml = [log for log in logs if log.action == ApprovalAction.MODIFY_LINE.value]
    assert ml and ml[0].beforeSnapshot and ml[0].afterSnapshot

    # 새 결재자로 계속 진행 → FINAL
    exp = await asvc.approve(eid, _actor(u["X"]), None)
    assert exp.status == "APPROVED_STEP_2"
    exp = await asvc.approve(eid, _actor(u["Y"]), None)
    assert exp.status == "APPROVED_FINAL"


async def test_modify_line_blocked_when_current_level_started(session: AsyncSession):
    # 병렬 레벨에서 한 명이 승인해 부분 진행되면 수정 불가
    t, u = await _seed(session, ["신청", "A", "B"])
    eid = await _create(session, t.id, u["신청"])
    asvc = ApprovalService(session, t.id)
    # 병렬 2인 한 레벨 (동일 stepNumber)
    await asvc.submit(
        eid, _actor(u["신청"]),
        SubmitRequest(steps=[_step(1, "검토A", "A"), _step(1, "검토B", "B")]),
    )
    await asvc.approve(eid, _actor(u["A"]), None)  # 부분 승인
    with pytest.raises(WorkflowError) as e:
        await asvc.modify_line(eid, _actor(u["신청"]), [_step(1, "새검토", "B")])
    assert e.value.status_code == 400


async def test_modify_line_only_owner(session: AsyncSession):
    t, u = await _seed(session, ["신청", "A", "타인"])
    eid = await _create(session, t.id, u["신청"])
    asvc = ApprovalService(session, t.id)
    await asvc.submit(eid, _actor(u["신청"]), SubmitRequest(steps=[_step(1, "1차", "A")]))
    with pytest.raises(WorkflowError) as e:
        await asvc.modify_line(eid, _actor(u["타인"]), [_step(1, "새", "A")])
    assert e.value.status_code == 403
