"""예산 마스터 CRUD 라우터 — 위원회/부서/항/목/세목 목록·생성.
(app/api/committees, departments, budget-categories, budget-subcategories, budget-details 이전)

Phase 2 골격: GET 목록 + POST 생성. 수정/삭제(PUT/DELETE)는 후속.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetSubcategory,
    Committee,
    Department,
)

router = APIRouter()


# ── 공통 헬퍼 ─────────────────────────────────────────────────────────
async def _next_sort_order(session: AsyncSession, model, tenant_id: str) -> int:
    stmt = select(func.max(model.sortOrder)).where(model.tenantId == tenant_id)
    current = (await session.execute(stmt)).scalar_one_or_none()
    return (current or 0) + 1


async def _exists_by_name(session: AsyncSession, model, tenant_id: str, name: str, **extra) -> bool:
    stmt = select(model.id).where(model.tenantId == tenant_id, model.name == name)
    for k, v in extra.items():
        stmt = stmt.where(getattr(model, k) == v)
    return (await session.execute(stmt)).first() is not None


async def _list(session: AsyncSession, model, tenant_id: str, **extra) -> list[dict]:
    stmt = select(model).where(model.tenantId == tenant_id)
    for k, v in extra.items():
        stmt = stmt.where(getattr(model, k) == v)
    stmt = stmt.order_by(model.sortOrder)
    rows = (await session.execute(stmt)).scalars().all()
    return [r.model_dump() for r in rows]


# ── 위원회 ────────────────────────────────────────────────────────────
class CommitteeCreate(BaseModel):
    name: str
    leaderId: str | None = None


@router.get("/committees")
async def list_committees(
    tenant_id: str = Depends(require_tenant_id), session: AsyncSession = Depends(get_session)
) -> dict:
    return {"committees": await _list(session, Committee, tenant_id)}


@router.post("/committees", status_code=status.HTTP_201_CREATED)
async def create_committee(
    body: CommitteeCreate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.COMMITTEE_MANAGE)),
) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "위원회명을 입력해주세요.")
    if await _exists_by_name(session, Committee, tenant_id, name):
        raise HTTPException(409, "이미 존재하는 위원회명입니다.")
    entity = Committee(
        tenantId=tenant_id,
        name=name,
        sortOrder=await _next_sort_order(session, Committee, tenant_id),
        leaderId=body.leaderId or None,
    )
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return entity.model_dump()


# ── 부서 ──────────────────────────────────────────────────────────────
class DepartmentCreate(BaseModel):
    committeeId: str
    name: str


@router.get("/departments")
async def list_departments(
    committeeId: str | None = None,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    extra = {"committeeId": committeeId} if committeeId else {}
    return {"departments": await _list(session, Department, tenant_id, **extra)}


@router.post("/departments", status_code=status.HTTP_201_CREATED)
async def create_department(
    body: DepartmentCreate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.DEPARTMENT_MANAGE)),
) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "부서명을 입력해주세요.")
    # @@unique([committeeId, name])
    if await _exists_by_name(session, Department, tenant_id, name, committeeId=body.committeeId):
        raise HTTPException(409, "해당 위원회에 이미 존재하는 부서명입니다.")
    entity = Department(
        tenantId=tenant_id,
        committeeId=body.committeeId,
        name=name,
        sortOrder=await _next_sort_order(session, Department, tenant_id),
    )
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return entity.model_dump()


# ── 예산(항) ──────────────────────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str


@router.get("/budget-categories")
async def list_categories(
    tenant_id: str = Depends(require_tenant_id), session: AsyncSession = Depends(get_session)
) -> dict:
    return {"categories": await _list(session, BudgetCategory, tenant_id)}


@router.post("/budget-categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.BUDGET_MASTER_MANAGE)),
) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "예산(항)명을 입력해주세요.")
    if await _exists_by_name(session, BudgetCategory, tenant_id, name):
        raise HTTPException(409, "이미 존재하는 예산(항)명입니다.")
    entity = BudgetCategory(
        tenantId=tenant_id,
        name=name,
        sortOrder=await _next_sort_order(session, BudgetCategory, tenant_id),
    )
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return entity.model_dump()


# ── 예산(목) ──────────────────────────────────────────────────────────
class SubcategoryCreate(BaseModel):
    categoryId: str
    name: str


@router.get("/budget-subcategories")
async def list_subcategories(
    categoryId: str | None = None,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    extra = {"categoryId": categoryId} if categoryId else {}
    return {"subcategories": await _list(session, BudgetSubcategory, tenant_id, **extra)}


@router.post("/budget-subcategories", status_code=status.HTTP_201_CREATED)
async def create_subcategory(
    body: SubcategoryCreate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.BUDGET_MASTER_MANAGE)),
) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "예산(목)명을 입력해주세요.")
    if await _exists_by_name(
        session, BudgetSubcategory, tenant_id, name, categoryId=body.categoryId
    ):
        raise HTTPException(409, "해당 항에 이미 존재하는 목명입니다.")
    entity = BudgetSubcategory(
        tenantId=tenant_id,
        categoryId=body.categoryId,
        name=name,
        sortOrder=await _next_sort_order(session, BudgetSubcategory, tenant_id),
    )
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return entity.model_dump()


# ── 예산(세목) ────────────────────────────────────────────────────────
class DetailCreate(BaseModel):
    subcategoryId: str
    name: str
    accountCode: str | None = None
    description: str | None = None


@router.get("/budget-details")
async def list_details(
    subcategoryId: str | None = None,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    extra = {"subcategoryId": subcategoryId} if subcategoryId else {}
    return {"details": await _list(session, BudgetDetail, tenant_id, **extra)}


@router.post("/budget-details", status_code=status.HTTP_201_CREATED)
async def create_detail(
    body: DetailCreate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.BUDGET_MASTER_MANAGE)),
) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "예산(세목)명을 입력해주세요.")
    if await _exists_by_name(
        session, BudgetDetail, tenant_id, name, subcategoryId=body.subcategoryId
    ):
        raise HTTPException(409, "해당 목에 이미 존재하는 세목명입니다.")
    entity = BudgetDetail(
        tenantId=tenant_id,
        subcategoryId=body.subcategoryId,
        name=name,
        accountCode=body.accountCode,
        description=body.description,
        sortOrder=await _next_sort_order(session, BudgetDetail, tenant_id),
    )
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return entity.model_dump()
