"""예산 마스터 CRUD 라우터 — 위원회/부서/항/목/세목 목록·생성·수정·삭제.
(app/api/committees, departments, budget-categories, budget-subcategories, budget-details 이전)
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
    DepartmentBudgetDetail,
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


async def _get_or_404(session: AsyncSession, model, entity_id: str, tenant_id: str, message: str):
    entity = await session.get(model, entity_id)
    if entity is None or entity.tenantId != tenant_id:
        raise HTTPException(404, message)
    return entity


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


class CommitteeUpdate(BaseModel):
    name: str | None = None
    isActive: bool | None = None
    sortOrder: int | None = None
    leaderId: str | None = None


@router.patch("/committees/{committee_id}")
async def update_committee(
    committee_id: str,
    body: CommitteeUpdate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.COMMITTEE_MANAGE)),
) -> dict:
    entity = await _get_or_404(session, Committee, committee_id, tenant_id, "위원회를 찾을 수 없습니다.")
    fields = body.model_fields_set

    if "name" in fields:
        new_name = (body.name or "").strip()
        if body.name and new_name != entity.name:
            if await _exists_by_name(session, Committee, tenant_id, new_name):
                raise HTTPException(409, "이미 존재하는 위원회명입니다.")
        entity.name = new_name
    if "isActive" in fields:
        entity.isActive = body.isActive
    if "sortOrder" in fields:
        entity.sortOrder = body.sortOrder
    if "leaderId" in fields:
        entity.leaderId = body.leaderId or None

    await session.commit()
    await session.refresh(entity)
    return entity.model_dump()


@router.delete("/committees/{committee_id}")
async def delete_committee(
    committee_id: str,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.COMMITTEE_MANAGE)),
) -> dict:
    entity = await _get_or_404(
        session, Committee, committee_id, tenant_id, "위원회를 찾을 수 없습니다."
    )

    dept_count = (
        await session.execute(
            select(func.count(Department.id)).where(Department.committeeId == committee_id)
        )
    ).scalar_one()
    if dept_count > 0:
        raise HTTPException(400, "하위 사역팀이 있는 위원회는 삭제할 수 없습니다.")

    await session.delete(entity)
    await session.commit()
    return {"success": True}


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


class DepartmentUpdate(BaseModel):
    name: str | None = None
    isActive: bool | None = None
    sortOrder: int | None = None
    committeeId: str | None = None


@router.patch("/departments/{department_id}")
async def update_department(
    department_id: str,
    body: DepartmentUpdate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.DEPARTMENT_MANAGE)),
) -> dict:
    entity = await _get_or_404(session, Department, department_id, tenant_id, "사역팀을 찾을 수 없습니다.")
    fields = body.model_fields_set
    target_committee_id = body.committeeId if "committeeId" in fields else entity.committeeId

    if "name" in fields:
        new_name = (body.name or "").strip()
        if body.name and new_name != entity.name:
            if await _exists_by_name(
                session, Department, tenant_id, new_name, committeeId=target_committee_id
            ):
                raise HTTPException(409, "같은 위원회 내에 이미 존재하는 사역팀명입니다.")
        entity.name = new_name
    if "isActive" in fields:
        entity.isActive = body.isActive
    if "sortOrder" in fields:
        entity.sortOrder = body.sortOrder
    if "committeeId" in fields:
        entity.committeeId = body.committeeId

    await session.commit()
    await session.refresh(entity)
    return entity.model_dump()


@router.delete("/departments/{department_id}")
async def delete_department(
    department_id: str,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.DEPARTMENT_MANAGE)),
) -> dict:
    entity = await _get_or_404(session, Department, department_id, tenant_id, "사역팀을 찾을 수 없습니다.")

    detail_count = (
        await session.execute(
            select(func.count(DepartmentBudgetDetail.id)).where(
                DepartmentBudgetDetail.departmentId == department_id
            )
        )
    ).scalar_one()
    if detail_count > 0:
        raise HTTPException(
            400, "연결된 예산 세목이 있는 사역팀은 삭제할 수 없습니다. 비활성화를 사용해주세요."
        )

    year_role_count = (
        await session.execute(
            select(func.count(UserYearRole.id)).where(UserYearRole.departmentId == department_id)
        )
    ).scalar_one()
    if year_role_count > 0:
        raise HTTPException(
            400, "연결된 팀장 역할이 있는 사역팀은 삭제할 수 없습니다. 비활성화를 사용해주세요."
        )

    await session.delete(entity)
    await session.commit()
    return {"success": True}


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


class CategoryUpdate(BaseModel):
    name: str | None = None
    isActive: bool | None = None
    sortOrder: int | None = None


@router.patch("/budget-categories/{category_id}")
async def update_category(
    category_id: str,
    body: CategoryUpdate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.BUDGET_MASTER_MANAGE)),
) -> dict:
    entity = await _get_or_404(
        session, BudgetCategory, category_id, tenant_id, "예산(항)을 찾을 수 없습니다."
    )
    fields = body.model_fields_set

    if "name" in fields:
        new_name = (body.name or "").strip()
        if body.name and new_name != entity.name:
            if await _exists_by_name(session, BudgetCategory, tenant_id, new_name):
                raise HTTPException(409, "이미 존재하는 예산(항)입니다.")
        entity.name = new_name
    if "isActive" in fields:
        entity.isActive = body.isActive
    if "sortOrder" in fields:
        entity.sortOrder = body.sortOrder

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


class SubcategoryUpdate(BaseModel):
    name: str | None = None
    isActive: bool | None = None
    sortOrder: int | None = None
    categoryId: str | None = None


@router.patch("/budget-subcategories/{subcategory_id}")
async def update_subcategory(
    subcategory_id: str,
    body: SubcategoryUpdate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.BUDGET_MASTER_MANAGE)),
) -> dict:
    entity = await _get_or_404(
        session, BudgetSubcategory, subcategory_id, tenant_id, "예산(목)을 찾을 수 없습니다."
    )
    fields = body.model_fields_set
    target_category_id = body.categoryId if "categoryId" in fields else entity.categoryId

    if "name" in fields:
        new_name = (body.name or "").strip()
        if body.name and new_name != entity.name:
            if await _exists_by_name(
                session, BudgetSubcategory, tenant_id, new_name, categoryId=target_category_id
            ):
                raise HTTPException(409, "같은 예산(항) 내에 이미 존재하는 예산(목)입니다.")
        entity.name = new_name
    if "isActive" in fields:
        entity.isActive = body.isActive
    if "sortOrder" in fields:
        entity.sortOrder = body.sortOrder
    if "categoryId" in fields:
        entity.categoryId = body.categoryId

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


class DetailUpdate(BaseModel):
    name: str | None = None
    isActive: bool | None = None
    sortOrder: int | None = None
    subcategoryId: str | None = None
    accountCode: str | None = None
    description: str | None = None


@router.patch("/budget-details/{detail_id}")
async def update_detail(
    detail_id: str,
    body: DetailUpdate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.BUDGET_MASTER_MANAGE)),
) -> dict:
    entity = await _get_or_404(
        session, BudgetDetail, detail_id, tenant_id, "예산(세목)을 찾을 수 없습니다."
    )
    fields = body.model_fields_set
    target_subcategory_id = body.subcategoryId if "subcategoryId" in fields else entity.subcategoryId

    if "name" in fields:
        new_name = (body.name or "").strip()
        if body.name and new_name != entity.name:
            if await _exists_by_name(
                session, BudgetDetail, tenant_id, new_name, subcategoryId=target_subcategory_id
            ):
                raise HTTPException(409, "같은 예산(목) 내에 이미 존재하는 예산(세목)입니다.")
        entity.name = new_name
    if "isActive" in fields:
        entity.isActive = body.isActive
    if "sortOrder" in fields:
        entity.sortOrder = body.sortOrder
    if "subcategoryId" in fields:
        entity.subcategoryId = body.subcategoryId
    if "accountCode" in fields:
        entity.accountCode = (body.accountCode or "").strip() or None
    if "description" in fields:
        entity.description = (body.description or "").strip() or None

    await session.commit()
    await session.refresh(entity)
    return entity.model_dump()
