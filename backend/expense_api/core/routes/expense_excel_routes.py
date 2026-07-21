"""지출결의서 Excel 내보내기/일괄업로드 라우터.

(app/api/expenses/export/excel, app/api/expenses/bulk-upload,
app/api/expenses/bulk-upload-template 이전, C3)

mount prefix: /api/expenses
"""

import io
from dataclasses import asdict
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS, has_permission
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.excel import XLSX_CONTENT_TYPE
from expense_api.core.models.expense import Expense, ExpenseItem
from expense_api.core.models.user import UserYearRole
from expense_api.core.service.expense_excel_service import (
    MAX_ROWS,
    BulkApplicant,
    BulkUploadResult,
    ExpenseForExcel,
    ExpenseForWoori,
    ExpenseItemForExcel,
    PreviewItem,
    ValidationError,
    build_expense_template_workbook,
    build_export_workbook,
    build_woori_workbook,
    execute_bulk_upload,
    generate_export_filename,
    generate_woori_filename,
    parse_expense_excel_buffer,
)

router = APIRouter()

_MAX_FILE_BYTES = 2 * 1024 * 1024


def _xlsx_attachment(content: bytes, filename: str) -> Response:
    """RFC 5987 filename* 인코딩 — Next `filename*=UTF-8''${encodeURIComponent(filename)}` 재현."""
    return Response(
        content=content,
        media_type=XLSX_CONTENT_TYPE,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


def _workbook_bytes(workbook) -> bytes:
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


# ── GET /export/excel — 지출결의서 엑셀 다운로드 ──────────────────────────


@router.get("/export/excel")
async def export_excel(
    ids: str | None = None,
    status: str = "APPROVED_FINAL",
    startDate: str | None = None,
    endDate: str | None = None,
    expenseDate: str | None = None,
    useSameDate: str | None = None,
    format: str = "default",
    user: CurrentUser = Depends(require_permission(PERMISSIONS.EXPENSE_EXPORT)),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
):
    conditions = [Expense.tenantId == tenant_id]

    if ids:
        id_list = [i for i in ids.split(",") if i]
        if id_list:
            conditions.append(Expense.id.in_(id_list))

    if status != "all":
        conditions.append(Expense.status == status)

    start_date = datetime.fromisoformat(startDate) if startDate else None
    end_date = datetime.fromisoformat(endDate) if endDate else None
    if start_date:
        conditions.append(Expense.requestDate >= start_date)
    if end_date:
        end_date_inclusive = end_date.replace(hour=23, minute=59, second=59, microsecond=999000)
        conditions.append(Expense.requestDate <= end_date_inclusive)

    override_date = datetime.fromisoformat(expenseDate) if expenseDate else None
    use_same_date = useSameDate == "true"

    stmt = select(Expense).where(*conditions).order_by(Expense.requestDate.desc())
    expenses = list((await session.execute(stmt)).scalars().all())

    if not expenses:
        raise HTTPException(404, "내보낼 지출결의서가 없습니다.")

    items_by_expense: dict[str, list[ExpenseItem]] = {}
    if expenses:
        items_stmt = (
            select(ExpenseItem)
            .where(ExpenseItem.expenseId.in_([e.id for e in expenses]))
            .order_by(ExpenseItem.order)
        )
        for item in (await session.execute(items_stmt)).scalars().all():
            items_by_expense.setdefault(item.expenseId, []).append(item)

    if format == "woori":
        woori_expenses = [
            ExpenseForWoori(
                bankName=e.bankName,
                accountNumber=e.accountNumber,
                accountHolder=e.accountHolder,
                requestAmount=e.requestAmount,
            )
            for e in expenses
        ]
        workbook = build_woori_workbook(woori_expenses)
        filename = generate_woori_filename()
    else:
        excel_expenses = [
            ExpenseForExcel(
                accountHolder=e.accountHolder,
                bankName=e.bankName,
                accountNumber=e.accountNumber,
                expenseDate=e.expenseDate,
                requestDate=e.requestDate,
                items=[
                    ExpenseItemForExcel(
                        budgetCategory=i.budgetCategory,
                        budgetSubcategory=i.budgetSubcategory,
                        budgetDetail=i.budgetDetail,
                        description=i.description,
                        amount=i.amount,
                    )
                    for i in items_by_expense.get(e.id, [])
                ],
            )
            for e in expenses
        ]
        workbook = build_export_workbook(excel_expenses, override_date if use_same_date else None)
        filename = generate_export_filename(excel_expenses, start_date, end_date)

    return _xlsx_attachment(_workbook_bytes(workbook), filename)


# ── 일괄 업로드 접근 권한 (관리 메뉴 '/admin/expense-upload' — 다중 연도 역할) ──


async def _all_year_roles(session: AsyncSession, user: CurrentUser, year: int) -> list[str]:
    """lib/services/user-service.ts getUserAllYearRoles 이전."""
    if user.role == "admin":
        return ["admin"]
    stmt = select(UserYearRole.role).where(UserYearRole.userId == user.id, UserYearRole.year == year)
    roles = list((await session.execute(stmt)).scalars().all())
    return roles or [user.role]


async def _require_bulk_upload_access(session: AsyncSession, user: CurrentUser) -> None:
    year = datetime.now(timezone.utc).year
    roles = await _all_year_roles(session, user, year)
    if not has_permission(roles, PERMISSIONS.EXPENSE_BULK_UPLOAD):
        raise HTTPException(403, "권한이 없습니다.")


# ── GET /bulk-upload-template — 일괄 업로드 템플릿 다운로드 ──────────────────


@router.get("/bulk-upload-template")
async def bulk_upload_template(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_bulk_upload_access(session, user)

    content = _workbook_bytes(build_expense_template_workbook())
    return Response(
        content=content,
        media_type=XLSX_CONTENT_TYPE,
        headers={
            "Content-Disposition": 'attachment; filename="expense-bulk-upload-template.xlsx"',
            "Content-Length": str(len(content)),
        },
    )


# ── POST /bulk-upload — 지출결의서 일괄 등록 ─────────────────────────────


def _validation_error_out(e: ValidationError) -> dict:
    out: dict = {"rowNumber": e.rowNumber, "message": e.message}
    if e.groupId is not None:
        out["groupId"] = e.groupId
    if e.field is not None:
        out["field"] = e.field
    return out


def _preview_item_out(p: PreviewItem) -> dict:
    return asdict(p)


def _bulk_result_out(result: BulkUploadResult) -> dict:
    out: dict = {
        "dryRun": result.dryRun,
        "totalRows": result.totalRows,
        "totalExpenses": result.totalExpenses,
        "errors": [_validation_error_out(e) for e in result.errors],
    }
    if result.preview is not None:
        out["preview"] = [_preview_item_out(p) for p in result.preview]
    if result.createdIds is not None:
        out["createdIds"] = result.createdIds
    return out


@router.post("/bulk-upload")
async def bulk_upload(
    file: UploadFile | None = File(None),
    dryRun: str = Form("false"),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
):
    await _require_bulk_upload_access(session, user)

    if file is None:
        raise HTTPException(400, "파일이 필요합니다.")

    filename = file.filename or ""
    is_xlsx = filename.lower().endswith(".xlsx") or file.content_type == XLSX_CONTENT_TYPE
    if not is_xlsx:
        raise HTTPException(400, "Excel(.xlsx) 파일만 업로드할 수 있습니다.")

    content = await file.read()
    if len(content) > _MAX_FILE_BYTES:
        raise HTTPException(413, f"파일이 너무 큽니다 (최대 {_MAX_FILE_BYTES // 1024 // 1024}MB).")

    try:
        rows = parse_expense_excel_buffer(content)
    except Exception:  # noqa: BLE001 — 원본과 동일하게 파싱 실패를 400으로 흡수
        raise HTTPException(400, "Excel 파일을 읽을 수 없습니다. 양식이 올바른지 확인해주세요.") from None

    if not rows:
        raise HTTPException(400, "Excel 파일에 데이터가 없습니다.")
    if len(rows) > MAX_ROWS:
        raise HTTPException(
            400, f"한 번에 업로드 가능한 최대 행 수({MAX_ROWS})를 초과했습니다. 현재 {len(rows)}행."
        )

    try:
        result = await execute_bulk_upload(
            session,
            tenant_id,
            rows,
            dry_run=dryRun == "true",
            applicant=BulkApplicant(userId=user.id, username=user.username),
        )
    except Exception:  # noqa: BLE001 — 트랜잭션 실패는 전체 롤백된 상태로 500 반환
        await session.rollback()
        raise HTTPException(
            500, "일괄 업로드 처리 중 오류가 발생했습니다. 모든 변경사항은 롤백되었습니다."
        ) from None

    return _bulk_result_out(result)
