"""지출결의서 일괄 처리 라우터.
(app/api/expenses/bulk, bulk-expense-date, bulk-payment-status 이전, B3)

mount prefix: /api/expenses — 세 경로 모두 `/{expense_id}` 와 세그먼트 수가 같은 고정
세그먼트이므로 expense_routes 의 GET/PUT/DELETE `/{expense_id}` 보다 먼저 등록해야
매칭 우선순위가 보장된다 (expense_admin_routes 와 동일한 이유).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS, has_permission
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.approval import ApprovalLine, ApprovalLog, ApprovalStep
from expense_api.core.models.enums import ApprovalAction, ApprovalStatus
from expense_api.core.models.expense import Expense, ExpenseAttachment, ExpenseItem
from expense_api.core.models.ids import utcnow
from expense_api.core.models.user import UserSignature
from expense_api.core.schemas.approval import ApprovalLineOut, ApprovalStepOut
from expense_api.core.schemas.expense import AttachmentOut, ExpenseWithAttachmentsOut
from expense_api.core.service.expense_service import ExpenseService, to_out

router = APIRouter()

_MAX_BULK_FETCH = 50


# ── 일괄 조회 (인쇄용) ────────────────────────────────────────────────


class BulkFetchRequest(BaseModel):
    ids: list[str] = Field(default_factory=list)


class BulkFetchItemOut(BaseModel):
    expense: ExpenseWithAttachmentsOut
    approvalLine: ApprovalLineOut | None


class BulkFetchOut(BaseModel):
    success: bool
    expenses: list[BulkFetchItemOut]
    total: int
    requested: int


# ── 일괄 지출일자 설정 ────────────────────────────────────────────────


class BulkExpenseDateRequest(BaseModel):
    ids: list[str] = Field(default_factory=list)
    expenseDate: str | None = None
    overwriteExisting: bool = False


class BulkExpenseDateDataOut(BaseModel):
    totalSelected: int
    actualUpdated: int
    skipped: int
    expenseDate: str


class BulkExpenseDateOut(BaseModel):
    success: bool
    message: str
    data: BulkExpenseDateDataOut


# ── 일괄 지급상태 변경 ────────────────────────────────────────────────


class BulkPaymentSignatureInput(BaseModel):
    type: str | None = None
    signatureId: str | None = None
    data: str | None = None


class BulkPaymentStatusRequest(BaseModel):
    ids: list[str] = Field(default_factory=list)
    paymentStatus: str
    note: str | None = None
    signature: BulkPaymentSignatureInput | None = None
    expenseDate: str | None = None
    overwriteExisting: bool = False


class BulkPaymentSkippedOut(BaseModel):
    notApproved: int
    alreadySameStatus: int


class BulkPaymentStatusDataOut(BaseModel):
    updatedCount: int
    skipped: BulkPaymentSkippedOut


class BulkPaymentStatusOut(BaseModel):
    success: bool
    message: str
    data: BulkPaymentStatusDataOut


def _to_attachment_out(a: ExpenseAttachment) -> AttachmentOut:
    return AttachmentOut(
        id=a.id,
        tenantId=a.tenantId,
        expenseId=a.expenseId,
        publicId=a.publicId,
        url=a.url,
        secureUrl=a.secureUrl,
        format=a.format,
        fileName=a.fileName,
        fileSize=a.fileSize,
        width=a.width,
        height=a.height,
        createdAt=a.createdAt,
    )


def _parse_date(raw: str) -> datetime:
    try:
        return datetime.fromisoformat(raw)
    except ValueError as e:
        raise HTTPException(400, "유효하지 않은 날짜 형식입니다.") from e


@router.post("/bulk", response_model=BulkFetchOut)
async def bulk_fetch(
    body: BulkFetchRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> BulkFetchOut:
    """여러 건의 지출결의서를 일괄 조회 (인쇄용). (app/api/expenses/bulk POST 이전)"""
    ids = body.ids
    if not ids:
        raise HTTPException(400, "조회할 지출결의서 ID를 선택해주세요.")
    if len(ids) > _MAX_BULK_FETCH:
        raise HTTPException(400, "한 번에 최대 50건까지 조회할 수 있습니다.")

    stmt = select(Expense).where(Expense.tenantId == tenant_id, Expense.id.in_(ids))
    expenses_by_id = {e.id: e for e in (await session.execute(stmt)).scalars().all()}

    results: list[BulkFetchItemOut] = []
    for expense_id in ids:
        expense = expenses_by_id.get(expense_id)
        if expense is None:
            continue

        items_stmt = (
            select(ExpenseItem).where(ExpenseItem.expenseId == expense_id).order_by(ExpenseItem.order)
        )
        items = list((await session.execute(items_stmt)).scalars().all())

        att_stmt = (
            select(ExpenseAttachment)
            .where(ExpenseAttachment.expenseId == expense_id)
            .order_by(ExpenseAttachment.createdAt)
        )
        attachments = list((await session.execute(att_stmt)).scalars().all())

        line_stmt = select(ApprovalLine).where(ApprovalLine.expenseId == expense_id)
        line = (await session.execute(line_stmt)).scalars().first()

        approval_line_out: ApprovalLineOut | None = None
        if line is not None:
            steps_stmt = (
                select(ApprovalStep)
                .where(ApprovalStep.approvalLineId == line.id)
                .order_by(ApprovalStep.stepNumber)
            )
            steps = list((await session.execute(steps_stmt)).scalars().all())
            approval_line_out = ApprovalLineOut(
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

        results.append(
            BulkFetchItemOut(
                expense=ExpenseWithAttachmentsOut(
                    **to_out(expense, items).model_dump(),
                    attachments=[_to_attachment_out(a) for a in attachments],
                ),
                approvalLine=approval_line_out,
            )
        )

    return BulkFetchOut(success=True, expenses=results, total=len(results), requested=len(ids))


@router.put("/bulk-expense-date", response_model=BulkExpenseDateOut)
async def bulk_expense_date(
    body: BulkExpenseDateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> BulkExpenseDateOut:
    """일괄 지출일자 설정. (app/api/expenses/bulk-expense-date PUT 이전)"""
    svc = ExpenseService(session, tenant_id)
    effective_role, _ = await svc._resolve_effective_role(user, utcnow().year)
    if not has_permission([effective_role], PERMISSIONS.EXPENSE_PAYMENT_MANAGE):
        raise HTTPException(403, "지출일자 변경 권한이 없습니다.")

    ids = body.ids
    if not ids:
        raise HTTPException(400, "변경할 지출결의서를 선택해주세요.")
    if not body.expenseDate:
        raise HTTPException(400, "지출일자를 입력해주세요.")
    date_value = _parse_date(body.expenseDate)

    now = utcnow()
    stmt = select(Expense).where(Expense.tenantId == tenant_id, Expense.id.in_(ids))
    expenses = list((await session.execute(stmt)).scalars().all())
    if not expenses:
        raise HTTPException(404, "지출결의서를 찾을 수 없습니다.")

    targets = expenses if body.overwriteExisting else [e for e in expenses if e.expenseDate is None]
    if not targets:
        raise HTTPException(400, "변경할 항목이 없습니다. 모든 항목에 이미 지출일자가 설정되어 있습니다.")

    target_ids = [e.id for e in targets]
    for e in targets:
        e.expenseDate = date_value
        session.add(e)

    session.add(
        ApprovalLog(
            tenantId=tenant_id,
            expenseId=target_ids[0],
            action=ApprovalAction.BULK_EXPENSE_DATE_UPDATE.value,
            actorName=user.username,
            actorEmail=user.userid,
            actorRole=user.role,
            newStatus="EXPENSE_DATE_UPDATED",
            comment=f"일괄 지출일자 설정: {body.expenseDate} ({len(target_ids)}건)",
            metadata_={
                "bulkOperation": True,
                "totalSelected": len(ids),
                "actualUpdated": len(target_ids),
                "expenseDate": body.expenseDate,
                "overwriteExisting": body.overwriteExisting,
                "updatedIds": target_ids,
                "userAgent": request.headers.get("user-agent") or "",
                "timestamp": now.isoformat(),
            },
        )
    )
    await session.commit()

    return BulkExpenseDateOut(
        success=True,
        message=f"{len(target_ids)}건의 지출일자가 변경되었습니다.",
        data=BulkExpenseDateDataOut(
            totalSelected=len(ids),
            actualUpdated=len(target_ids),
            skipped=len(ids) - len(target_ids),
            expenseDate=body.expenseDate,
        ),
    )


@router.put("/bulk-payment-status", response_model=BulkPaymentStatusOut)
async def bulk_payment_status(
    body: BulkPaymentStatusRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> BulkPaymentStatusOut:
    """지급 상태 일괄 변경 (지급대기 ↔ 지급완료). (app/api/expenses/bulk-payment-status PUT 이전)"""
    svc = ExpenseService(session, tenant_id)
    effective_role, _ = await svc._resolve_effective_role(user, utcnow().year)
    if not has_permission([effective_role], PERMISSIONS.EXPENSE_PAYMENT_MANAGE):
        raise HTTPException(403, "지출 상태 변경 권한이 없습니다.")

    ids = body.ids
    if not ids:
        raise HTTPException(400, "변경할 지출결의서 ID를 선택해주세요.")

    if body.paymentStatus not in ("PENDING", "COMPLETED"):
        raise HTTPException(400, "유효하지 않은 상태값입니다. (PENDING 또는 COMPLETED)")

    stmt = select(Expense).where(Expense.tenantId == tenant_id, Expense.id.in_(ids))
    expenses = list((await session.execute(stmt)).scalars().all())
    if not expenses:
        raise HTTPException(404, "지출결의서를 찾을 수 없습니다.")

    eligible = [e for e in expenses if e.status == ApprovalStatus.APPROVED_FINAL.value]
    ineligible_count = len(expenses) - len(eligible)

    to_update = [e for e in eligible if e.paymentStatus != body.paymentStatus]
    already_same_status_count = len(eligible) - len(to_update)

    if not to_update:
        raise HTTPException(400, "변경할 항목이 없습니다.")

    now = utcnow()

    signature_type: str | None = None
    signature_data: str | None = None
    if body.paymentStatus == "COMPLETED" and body.signature:
        if body.signature.signatureId:
            sig = await session.get(UserSignature, body.signature.signatureId)
            if sig:
                signature_type = sig.type
                signature_data = sig.imageData
        elif body.signature.data:
            signature_type = body.signature.type or "signature"
            signature_data = body.signature.data

    date_value = _parse_date(body.expenseDate) if body.expenseDate else None

    previous_statuses = {e.id: e.paymentStatus for e in to_update}

    for e in to_update:
        e.paymentStatus = body.paymentStatus
        e.paymentNote = body.note or None
        if body.paymentStatus == "COMPLETED":
            if date_value is not None:
                if body.overwriteExisting or e.expenseDate is None:
                    e.expenseDate = date_value
            elif e.expenseDate is None:
                e.expenseDate = now
            e.paymentCompletedAt = now
            e.paymentCompletedBy = user.username
            if signature_type is not None:
                e.paymentSignatureType = signature_type
                e.paymentSignatureData = signature_data
        else:
            e.paymentCompletedAt = None
            e.paymentCompletedBy = None
            e.paymentSignatureType = None
            e.paymentSignatureData = None
            e.expenseDate = None
        session.add(e)

    action = (
        ApprovalAction.PAYMENT_COMPLETE.value
        if body.paymentStatus == "COMPLETED"
        else ApprovalAction.PAYMENT_REVERT.value
    )
    default_comment = "지급완료 일괄 처리" if body.paymentStatus == "COMPLETED" else "지급대기로 일괄 되돌림"

    for e in to_update:
        session.add(
            ApprovalLog(
                tenantId=tenant_id,
                expenseId=e.id,
                action=action,
                actorName=user.username,
                actorEmail=user.userid,
                actorRole=user.role,
                previousStatus=previous_statuses[e.id],
                newStatus=body.paymentStatus,
                comment=body.note or default_comment,
                metadata_={
                    "bulkOperation": True,
                    "totalSelected": len(ids),
                    "actualUpdated": len(to_update),
                    "expenseDate": body.expenseDate or None,
                    "overwriteExisting": body.overwriteExisting,
                    "userAgent": request.headers.get("user-agent") or "",
                    "timestamp": now.isoformat(),
                },
            )
        )

    await session.commit()

    message = (
        f"{len(to_update)}건이 지급완료로 변경되었습니다."
        if body.paymentStatus == "COMPLETED"
        else f"{len(to_update)}건이 지급대기로 변경되었습니다."
    )

    return BulkPaymentStatusOut(
        success=True,
        message=message,
        data=BulkPaymentStatusDataOut(
            updatedCount=len(to_update),
            skipped=BulkPaymentSkippedOut(
                notApproved=ineligible_count,
                alreadySameStatus=already_same_status_count,
            ),
        ),
    )
