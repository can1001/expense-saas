"""결재 워크플로우 라우터 — 제출/승인/반려/회수.
(app/api/expenses/[id]/{submit,approve,reject,withdraw} 이전)
mount prefix: /api/expenses
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.schemas.approval import (
    ApprovalLineOut,
    ApprovalStepOut,
    ApproveRequest,
    DelegateRequest,
    RejectRequest,
    SubmitRequest,
    WorkflowResult,
)
from expense_api.core.models.enums import NotificationEventType
from expense_api.core.service.approval_service import ApprovalService, WorkflowError
from expense_api.core.service.notification_service import NotificationService

router = APIRouter()


def _result(expense) -> WorkflowResult:
    return WorkflowResult(expenseId=expense.id, status=expense.status)


async def _notify(session: AsyncSession, tenant_id: str, expense, event: str, comment: str | None = None):
    """워크플로우 액션 후 관련자에게 알림 (실패해도 워크플로우엔 영향 없음)."""
    await NotificationService(session, tenant_id).notify_approval_event(expense, event, comment)
    await session.commit()


@router.post("/{expense_id}/submit", response_model=WorkflowResult)
async def submit(
    expense_id: str,
    body: SubmitRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> WorkflowResult:
    try:
        expense = await ApprovalService(session, tenant_id).submit(expense_id, user, body)
    except WorkflowError as e:
        raise HTTPException(e.status_code, e.message)
    await _notify(session, tenant_id, expense, NotificationEventType.SUBMIT.value)
    return _result(expense)


@router.post("/{expense_id}/approve", response_model=WorkflowResult)
async def approve(
    expense_id: str,
    body: ApproveRequest,
    user: CurrentUser = Depends(require_permission(PERMISSIONS.EXPENSE_APPROVE)),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> WorkflowResult:
    try:
        expense = await ApprovalService(session, tenant_id).approve(expense_id, user, body.comment)
    except WorkflowError as e:
        raise HTTPException(e.status_code, e.message)
    await _notify(session, tenant_id, expense, NotificationEventType.APPROVE.value)
    return _result(expense)


@router.post("/{expense_id}/reject", response_model=WorkflowResult)
async def reject(
    expense_id: str,
    body: RejectRequest,
    user: CurrentUser = Depends(require_permission(PERMISSIONS.EXPENSE_APPROVE)),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> WorkflowResult:
    try:
        expense = await ApprovalService(session, tenant_id).reject(expense_id, user, body.comment)
    except WorkflowError as e:
        raise HTTPException(e.status_code, e.message)
    await _notify(session, tenant_id, expense, NotificationEventType.REJECT.value, body.comment)
    return _result(expense)


@router.post("/{expense_id}/delegate")
async def delegate(
    expense_id: str,
    body: DelegateRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        step = await ApprovalService(session, tenant_id).delegate(
            expense_id, user, body.stepNumber, body.delegatedTo, body.reason
        )
    except WorkflowError as e:
        raise HTTPException(e.status_code, e.message)
    return {"stepNumber": step.stepNumber, "delegatedTo": step.delegatedTo}


@router.post("/{expense_id}/withdraw", response_model=WorkflowResult)
async def withdraw(
    expense_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> WorkflowResult:
    try:
        expense = await ApprovalService(session, tenant_id).withdraw(expense_id, user)
    except WorkflowError as e:
        raise HTTPException(e.status_code, e.message)
    return _result(expense)


@router.get("/{expense_id}/approval", response_model=ApprovalLineOut)
async def get_approval_line(
    expense_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ApprovalLineOut:
    svc = ApprovalService(session, tenant_id)
    # 지출결의서 존재/테넌트 확인
    try:
        await svc._get_expense(expense_id)
    except WorkflowError as e:
        raise HTTPException(e.status_code, e.message)
    line = await svc._get_line(expense_id)
    if line is None:
        raise HTTPException(404, "결재선이 없습니다.")
    steps = await svc._get_steps(line.id)
    return ApprovalLineOut(
        expenseId=expense_id,
        currentStep=line.currentStep,
        totalSteps=line.totalSteps,
        isUrgent=line.isUrgent,
        steps=[
            ApprovalStepOut(
                stepNumber=s.stepNumber,
                stepName=s.stepName,
                approverName=s.approverName,
                status=s.status,
                approvedAt=s.approvedAt,
                rejectedAt=s.rejectedAt,
                comment=s.comment,
                isParallel=s.isParallel,
                delegatedTo=s.delegatedTo,
            )
            for s in steps
        ],
    )
