"""플랫폼 테넌트 관리 라우터 (P2, app/api/platform/tenants* 이전).

platform 은 테넌트 스코프 예외(전 테넌트 조회가 스펙) — platform 관리자 인증으로 대신 강제한다.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.platform_auth import (
    CurrentPlatformAdmin,
    get_current_platform_admin,
)
from expense_api.core.models.budget import BudgetCategory, Committee
from expense_api.core.models.expense import Expense
from expense_api.core.models.recurring_expense import RecurringExpense
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.schemas.tenant import (
    PLAN_LIMITS,
    TenantCreateBody,
    TenantUpdateBody,
    validate_create_tenant,
    validate_update_tenant,
)
from expense_api.core.schemas.tenant_settings import (
    DEFAULT_SETTINGS,
    TenantSettingsBody,
    merge_deep,
    validate_tenant_settings,
)
from expense_api.core.service.platform_activity_log_service import log_platform_activity
from expense_api.core.service.tenant_provisioning_service import (
    create_default_roles,
    seed_default_data,
)
from expense_api.core.service.tenant_provisioning_service import (
    provision_tenant as provision_tenant_service,
)

router = APIRouter()

_SIMPLE_EXPENSE_VERSION = "4.1.4"

_LIST_SELECT_FIELDS = (
    "id", "name", "subdomain", "customDomain", "orgType", "plan", "maxUsers", "maxStorageMB",
    "currentUsers", "currentStorage", "isActive", "suspendedAt", "suspendReason", "createdAt",
    "updatedAt",
)


def _tenant_not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "테넌트를 찾을 수 없습니다.")


async def _get_tenant_or_404(session: AsyncSession, tenant_id: str) -> Tenant:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise _tenant_not_found()
    return tenant


async def _find_by_subdomain(session: AsyncSession, subdomain: str) -> Tenant | None:
    return (
        await session.execute(select(Tenant).where(Tenant.subdomain == subdomain))
    ).scalars().first()


async def _find_by_custom_domain(session: AsyncSession, custom_domain: str) -> Tenant | None:
    return (
        await session.execute(select(Tenant).where(Tenant.customDomain == custom_domain))
    ).scalars().first()


# ── GET /platform/tenants — 목록 조회 ────────────────────────────────────
@router.get("/tenants")
async def list_tenants(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    plan: str | None = None,
    orgType: str | None = None,
    isActive: bool | None = None,
    sortBy: str = "createdAt",
    sortOrder: str = "desc",
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    page = max(page, 1)
    limit = min(max(limit, 1), 100)

    where = []
    if search:
        pattern = f"%{search}%"
        where.append(
            (Tenant.name.ilike(pattern))
            | (Tenant.subdomain.ilike(pattern))
            | (Tenant.customDomain.ilike(pattern))
        )
    if plan:
        where.append(Tenant.plan == plan)
    if orgType:
        where.append(Tenant.orgType == orgType)
    if isActive is not None:
        where.append(Tenant.isActive == isActive)

    total = (await session.execute(select(func.count(Tenant.id)).where(*where))).scalar_one()

    sort_column = getattr(Tenant, sortBy, Tenant.createdAt)
    order = sort_column.desc() if sortOrder == "desc" else sort_column.asc()

    tenants = (
        (
            await session.execute(
                select(Tenant)
                .where(*where)
                .order_by(order)
                .offset((page - 1) * limit)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )

    items = []
    for tenant in tenants:
        users_count = (
            await session.execute(select(func.count(User.id)).where(User.tenantId == tenant.id))
        ).scalar_one()
        expenses_count = (
            await session.execute(
                select(func.count(Expense.id)).where(Expense.tenantId == tenant.id)
            )
        ).scalar_one()

        item = {field: getattr(tenant, field) for field in _LIST_SELECT_FIELDS}
        item["_count"] = {"users": users_count, "expenses": expenses_count}
        items.append(item)

    return {
        "tenants": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit if limit else 0,
        },
    }


# ── POST /platform/tenants — 생성 ────────────────────────────────────────
@router.post("/tenants", status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreateBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        data = validate_create_tenant(body)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    if await _find_by_subdomain(session, data["subdomain"]):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 서브도메인입니다.")

    if data["customDomain"] and await _find_by_custom_domain(session, data["customDomain"]):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 커스텀 도메인입니다.")

    result = await provision_tenant_service(session, data)
    await create_default_roles(session, result.tenant.id)
    seed_result = await seed_default_data(session, result.tenant.id, data["orgType"])

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action="CREATE_TENANT",
        entity_type="tenant",
        entity_id=result.tenant.id,
        tenant_id=result.tenant.id,
        tenant_name=result.tenant.name,
        details={
            "name": result.tenant.name,
            "subdomain": result.tenant.subdomain,
            "plan": result.tenant.plan,
            "orgType": result.tenant.orgType,
            "hasInitialAdmin": bool(data.get("adminEmail")),
            "defaultDataSeeded": vars(seed_result),
            "templatesCloned": {
                "accountCategories": result.account_categories_created,
                "approvalLines": result.approval_lines_cloned,
            },
            "provisionWarnings": result.warnings,
        },
    )

    await session.commit()
    await session.refresh(result.tenant)
    return result.tenant.model_dump()


# ── GET /platform/tenants/{id} — 상세 조회 ───────────────────────────────
@router.get("/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise _tenant_not_found()

    counts = await _tenant_detail_counts(session, tenant_id)
    out = tenant.model_dump()
    out["_count"] = counts
    return out


async def _tenant_detail_counts(session: AsyncSession, tenant_id: str) -> dict:
    async def _count(stmt) -> int:
        return (await session.execute(stmt)).scalar_one()

    users = await _count(select(func.count(User.id)).where(User.tenantId == tenant_id))
    expenses = await _count(
        select(func.count(Expense.id)).where(
            Expense.tenantId == tenant_id, Expense.version != _SIMPLE_EXPENSE_VERSION
        )
    )
    simple_expenses = await _count(
        select(func.count(Expense.id)).where(
            Expense.tenantId == tenant_id, Expense.version == _SIMPLE_EXPENSE_VERSION
        )
    )
    recurring_expenses = await _count(
        select(func.count(RecurringExpense.id)).where(RecurringExpense.tenantId == tenant_id)
    )
    committees = await _count(
        select(func.count(Committee.id)).where(Committee.tenantId == tenant_id)
    )
    budget_categories = await _count(
        select(func.count(BudgetCategory.id)).where(BudgetCategory.tenantId == tenant_id)
    )
    return {
        "users": users,
        "expenses": expenses,
        "simpleExpenses": simple_expenses,
        "recurringExpenses": recurring_expenses,
        "committees": committees,
        "budgetCategories": budget_categories,
    }


# ── PUT/PATCH /platform/tenants/{id} — 수정 ──────────────────────────────
async def _update_tenant(
    tenant_id: str,
    body: TenantUpdateBody,
    request: Request,
    admin: CurrentPlatformAdmin,
    session: AsyncSession,
) -> dict:
    try:
        data = validate_update_tenant(body)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    existing = await _get_tenant_or_404(session, tenant_id)

    if data.get("customDomain") and data["customDomain"] != existing.customDomain:
        if await _find_by_custom_domain(session, data["customDomain"]):
            raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 커스텀 도메인입니다.")

    if "plan" in data and data["plan"] != existing.plan:
        limits = PLAN_LIMITS[data["plan"]]
        data.setdefault("maxUsers", limits["maxUsers"])
        data.setdefault("maxStorageMB", limits["maxStorageMB"])
        data["planStartAt"] = datetime.now(timezone.utc)

    action = "UPDATE_TENANT"
    if data.get("isActive") is False and existing.isActive is True:
        data["suspendedAt"] = datetime.now(timezone.utc)
        action = "SUSPEND_TENANT"
    elif data.get("isActive") is True and existing.isActive is False:
        data["suspendedAt"] = None
        data["suspendReason"] = None
        action = "ACTIVATE_TENANT"

    before = {"name": existing.name, "plan": existing.plan, "isActive": existing.isActive}

    for key, value in data.items():
        setattr(existing, key, value)
    session.add(existing)
    await session.flush()

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action=action,
        entity_type="tenant",
        entity_id=tenant_id,
        tenant_id=tenant_id,
        tenant_name=existing.name,
        details={
            "changes": data,
            "before": before,
            "after": {
                "name": existing.name,
                "plan": existing.plan,
                "isActive": existing.isActive,
            },
        },
    )

    await session.commit()
    await session.refresh(existing)
    return existing.model_dump()


@router.put("/tenants/{tenant_id}")
async def update_tenant_put(
    tenant_id: str,
    body: TenantUpdateBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await _update_tenant(tenant_id, body, request, admin, session)


@router.patch("/tenants/{tenant_id}")
async def update_tenant_patch(
    tenant_id: str,
    body: TenantUpdateBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await _update_tenant(tenant_id, body, request, admin, session)


# ── DELETE /platform/tenants/{id} — 삭제(소프트/하드) ────────────────────
@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    request: Request,
    hard: bool = False,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    existing = await _get_tenant_or_404(session, tenant_id)

    users_count = (
        await session.execute(select(func.count(User.id)).where(User.tenantId == tenant_id))
    ).scalar_one()
    expenses_count = (
        await session.execute(
            select(func.count(Expense.id)).where(Expense.tenantId == tenant_id)
        )
    ).scalar_one()

    if hard:
        if expenses_count > 0 or users_count > 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "데이터가 있는 테넌트는 완전 삭제할 수 없습니다. "
                "먼저 데이터를 삭제하거나 소프트 삭제를 사용하세요.",
            )

        await session.delete(existing)

        await log_platform_activity(
            session,
            request,
            super_admin_id=admin.id,
            super_admin_email=admin.email,
            action="DELETE_TENANT",
            entity_type="tenant",
            entity_id=tenant_id,
            tenant_name=existing.name,
            details={
                "deleteType": "hard",
                "tenantInfo": {
                    "name": existing.name,
                    "subdomain": existing.subdomain,
                    "plan": existing.plan,
                },
            },
        )

        await session.commit()
        return {"message": "테넌트가 완전히 삭제되었습니다."}

    existing.isActive = False
    existing.suspendedAt = datetime.now(timezone.utc)
    existing.suspendReason = "관리자에 의해 삭제됨"
    session.add(existing)
    await session.flush()

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action="DELETE_TENANT",
        entity_type="tenant",
        entity_id=tenant_id,
        tenant_id=tenant_id,
        tenant_name=existing.name,
        details={
            "deleteType": "soft",
            "tenantInfo": {
                "name": existing.name,
                "subdomain": existing.subdomain,
                "plan": existing.plan,
            },
        },
    )

    await session.commit()
    await session.refresh(existing)
    return {"message": "테넌트가 비활성화되었습니다.", "tenant": existing.model_dump()}


# ── GET /platform/tenants/{id}/settings — 설정 조회 ──────────────────────
@router.get("/tenants/{tenant_id}/settings")
async def get_tenant_settings(
    tenant_id: str,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise _tenant_not_found()

    current_settings = tenant.settings or {}
    merged = merge_deep(DEFAULT_SETTINGS, current_settings)

    return {
        "tenant": {"id": tenant.id, "name": tenant.name, "subdomain": tenant.subdomain},
        "settings": merged,
        "defaults": DEFAULT_SETTINGS,
    }


# ── PUT/PATCH /platform/tenants/{id}/settings — 설정 갱신 ────────────────
async def _update_tenant_settings(
    tenant_id: str,
    body: TenantSettingsBody,
    request: Request,
    admin: CurrentPlatformAdmin,
    session: AsyncSession,
) -> dict:
    try:
        validated = validate_tenant_settings(body)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    existing = await _get_tenant_or_404(session, tenant_id)

    current_settings = existing.settings or {}
    merged_settings = merge_deep(current_settings, validated)

    existing.settings = merged_settings
    session.add(existing)
    await session.flush()

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action="UPDATE_TENANT_SETTINGS",
        entity_type="settings",
        entity_id=tenant_id,
        tenant_id=tenant_id,
        tenant_name=existing.name,
        details={"changes": validated, "changedSections": list(validated.keys())},
    )

    await session.commit()
    await session.refresh(existing)
    return {"message": "설정이 저장되었습니다.", "settings": existing.settings}


@router.put("/tenants/{tenant_id}/settings")
async def update_tenant_settings_put(
    tenant_id: str,
    body: TenantSettingsBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await _update_tenant_settings(tenant_id, body, request, admin, session)


@router.patch("/tenants/{tenant_id}/settings")
async def update_tenant_settings_patch(
    tenant_id: str,
    body: TenantSettingsBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await _update_tenant_settings(tenant_id, body, request, admin, session)
