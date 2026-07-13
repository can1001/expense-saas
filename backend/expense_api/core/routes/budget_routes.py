"""예산 계층 캐스케이드 라우터. (app/api/budget 이전)"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.service.budget_service import BudgetService

router = APIRouter()


class CascadeRequest(BaseModel):
    committee: str | None = None
    department: str | None = None
    category: str | None = None
    subcategory: str | None = None


@router.get("")
async def get_budget(
    committee: str | None = None,
    department: str | None = None,
    category: str | None = None,
    subcategory: str | None = None,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    svc = BudgetService(session, tenant_id)
    return await svc.get_hierarchy(committee, department, category, subcategory)


@router.post("")
async def cascade_budget(
    body: CascadeRequest | None = None,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    b = body or CascadeRequest()
    svc = BudgetService(session, tenant_id)
    return await svc.cascade_options(b.committee, b.department, b.category, b.subcategory)
