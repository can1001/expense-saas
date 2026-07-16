"""Phase 4 검증 — 알림 서비스(선호 게이팅, 결재 이벤트 연동, 로그, 격리)."""

from datetime import datetime, timezone

import pytest_asyncio
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.dependencies.auth import CurrentUser
from expense_api.core.models.enums import NotificationEventType
from expense_api.core.models.notification import NotificationLog, NotificationPreference
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.schemas.approval import ApprovalStepInput, SubmitRequest
from expense_api.core.schemas.expense import CreateExpenseRequest, ExpenseItemInput
from expense_api.core.service.approval_service import ApprovalService
from expense_api.core.service.expense_service import ExpenseService
from expense_api.core.service.notification_service import NotificationService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
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
        yield s
    await engine.dispose()


def _actor(u: User) -> CurrentUser:
    return CurrentUser(
        id=u.id, tenantId=u.tenantId, userid=u.userid, username=u.username, role=u.role, roles=[u.role]
    )


async def _seed(session):
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    applicant = User(tenantId=t.id, userid="a", username="신청자", role="user")
    leader = User(tenantId=t.id, userid="l", username="김팀장", role="team_leader")
    session.add_all([applicant, leader])
    await session.flush()
    return t, applicant, leader


async def _submit(session, tid, applicant, approver_name="김팀장"):
    req = CreateExpenseRequest(
        committee="본부", department="팀",
        items=[ExpenseItemInput(budgetDetail="세목", description="적요", unitPrice=5000, quantity=1)],
        requestDate=datetime(2026, 3, 1, tzinfo=timezone.utc),
        applicantName=applicant.username, bankName="국민", accountNumber="1", accountHolder=applicant.username,
    )
    exp = await ExpenseService(session, tid).create(applicant.id, req)
    await ApprovalService(session, tid).submit(
        exp.id, _actor(applicant),
        SubmitRequest(steps=[ApprovalStepInput(stepNumber=1, stepName="팀장", approverName=approver_name)]),
    )
    return exp


async def _logs_for(session, tid, name):
    stmt = select(NotificationLog).where(
        NotificationLog.tenantId == tid, NotificationLog.recipientName == name
    )
    return list((await session.execute(stmt)).scalars().all())


# ── 결재 이벤트 연동 ──────────────────────────────────────────────────
async def test_submit_notifies_current_approver(session: AsyncSession):
    t, applicant, leader = await _seed(session)
    exp = await _submit(session, t.id, applicant)
    logs = await NotificationService(session, t.id).notify_approval_event(
        exp, NotificationEventType.SUBMIT.value
    )
    await session.commit()
    assert any(log.recipientName == "김팀장" for log in logs)
    db_logs = await _logs_for(session, t.id, "김팀장")
    assert db_logs and db_logs[0].eventType == "SUBMIT" and db_logs[0].status == "SENT"


async def test_reject_notifies_applicant(session: AsyncSession):
    t, applicant, leader = await _seed(session)
    exp = await _submit(session, t.id, applicant)
    await ApprovalService(session, t.id).reject(exp.id, _actor(leader), "보완요망")
    exp = await ApprovalService(session, t.id)._get_expense(exp.id)
    await NotificationService(session, t.id).notify_approval_event(
        exp, NotificationEventType.REJECT.value, "보완요망"
    )
    await session.commit()
    logs = await _logs_for(session, t.id, "신청자")
    assert logs and logs[0].eventType == "REJECT"
    assert "보완요망" in logs[0].message


async def test_approve_final_notifies_applicant(session: AsyncSession):
    t, applicant, leader = await _seed(session)
    exp = await _submit(session, t.id, applicant)  # 1단계 라인
    await ApprovalService(session, t.id).approve(exp.id, _actor(leader), None)
    exp = await ApprovalService(session, t.id)._get_expense(exp.id)
    assert exp.status == "APPROVED_FINAL"
    await NotificationService(session, t.id).notify_approval_event(
        exp, NotificationEventType.APPROVE.value
    )
    await session.commit()
    logs = await _logs_for(session, t.id, "신청자")
    assert any("최종승인" in log.message for log in logs)


# ── 선호(preference) 게이팅 ───────────────────────────────────────────
async def test_event_disabled_suppresses_notification(session: AsyncSession):
    t, applicant, leader = await _seed(session)
    # 김팀장: onSubmit 끔
    session.add(NotificationPreference(tenantId=t.id, userId=leader.id, onSubmit=False))
    await session.flush()
    exp = await _submit(session, t.id, applicant)
    await NotificationService(session, t.id).notify_approval_event(exp, NotificationEventType.SUBMIT.value)
    await session.commit()
    assert await _logs_for(session, t.id, "김팀장") == []  # 알림 없음


async def test_channel_selection(session: AsyncSession):
    t, applicant, leader = await _seed(session)
    # 3채널 모두 활성 → 3건 로그
    session.add(NotificationPreference(
        tenantId=t.id, userId=leader.id, smsEnabled=True, kakaoEnabled=True, webPushEnabled=True
    ))
    await session.flush()
    exp = await _submit(session, t.id, applicant)
    await NotificationService(session, t.id).notify_approval_event(exp, NotificationEventType.SUBMIT.value)
    await session.commit()
    channels = {log.channel for log in await _logs_for(session, t.id, "김팀장")}
    assert channels == {"WEB_PUSH", "SMS", "KAKAO"}


async def test_default_pref_webpush_only(session: AsyncSession):
    t, applicant, leader = await _seed(session)
    exp = await _submit(session, t.id, applicant)  # 선호 없음 → 기본 웹푸시만
    await NotificationService(session, t.id).notify_approval_event(exp, NotificationEventType.SUBMIT.value)
    await session.commit()
    logs = await _logs_for(session, t.id, "김팀장")
    assert {log.channel for log in logs} == {"WEB_PUSH"}


async def test_notification_tenant_isolation(session: AsyncSession):
    t, applicant, leader = await _seed(session)
    other = Tenant(name="O", subdomain="o")
    session.add(other)
    await session.flush()
    exp = await _submit(session, t.id, applicant)
    await NotificationService(session, t.id).notify_approval_event(exp, NotificationEventType.SUBMIT.value)
    await session.commit()
    # 다른 테넌트 로그엔 안 보임
    assert await _logs_for(session, other.id, "김팀장") == []
