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
from expense_api.core.models.ids import utcnow
from expense_api.core.models.user import User, UserYearRole

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
    committees = await _list(session, Committee, tenant_id)
    if not committees:
        return {"committees": []}

    leader_ids = {c["leaderId"] for c in committees if c.get("leaderId")}
    leaders: dict[str, str] = {}
    if leader_ids:
        rows = (
            await session.execute(select(User.id, User.username).where(User.id.in_(leader_ids)))
        ).all()
        leaders = {row[0]: row[1] for row in rows}

    counts = dict(
        (
            await session.execute(
                select(Department.committeeId, func.count(Department.id))
                .where(
                    Department.tenantId == tenant_id,
                    Department.committeeId.in_([c["id"] for c in committees]),
                )
                .group_by(Department.committeeId)
            )
        ).all()
    )

    for c in committees:
        leader_id = c.get("leaderId")
        c["leader"] = (
            {"id": leader_id, "username": leaders[leader_id]}
            if leader_id and leader_id in leaders
            else None
        )
        c["_count"] = {"departments": counts.get(c["id"], 0)}

    return {"committees": committees}


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
    year: int | None = None,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    extra = {"committeeId": committeeId} if committeeId else {}
    departments = await _list(session, Department, tenant_id, **extra)
    if not departments:
        return {"departments": []}

    committee_ids = {d["committeeId"] for d in departments}
    committee_names = dict(
        (
            await session.execute(select(Committee.id, Committee.name).where(Committee.id.in_(committee_ids)))
        ).all()
    )

    target_year = year or utcnow().year
    leader_rows = (
        await session.execute(
            select(UserYearRole.departmentId, User.id, User.username)
            .join(User, User.id == UserYearRole.userId)
            .where(
                UserYearRole.departmentId.in_([d["id"] for d in departments]),
                UserYearRole.year == target_year,
                UserYearRole.role == "team_leader",
            )
        )
    ).all()
    leaders = {row[0]: (row[1], row[2]) for row in leader_rows}

    return {
        "departments": [
            {
                "id": d["id"],
                "name": d["name"],
                "committeeId": d["committeeId"],
                "committeeName": committee_names.get(d["committeeId"], ""),
                "sortOrder": d["sortOrder"],
                "isActive": d["isActive"],
                "leaderId": leaders[d["id"]][0] if d["id"] in leaders else None,
                "leaderName": leaders[d["id"]][1] if d["id"] in leaders else None,
            }
            for d in departments
        ]
    }


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
    includeInactive: bool = False,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    extra = {} if includeInactive else {"isActive": True}
    categories = await _list(session, BudgetCategory, tenant_id, **extra)
    if not categories:
        return {"categories": []}

    counts = dict(
        (
            await session.execute(
                select(BudgetSubcategory.categoryId, func.count(BudgetSubcategory.id))
                .where(
                    BudgetSubcategory.tenantId == tenant_id,
                    BudgetSubcategory.categoryId.in_([c["id"] for c in categories]),
                )
                .group_by(BudgetSubcategory.categoryId)
            )
        ).all()
    )
    for c in categories:
        c["_count"] = {"subcategories": counts.get(c["id"], 0)}

    return {"categories": categories}


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
    includeInactive: bool = False,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(BudgetSubcategory).where(BudgetSubcategory.tenantId == tenant_id)
    if categoryId:
        stmt = stmt.where(BudgetSubcategory.categoryId == categoryId)
    if not includeInactive:
        stmt = (
            stmt.join(BudgetCategory, BudgetCategory.id == BudgetSubcategory.categoryId)
            .where(BudgetSubcategory.isActive == True)  # noqa: E712
            .where(BudgetCategory.isActive == True)  # noqa: E712
        )
    stmt = stmt.order_by(BudgetSubcategory.sortOrder)
    rows = (await session.execute(stmt)).scalars().all()
    subcategories = [r.model_dump() for r in rows]
    if not subcategories:
        return {"subcategories": []}

    counts = dict(
        (
            await session.execute(
                select(BudgetDetail.subcategoryId, func.count(BudgetDetail.id))
                .where(
                    BudgetDetail.tenantId == tenant_id,
                    BudgetDetail.subcategoryId.in_([s["id"] for s in subcategories]),
                )
                .group_by(BudgetDetail.subcategoryId)
            )
        ).all()
    )
    for s in subcategories:
        s["_count"] = {"details": counts.get(s["id"], 0)}

    return {"subcategories": subcategories}


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
