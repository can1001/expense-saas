"""지출결의서 조회 보조·지급상태 라우터.
(app/api/expenses/filter-options, [id]/fix-status, [id]/payment-status 이전)
mount prefix: /api/expenses — filter-options 는 expense_routes 의 :id 라우트보다
먼저 등록되어야 하므로 main.py 에서 expense_routes 보다 앞서 include 한다.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS, has_permission
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.approval import ApprovalLog
from expense_api.core.models.enums import ApprovalAction, ApprovalStatus, NotificationEventType, StepStatus
from expense_api.core.models.expense import Expense
from expense_api.core.models.ids import utcnow
from expense_api.core.models.user import UserSignature
from expense_api.core.schemas.expense import (
    FilterOptionsOut,
    PaymentStatusDataOut,
    PaymentStatusGetOut,
    UpdatePaymentStatusOut,
    UpdatePaymentStatusRequest,
)
from expense_api.core.service.approval_service import ApprovalService, WorkflowError
from expense_api.core.service.expense_service import ExpenseService
from expense_api.core.service.notification_service import NotificationService

router = APIRouter()

_PAYMENT_STATUS_LABELS = {
    "PENDING": "지급 대기",
    "HOLD": "지급 보류",
    "CANCELLED": "지급 취소",
    "COMPLETED": "지급 완료",
}
_PAYMENT_STATUS_MESSAGES = {
    "PENDING": "지급 대기로 변경되었습니다.",
    "HOLD": "지급 보류로 변경되었습니다.",
    "CANCELLED": "지급 취소로 변경되었습니다.",
    "COMPLETED": "지급 완료로 변경되었습니다.",
}


@router.get("/filter-options", response_model=FilterOptionsOut)
async def get_filter_options(
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> FilterOptionsOut:
    svc = ExpenseService(session, tenant_id)
    only_user_id, only_department = await svc.resolve_read_scope(user, utcnow().year)
    committees, departments, categories = await svc.repo.filter_options(
        only_user_id=only_user_id, only_department=only_department
    )
    return FilterOptionsOut(committees=committees, departments=departments, budgetCategories=categories)


@router.post("/{expense_id}/fix-status")
async def fix_status(
    expense_id: str,
    user: CurrentUser = Depends(require_permission(PERMISSIONS.EXPENSE_PAYMENT_MANAGE)),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """결재 상태 자동 수정 (관리자 전용). (app/api/expenses/[id]/fix-status 이전)"""
    svc = ApprovalService(session, tenant_id)
    try:
        expense = await svc._get_expense(expense_id)
    except WorkflowError as e:
        raise HTTPException(e.status_code, e.message) from e
    line = await svc._get_line(expense_id)
    if line is None:
        raise HTTPException(400, "결재선이 없습니다.")
    steps = await svc._get_steps(line.id)

    # 스냅샷에서 연속된 전결(자동승인) 단계만 찾기 (1차부터 연속으로)
    snapshot = line.snapshot or {}
    consecutive_auto_approved: set[int] = set()
    for s in snapshot.get("steps", []):
        if s.get("isAutoApproved"):
            consecutive_auto_approved.add(s["stepNumber"])
        else:
            break

    # 연속된 전결이 아닌데 APPROVED 인 단계는 PENDING 으로 되돌림
    steps_to_fix = [
        s for s in steps if s.stepNumber not in consecutive_auto_approved and s.status == StepStatus.APPROVED.value
    ]
    for s in steps_to_fix:
        s.status = StepStatus.PENDING.value
        s.approvedAt = None
        s.comment = None
        session.add(s)

    approved_steps = [s for s in steps if s.status == StepStatus.APPROVED.value]
    pending_steps = [s for s in steps if s.status == StepStatus.PENDING.value]

    if not pending_steps:
        correct_status = ApprovalStatus.APPROVED_FINAL.value
    elif not approved_steps:
        correct_status = ApprovalStatus.PENDING.value
    elif len(approved_steps) == 1:
        correct_status = ApprovalStatus.APPROVED_STEP_1.value
    elif len(approved_steps) == 2:
        correct_status = ApprovalStatus.APPROVED_STEP_2.value
    else:
        correct_status = ApprovalStatus.APPROVED_FINAL.value

    first_pending = pending_steps[0] if pending_steps else None
    correct_current_step = first_pending.stepNumber if first_pending else line.totalSteps

    if line.currentStep != correct_current_step:
        line.currentStep = correct_current_step
        session.add(line)

    if expense.status == correct_status and not steps_to_fix:
        await session.commit()
        return {
            "success": True,
            "message": "상태가 이미 올바릅니다.",
            "currentStatus": expense.status,
            "approvedStepsCount": len(approved_steps),
            "pendingStepsCount": len(pending_steps),
        }

    previous_status = expense.status
    expense.status = correct_status
    expense.approvedAt = utcnow() if correct_status == ApprovalStatus.APPROVED_FINAL.value else None
    session.add(expense)
    await session.commit()
    await session.refresh(expense)

    return {
        "success": True,
        "message": (
            f"{len(steps_to_fix)}개 단계가 수정되었고 상태가 {correct_status}로 변경되었습니다."
            if steps_to_fix
            else f"상태가 {correct_status}로 수정되었습니다."
        ),
        "previousStatus": previous_status,
        "newStatus": expense.status,
        "fixedSteps": len(steps_to_fix),
        "correctCurrentStep": correct_current_step,
        "approvedStepsCount": len(approved_steps),
        "pendingSteps": [
            {"stepNumber": s.stepNumber, "stepName": s.stepName, "approverName": s.approverName}
            for s in pending_steps
        ],
    }


@router.get("/{expense_id}/payment-status", response_model=PaymentStatusGetOut)
async def get_payment_status(
    expense_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> PaymentStatusGetOut:
    stmt = select(Expense).where(Expense.tenantId == tenant_id, Expense.id == expense_id)
    expense = (await session.execute(stmt)).scalars().first()
    if expense is None:
        raise HTTPException(404, "지출결의서를 찾을 수 없습니다.")
    return PaymentStatusGetOut(
        id=expense.id,
        status=expense.status,
        paymentStatus=expense.paymentStatus,
        paymentCompletedAt=expense.paymentCompletedAt,
        paymentCompletedBy=expense.paymentCompletedBy,
        paymentNote=expense.paymentNote,
    )


@router.put("/{expense_id}/payment-status", response_model=UpdatePaymentStatusOut)
async def update_payment_status(
    expense_id: str,
    body: UpdatePaymentStatusRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> UpdatePaymentStatusOut:
    """지출 상태(지급상태) 변경. (app/api/expenses/[id]/payment-status PUT 이전)

    지급상태 변경 권한은 연도별 유효 역할(UserYearRole) 기준 — withPermissions 가 아닌
    getEffectiveRole 기반 원본 계약을 그대로 재현한다.
    """
    esvc = ExpenseService(session, tenant_id)
    effective_role, _ = await esvc._resolve_effective_role(user, utcnow().year)
    if not has_permission([effective_role], PERMISSIONS.EXPENSE_PAYMENT_MANAGE):
        raise HTTPException(403, "지출 상태 변경 권한이 없습니다.")

    if body.paymentStatus not in _PAYMENT_STATUS_LABELS:
        raise HTTPException(400, "유효하지 않은 상태값입니다. (PENDING, HOLD, CANCELLED, COMPLETED)")

    if body.paymentStatus in ("HOLD", "CANCELLED") and not (body.reason and body.reason.strip()):
        raise HTTPException(
            400, "보류 사유를 입력해주세요." if body.paymentStatus == "HOLD" else "취소 사유를 입력해주세요."
        )

    stmt = select(Expense).where(Expense.tenantId == tenant_id, Expense.id == expense_id)
    expense = (await session.execute(stmt)).scalars().first()
    if expense is None:
        raise HTTPException(404, "지출결의서를 찾을 수 없습니다.")

    if expense.status != ApprovalStatus.APPROVED_FINAL.value:
        raise HTTPException(400, "최종 승인된 지출결의서만 지출 상태를 변경할 수 있습니다.")

    if expense.paymentStatus == body.paymentStatus:
        raise HTTPException(400, f"이미 {_PAYMENT_STATUS_LABELS[body.paymentStatus]} 상태입니다.")

    now = utcnow()
    previous_payment_status = expense.paymentStatus
    expense.paymentNote = body.note or None

    if body.paymentStatus == "COMPLETED":
        expense.paymentCompletedAt = now
        expense.paymentCompletedBy = user.username
        if body.expenseDate:
            expense.expenseDate = body.expenseDate
        elif not expense.expenseDate:
            expense.expenseDate = now
        expense.paymentHoldReason = None
        expense.paymentHoldAt = None
        expense.paymentHoldBy = None

        if body.signature:
            if body.signature.signatureId:
                sig = await session.get(UserSignature, body.signature.signatureId)
                if sig:
                    expense.paymentSignatureType = sig.type
                    expense.paymentSignatureData = sig.imageData
            elif body.signature.data:
                expense.paymentSignatureType = body.signature.type or "signature"
                expense.paymentSignatureData = body.signature.data
    elif body.paymentStatus in ("HOLD", "CANCELLED"):
        expense.paymentHoldReason = body.reason
        expense.paymentHoldAt = now
        expense.paymentHoldBy = user.username
        expense.paymentCompletedAt = None
        expense.paymentCompletedBy = None
    else:  # PENDING 으로 되돌림 — 모든 정보 초기화
        expense.paymentCompletedAt = None
        expense.paymentCompletedBy = None
        expense.paymentHoldReason = None
        expense.paymentHoldAt = None
        expense.paymentHoldBy = None
        expense.paymentSignatureType = None
        expense.paymentSignatureData = None
        expense.expenseDate = None

    expense.paymentStatus = body.paymentStatus
    session.add(expense)

    action_map = {
        "COMPLETED": (ApprovalAction.PAYMENT_COMPLETE.value, "지급 완료 처리"),
        "HOLD": (ApprovalAction.PAYMENT_HOLD.value, f"지급 보류: {body.reason}"),
        "CANCELLED": (ApprovalAction.PAYMENT_CANCEL.value, f"지급 취소: {body.reason}"),
    }
    action, default_comment = action_map.get(
        body.paymentStatus, (ApprovalAction.PAYMENT_REVERT.value, "지급 대기로 되돌림")
    )

    session.add(
        ApprovalLog(
            tenantId=tenant_id,
            expenseId=expense_id,
            action=action,
            actorName=user.username,
            actorEmail=user.userid,
            actorRole=user.role,
            previousStatus=previous_payment_status,
            newStatus=body.paymentStatus,
            comment=body.note or default_comment,
            metadata_={
                "userAgent": request.headers.get("user-agent") or "",
                "timestamp": now.isoformat(),
                "reason": body.reason or None,
            },
        )
    )

    if body.paymentStatus == "COMPLETED":
        notif = NotificationService(session, tenant_id)
        applicant = await notif._resolve_user_by_name(expense.applicantName)
        if applicant:
            amount = f"{expense.requestAmount:,}원"
            await notif.notify(
                recipient=applicant,
                event=NotificationEventType.PAYMENT_COMPLETE.value,
                message=f"[지급완료] {expense.applicantName}님의 지출결의서 지급이 완료되었습니다. ({amount})",
                expense_id=expense_id,
            )

    await session.commit()
    await session.refresh(expense)

    return UpdatePaymentStatusOut(
        success=True,
        message=_PAYMENT_STATUS_MESSAGES[body.paymentStatus],
        data=PaymentStatusDataOut(
            id=expense.id,
            paymentStatus=expense.paymentStatus,
            paymentCompletedAt=expense.paymentCompletedAt,
            paymentCompletedBy=expense.paymentCompletedBy,
            paymentNote=expense.paymentNote,
            paymentHoldReason=expense.paymentHoldReason,
            paymentHoldAt=expense.paymentHoldAt,
            paymentHoldBy=expense.paymentHoldBy,
            paymentSignatureType=expense.paymentSignatureType,
            paymentSignatureData=expense.paymentSignatureData,
            expenseDate=expense.expenseDate,
        ),
    )
