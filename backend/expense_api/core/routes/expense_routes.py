"""지출결의서 라우터. (app/api/expenses 이전)

Phase 3 골격: 생성(DRAFT)/목록/상세. 결재 워크플로우는 approval_routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import effective_permissions, require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.schemas.expense import CreateExpenseRequest, ExpenseListOut, ExpenseOut
from expense_api.core.service.expense_service import ExpenseService

router = APIRouter()


@router.get("", response_model=ExpenseListOut)
async def list_expenses(
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseListOut:
    perms = await effective_permissions(user, session)
    # 전체 조회 권한이 없으면 본인 것만
    only = None if PERMISSIONS.EXPENSE_READ_ALL in perms else user.id
    svc = ExpenseService(session, tenant_id)
    expenses = await svc.list(only_user_id=only)
    return ExpenseListOut(expenses=expenses, total=len(expenses))


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
