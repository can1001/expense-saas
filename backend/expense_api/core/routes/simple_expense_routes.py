"""간편 지출결의서 라우터. (app/api/simple-expenses* 이전, B4)

Expense 테이블에 version="4.1.4"로 저장되는 별도 폼 — 위원회/사역팀 선택 없이
각 항목마다 예산(항/목/세목)을 고르고, 첫 항목 기준으로 위원회/사역팀을 역산한다.
제출(PENDING) 시 결재선은 approval_policy_engine 을 재사용해 즉시 확정한다
(app/api/expenses/[id]/submit 과 동일 산출기 — 레거시 lib/services/approval-line-service.ts
하드코딩 로직은 정책 엔진으로 일반화되어 대체되었다).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.domain.amount import calculate_amount, calculate_request_amount
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetDetailYear,
    Committee,
    Department,
    DepartmentBudgetDetail,
    BudgetSubcategory,
)
from expense_api.core.models.expense import Expense, ExpenseAttachment, ExpenseItem
from expense_api.core.models.user import User
from expense_api.core.schemas.approval import SubmitRequest
from expense_api.core.schemas.expense import (
    AttachmentOut,
    CreateSimpleExpenseOut,
    CreateSimpleExpenseRequest,
    ExpenseItemOut,
    SimpleExpenseDetailOut,
    SimpleExpenseItemInput,
    SimpleExpenseListOut,
    SimpleExpenseOut,
    UpdateSimpleExpenseRequest,
)
from expense_api.core.service.approval_service import ApprovalService, WorkflowError

router = APIRouter()

_VERSION = "4.1.4"


def _to_item_out(item: ExpenseItem) -> ExpenseItemOut:
    return ExpenseItemOut(
        id=item.id,
        budgetCategory=item.budgetCategory,
        budgetSubcategory=item.budgetSubcategory,
        budgetDetail=item.budgetDetail,
        description=item.description,
        unitPrice=item.unitPrice,
        quantity=item.quantity,
        amount=item.amount,
        order=item.order,
    )


def _to_out(expense: Expense, items: list[ExpenseItem]) -> SimpleExpenseOut:
    return SimpleExpenseOut(
        id=expense.id,
        userId=expense.userId,
        committee=expense.committee,
        department=expense.department,
        expenseDate=expense.expenseDate,
        requestAmount=expense.requestAmount,
        requestDate=expense.requestDate,
        requestTeam=expense.requestTeam,
        applicantName=expense.applicantName,
        applicantTitle=expense.applicantTitle,
        bankName=expense.bankName,
        accountNumber=expense.accountNumber,
        accountHolder=expense.accountHolder,
        status=expense.status,
        paymentStatus=expense.paymentStatus,
        submittedAt=expense.submittedAt,
        approvedAt=expense.approvedAt,
        rejectedAt=expense.rejectedAt,
        createdAt=expense.createdAt,
        version=expense.version,
        items=[_to_item_out(i) for i in items],
    )


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


async def _list_items(session: AsyncSession, expense_id: str) -> list[ExpenseItem]:
    stmt = (
        select(ExpenseItem)
        .where(ExpenseItem.expenseId == expense_id)
        .order_by(ExpenseItem.order)
    )
    return list((await session.execute(stmt)).scalars().all())


async def _get_simple_expense(
    session: AsyncSession, tenant_id: str, expense_id: str
) -> Expense | None:
    stmt = select(Expense).where(
        Expense.tenantId == tenant_id, Expense.id == expense_id, Expense.version == _VERSION
    )
    return (await session.execute(stmt)).scalars().first()


async def _budget_detail_lookup(
    session: AsyncSession, tenant_id: str, category: str, subcategory: str, detail: str
) -> BudgetDetail | None:
    stmt = (
        select(BudgetDetail)
        .join(BudgetSubcategory, BudgetSubcategory.id == BudgetDetail.subcategoryId)
        .join(BudgetCategory, BudgetCategory.id == BudgetSubcategory.categoryId)
        .where(
            BudgetDetail.tenantId == tenant_id,
            BudgetDetail.name == detail,
            BudgetSubcategory.name == subcategory,
            BudgetCategory.name == category,
        )
    )
    return (await session.execute(stmt)).scalars().first()


async def _manager_for_detail(
    session: AsyncSession, tenant_id: str, detail: BudgetDetail | None, year: int
) -> User | None:
    if detail is None:
        return None
    stmt = (
        select(User)
        .join(BudgetDetailYear, BudgetDetailYear.managerId == User.id)
        .where(
            BudgetDetailYear.budgetDetailId == detail.id,
            BudgetDetailYear.year == year,
            User.tenantId == tenant_id,
        )
    )
    return (await session.execute(stmt)).scalars().first()


async def _lookup_budget_hierarchy(
    session: AsyncSession, tenant_id: str, category: str, subcategory: str, detail_name: str
) -> tuple[str, str] | None:
    """(committee, department) — BudgetDetail → DepartmentBudgetDetail → Department → Committee."""
    detail = await _budget_detail_lookup(session, tenant_id, category, subcategory, detail_name)
    if detail is None:
        return None
    stmt = (
        select(Committee.name, Department.name)
        .select_from(DepartmentBudgetDetail)
        .join(Department, Department.id == DepartmentBudgetDetail.departmentId)
        .join(Committee, Committee.id == Department.committeeId)
        .where(
            DepartmentBudgetDetail.budgetDetailId == detail.id,
            DepartmentBudgetDetail.isActive == True,  # noqa: E712
        )
    )
    row = (await session.execute(stmt)).first()
    if row is None:
        return None
    return row[0], row[1]


def _derive_request_team(committee: str, department: str) -> str:
    return " ".join(p for p in (committee, department) if p).strip()


async def _validate_manager_consistency(
    session: AsyncSession, tenant_id: str, items: list[SimpleExpenseItemInput], year: int
) -> None:
    first = items[0]
    first_detail = await _budget_detail_lookup(
        session, tenant_id, first.budgetCategory, first.budgetSubcategory, first.budgetDetail
    )
    first_manager = await _manager_for_detail(session, tenant_id, first_detail, year)
    first_manager_name = first_manager.username if first_manager else None

    for i, item in enumerate(items[1:], start=1):
        detail = await _budget_detail_lookup(
            session, tenant_id, item.budgetCategory, item.budgetSubcategory, item.budgetDetail
        )
        manager = await _manager_for_detail(session, tenant_id, detail, year)
        manager_name = manager.username if manager else None
        manager_id = manager.id if manager else None
        first_manager_id = first_manager.id if first_manager else None
        if manager_id != first_manager_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f'항목 {i + 1}의 세목 "{item.budgetDetail}"은 결재선이 다릅니다. '
                f'담당자: "{manager_name or "미지정"}", '
                f'기준 담당자: "{first_manager_name or "미지정"}"',
            )


@router.get("", response_model=SimpleExpenseListOut)
async def list_simple_expenses(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> SimpleExpenseListOut:
    offset = (page - 1) * limit
    stmt = (
        select(Expense)
        .where(Expense.tenantId == tenant_id, Expense.version == _VERSION)
        .order_by(Expense.createdAt.desc())
        .offset(offset)
        .limit(limit)
    )
    expenses = list((await session.execute(stmt)).scalars().all())
    total_count = (
        await session.execute(
            select(func.count())
            .select_from(Expense)
            .where(Expense.tenantId == tenant_id, Expense.version == _VERSION)
        )
    ).scalar_one()

    out = []
    for e in expenses:
        items = await _list_items(session, e.id)
        out.append(_to_out(e, items))

    total_pages = (total_count + limit - 1) // limit if limit else 0
    return SimpleExpenseListOut(
        expenses=out,
        pagination={
            "page": page,
            "limit": limit,
            "total": total_count,
            "totalPages": total_pages,
        },
    )


@router.post("", response_model=CreateSimpleExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_simple_expense(
    body: CreateSimpleExpenseRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> CreateSimpleExpenseOut:
    year = body.requestDate.year
    first_item = body.items[0]

    await _validate_manager_consistency(session, tenant_id, body.items, year)

    hierarchy = await _lookup_budget_hierarchy(
        session, tenant_id, first_item.budgetCategory, first_item.budgetSubcategory, first_item.budgetDetail
    )
    if hierarchy is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"예산 정보를 찾을 수 없습니다: {first_item.budgetCategory} > "
            f"{first_item.budgetSubcategory} > {first_item.budgetDetail}",
        )
    committee, department = hierarchy

    request_team = _derive_request_team(committee, department)
    if not request_team:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"청구팀을 생성할 수 없습니다: {committee} {department}"
        )

    amounts: list[int] = []
    item_models: list[ExpenseItem] = []
    for idx, it in enumerate(body.items):
        amount = calculate_amount(it.unitPrice, it.quantity)
        amounts.append(amount)
        item_models.append(
            ExpenseItem(
                tenantId=tenant_id,
                budgetCategory=it.budgetCategory,
                budgetSubcategory=it.budgetSubcategory,
                budgetDetail=it.budgetDetail,
                description=it.description,
                unitPrice=it.unitPrice,
                quantity=it.quantity,
                amount=amount,
                order=idx + 1,
            )
        )
    request_amount = calculate_request_amount(amounts)

    is_submit = body.status == "PENDING"

    expense = Expense(
        tenantId=tenant_id,
        userId=user.id,
        committee=committee,
        department=department,
        expenseDate=body.expenseDate,
        requestAmount=request_amount,
        requestDate=body.requestDate,
        requestTeam=request_team,
        applicantName=body.applicantName,
        applicantTitle=None,
        bankName=body.bankName,
        accountNumber=body.accountNumber,
        accountHolder=body.accountHolder,
        status="DRAFT",
        version=_VERSION,
    )
    session.add(expense)
    await session.flush()

    for it in item_models:
        it.expenseId = expense.id
        session.add(it)
    await session.flush()

    if is_submit:
        try:
            await ApprovalService(session, tenant_id)._apply_new_line(
                expense, user, SubmitRequest(), "SUBMIT"
            )
        except WorkflowError as e:
            raise HTTPException(e.status_code, e.message) from e

    await session.commit()
    await session.refresh(expense)
    items = await _list_items(session, expense.id)

    return CreateSimpleExpenseOut(
        success=True,
        message="지출결의서가 생성되었습니다.",
        id=expense.id,
        expense=_to_out(expense, items),
    )


@router.get("/{expense_id}", response_model=SimpleExpenseDetailOut)
async def get_simple_expense(
    expense_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> SimpleExpenseDetailOut:
    expense = await _get_simple_expense(session, tenant_id, expense_id)
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지출결의서를 찾을 수 없습니다.")

    items = await _list_items(session, expense_id)
    attachments_stmt = (
        select(ExpenseAttachment)
        .where(ExpenseAttachment.expenseId == expense_id)
        .order_by(ExpenseAttachment.createdAt)
    )
    attachments = list((await session.execute(attachments_stmt)).scalars().all())

    base = _to_out(expense, items)
    return SimpleExpenseDetailOut(
        **base.model_dump(), attachments=[_to_attachment_out(a) for a in attachments]
    )


@router.put("/{expense_id}", response_model=SimpleExpenseOut)
async def update_simple_expense(
    expense_id: str,
    body: UpdateSimpleExpenseRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> SimpleExpenseOut:
    expense = await _get_simple_expense(session, tenant_id, expense_id)
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지출결의서를 찾을 수 없습니다.")

    await session.execute(delete(ExpenseItem).where(ExpenseItem.expenseId == expense_id))

    amounts: list[int] = []
    if body.items:
        for idx, it in enumerate(body.items):
            amount = calculate_amount(it.unitPrice, it.quantity)
            amounts.append(amount)
            session.add(
                ExpenseItem(
                    tenantId=tenant_id,
                    expenseId=expense_id,
                    budgetCategory=it.budgetCategory,
                    budgetSubcategory=it.budgetSubcategory,
                    budgetDetail=it.budgetDetail,
                    description=it.description,
                    unitPrice=it.unitPrice,
                    quantity=it.quantity,
                    amount=amount,
                    order=idx + 1,
                )
            )
    request_amount = calculate_request_amount(amounts) if amounts else None

    if body.expenseDate is not None:
        expense.expenseDate = body.expenseDate
    if request_amount is not None:
        expense.requestAmount = request_amount
    if body.requestDate:
        expense.requestDate = body.requestDate
    if body.applicantName:
        expense.applicantName = body.applicantName
    if body.bankName:
        expense.bankName = body.bankName
    if body.accountNumber:
        expense.accountNumber = body.accountNumber
    if body.accountHolder:
        expense.accountHolder = body.accountHolder

    session.add(expense)
    await session.commit()
    await session.refresh(expense)
    items = await _list_items(session, expense_id)
    return _to_out(expense, items)


@router.delete("/{expense_id}")
async def delete_simple_expense(
    expense_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    expense = await _get_simple_expense(session, tenant_id, expense_id)
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지출결의서를 찾을 수 없습니다.")

    attachments_stmt = select(ExpenseAttachment).where(ExpenseAttachment.expenseId == expense_id)
    attachments = list((await session.execute(attachments_stmt)).scalars().all())
    if attachments:
        from expense_api.core.service import cloudinary_service

        for a in attachments:
            try:
                await cloudinary_service.delete_image(a.publicId)
            except Exception:
                pass  # Cloudinary 삭제 실패해도 DB는 삭제 진행 (Next 원본과 동일)

    await session.delete(expense)
    await session.commit()
    return {"success": True}
