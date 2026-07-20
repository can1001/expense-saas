"""지출결의서 복제·첨부파일·업로드 라우터.
(app/api/expenses/[id]/duplicate, [id]/attachments*, upload/* 이전, B2)

`router` 는 /api/expenses 에 mount(복제·첨부파일), `upload_router` 는 /api/upload 에
mount(Cloudinary 업로드/삭제) — 두 접두사가 달라 파일은 같이 두되 라우터는 분리한다.
Cloudinary 실호출은 cloudinary_service 를 거치며, 테스트는 이 모듈을 monkeypatch 한다.
"""

from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.enums import ApprovalStatus
from expense_api.core.models.expense import Expense, ExpenseAttachment, ExpenseItem
from expense_api.core.models.ids import utcnow
from expense_api.core.schemas.expense import (
    AttachmentOut,
    CreateAttachmentRequest,
    DuplicateExpenseOut,
    ExpenseWithAttachmentsOut,
)
from expense_api.core.service import cloudinary_service
from expense_api.core.service.expense_service import to_out

router = APIRouter()
upload_router = APIRouter()

_ALLOWED_FORMATS = {"jpg", "jpeg", "png", "gif", "webp", "pdf"}
_ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
}
_ALLOWED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf")
_MAX_FILE_SIZE = 5 * 1024 * 1024
_MAX_FILENAME_LENGTH = 255
_MAX_PUBLIC_ID_LENGTH = 500


async def _get_expense_or_404(session: AsyncSession, tenant_id: str, expense_id: str) -> Expense:
    stmt = select(Expense).where(Expense.tenantId == tenant_id, Expense.id == expense_id)
    expense = (await session.execute(stmt)).scalars().first()
    if expense is None:
        raise HTTPException(404, "지출결의서를 찾을 수 없습니다.")
    return expense


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


def _validate_url(url: str, *, https_only: bool) -> None:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc or (https_only and parsed.scheme != "https"):
        raise HTTPException(400, "유효한 HTTPS URL이어야 합니다." if https_only else "유효하지 않은 URL입니다.")


# ── 복제 ──────────────────────────────────────────────────────────────


@router.post("/{expense_id}/duplicate", response_model=DuplicateExpenseOut)
async def duplicate_expense(
    expense_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> DuplicateExpenseOut:
    original = await _get_expense_or_404(session, tenant_id, expense_id)
    if original.userId != user.id:
        raise HTTPException(403, "본인이 작성한 지출결의서만 복제할 수 있습니다.")

    request_team = " ".join(p for p in [original.committee, original.department] if p).strip()
    if not request_team:
        raise HTTPException(400, "청구팀을 생성할 수 없습니다.")

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

    today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    new_expense = Expense(
        tenantId=tenant_id,
        userId=user.id,
        committee=original.committee,
        department=original.department,
        expenseDate=None,
        requestAmount=original.requestAmount,
        requestDate=today,
        requestTeam=request_team,
        applicantName=original.applicantName,
        applicantTitle=original.applicantTitle,
        bankName=original.bankName,
        accountNumber=original.accountNumber,
        accountHolder=original.accountHolder,
        status=ApprovalStatus.DRAFT.value,
        version=original.version,
    )
    session.add(new_expense)

    new_items = [
        ExpenseItem(
            tenantId=tenant_id,
            expenseId=new_expense.id,
            budgetCategory=it.budgetCategory,
            budgetSubcategory=it.budgetSubcategory,
            budgetDetail=it.budgetDetail,
            description=it.description,
            unitPrice=it.unitPrice,
            quantity=it.quantity,
            amount=it.amount,
            order=it.order,
        )
        for it in items
    ]
    session.add_all(new_items)

    new_attachments = [
        ExpenseAttachment(
            tenantId=tenant_id,
            expenseId=new_expense.id,
            publicId=att.publicId,
            url=att.url,
            secureUrl=att.secureUrl,
            format=att.format,
            fileName=att.fileName,
            fileSize=att.fileSize,
            width=att.width,
            height=att.height,
        )
        for att in attachments
    ]
    session.add_all(new_attachments)

    await session.commit()

    return DuplicateExpenseOut(
        success=True,
        message="지출결의서가 복제되었습니다.",
        expense=ExpenseWithAttachmentsOut(
            **to_out(new_expense, new_items).model_dump(),
            attachments=[_to_attachment_out(a) for a in new_attachments],
        ),
    )


# ── 첨부파일 목록·추가·삭제 ──────────────────────────────────────────────


@router.get("/{expense_id}/attachments", response_model=list[AttachmentOut])
async def list_attachments(
    expense_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[AttachmentOut]:
    await _get_expense_or_404(session, tenant_id, expense_id)
    stmt = (
        select(ExpenseAttachment)
        .where(ExpenseAttachment.tenantId == tenant_id, ExpenseAttachment.expenseId == expense_id)
        .order_by(ExpenseAttachment.createdAt)
    )
    attachments = (await session.execute(stmt)).scalars().all()
    return [_to_attachment_out(a) for a in attachments]


@router.post("/{expense_id}/attachments", response_model=AttachmentOut, status_code=201)
async def add_attachment(
    expense_id: str,
    body: CreateAttachmentRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> AttachmentOut:
    await _get_expense_or_404(session, tenant_id, expense_id)

    public_id = body.publicId.strip()
    if not public_id:
        raise HTTPException(400, "publicId가 비어있습니다.")
    if len(public_id) > _MAX_PUBLIC_ID_LENGTH:
        raise HTTPException(400, "publicId가 너무 깁니다.")

    _validate_url(body.url, https_only=False)
    _validate_url(body.secureUrl, https_only=True)

    fmt = body.format.lower()
    if fmt not in _ALLOWED_FORMATS:
        raise HTTPException(400, "유효하지 않은 이미지 형식입니다.")

    file_name = body.fileName.strip()
    if not file_name:
        raise HTTPException(400, "파일명이 비어있습니다.")
    if len(file_name) > _MAX_FILENAME_LENGTH:
        raise HTTPException(400, "파일명이 너무 깁니다. (최대 255자)")

    if body.fileSize <= 0:
        raise HTTPException(400, "파일 크기는 0보다 커야 합니다.")
    if body.width is not None and body.width <= 0:
        raise HTTPException(400, "이미지 너비는 0보다 커야 합니다.")
    if body.height is not None and body.height <= 0:
        raise HTTPException(400, "이미지 높이는 0보다 커야 합니다.")

    attachment = ExpenseAttachment(
        tenantId=tenant_id,
        expenseId=expense_id,
        publicId=public_id,
        url=body.url.strip(),
        secureUrl=body.secureUrl.strip(),
        format=fmt,
        fileName=file_name,
        fileSize=body.fileSize,
        width=body.width,
        height=body.height,
    )
    session.add(attachment)
    await session.commit()
    await session.refresh(attachment)
    return _to_attachment_out(attachment)


@router.delete("/{expense_id}/attachments/{attachment_id}")
async def delete_attachment(
    expense_id: str,
    attachment_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    await _get_expense_or_404(session, tenant_id, expense_id)

    attachment = await session.get(ExpenseAttachment, attachment_id)
    if attachment is None or attachment.tenantId != tenant_id:
        raise HTTPException(404, "첨부파일을 찾을 수 없습니다.")
    if attachment.expenseId != expense_id:
        raise HTTPException(403, "이 첨부파일은 해당 지출결의서에 속하지 않습니다.")

    cloudinary_deleted = False
    try:
        result = await cloudinary_service.delete_image(attachment.publicId)
        if result.get("result") == "ok":
            cloudinary_deleted = True
    except Exception:
        pass  # Cloudinary 삭제 실패해도 DB 는 삭제 진행 (Next 원본과 동일 — 이미 삭제됐을 수 있음)

    await session.delete(attachment)
    await session.commit()

    return {
        "success": True,
        "message": "첨부파일이 성공적으로 삭제되었습니다.",
        "cloudinaryDeleted": cloudinary_deleted,
        "attachmentId": attachment_id,
    }


# ── 업로드 (Cloudinary) ───────────────────────────────────────────────


class DeleteUploadRequest(BaseModel):
    publicId: str


@upload_router.post("")
async def upload_file(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(400, "빈 파일은 업로드할 수 없습니다.")
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(400, "파일 크기는 5MB를 초과할 수 없습니다.")

    mime = (file.content_type or "").lower()
    if mime not in _ALLOWED_MIME_TYPES:
        raise HTTPException(400, "지원하지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다.")

    file_name = file.filename or ""
    if not file_name.lower().endswith(_ALLOWED_EXTENSIONS):
        raise HTTPException(400, "지원하지 않는 파일 확장자입니다.")
    if len(file_name) > _MAX_FILENAME_LENGTH:
        raise HTTPException(400, "파일명이 너무 깁니다. (최대 255자)")

    try:
        result = await cloudinary_service.upload_image(content, file_name)
    except cloudinary_service.CloudinaryConfigError as e:
        raise HTTPException(503, str(e)) from e

    if not result or not result.get("public_id") or not result.get("secure_url"):
        raise HTTPException(500, "파일 업로드에 실패했습니다.")

    return {
        "success": True,
        "data": {
            "publicId": result["public_id"],
            "url": result.get("url"),
            "secureUrl": result["secure_url"],
            "format": result.get("format"),
            "width": result.get("width"),
            "height": result.get("height"),
            "bytes": result.get("bytes"),
            "fileName": file_name,
        },
    }


@upload_router.delete("/delete")
async def delete_upload(
    body: DeleteUploadRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    public_id = (body.publicId or "").strip()
    if not public_id:
        raise HTTPException(400, "publicId가 비어있습니다.")
    if len(public_id) > _MAX_PUBLIC_ID_LENGTH:
        raise HTTPException(400, "publicId가 너무 깁니다.")

    try:
        result = await cloudinary_service.delete_image(public_id)
    except cloudinary_service.CloudinaryConfigError as e:
        raise HTTPException(503, str(e)) from e

    if not result:
        raise HTTPException(500, "삭제에 실패했습니다.")

    if result.get("result") == "ok":
        return {"success": True, "message": "이미지가 성공적으로 삭제되었습니다.", "publicId": public_id}
    if result.get("result") == "not found":
        raise HTTPException(404, "삭제할 이미지를 찾을 수 없습니다.")
    raise HTTPException(400, "이미지 삭제에 실패했습니다.")
