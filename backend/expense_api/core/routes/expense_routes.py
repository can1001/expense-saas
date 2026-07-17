"""지출결의서 라우터. (app/api/expenses 이전)

Phase 3 골격: 생성(DRAFT)/목록/상세. 결재 워크플로우는 approval_routes.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import effective_permissions, require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.ids import utcnow
from expense_api.core.schemas.expense import CreateExpenseRequest, ExpenseListOut, ExpenseOut
from expense_api.core.service.expense_service import ExpenseService

router = APIRouter()


@router.get("", response_model=ExpenseListOut)
async def list_expenses(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    sortBy: str = Query("createdAt"),
    sortDir: str = Query("desc"),
    q: str | None = None,
    committee: str | None = None,
    department: str | None = None,
    category: str | None = None,
    startDate: datetime | None = None,
    endDate: datetime | None = None,
    minAmount: int | None = None,
    maxAmount: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    paymentStatus: str | None = None,
    approvedStart: datetime | None = None,
    approvedEnd: datetime | None = None,
    expenseStart: datetime | None = None,
    expenseEnd: datetime | None = None,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseListOut:
    svc = ExpenseService(session, tenant_id)
    only_user_id, only_department = await svc.resolve_read_scope(user, utcnow().year)
    return await svc.list(
        only_user_id=only_user_id,
        only_department=only_department,
        committee=committee,
        department=department,
        category=category,
        status=status_filter,
        payment_status=paymentStatus,
        start_date=startDate,
        end_date=endDate,
        min_amount=minAmount,
        max_amount=maxAmount,
        approved_start=approvedStart,
        approved_end=approvedEnd,
        expense_start=expenseStart,
        expense_end=expenseEnd,
        q=q,
        sort_by=sortBy,
        sort_dir=sortDir,
        page=page,
        limit=limit,
    )


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_expense(
    body: CreateExpenseRequest,
    user: CurrentUser = Depends(require_permission(PERMISSIONS.EXPENSE_CREATE)),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseOut:
    svc = ExpenseService(session, tenant_id)
    return await svc.create(user.id, body)


@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(
    expense_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseOut:
    svc = ExpenseService(session, tenant_id)
    expense = await svc.get(expense_id)
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지출결의서를 찾을 수 없습니다.")
    perms = await effective_permissions(user, session)
    if PERMISSIONS.EXPENSE_READ_ALL not in perms and expense.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "이 지출결의서를 조회할 권한이 없습니다.")
    return expense
