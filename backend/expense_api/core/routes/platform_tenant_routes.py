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
from expense_api.core.schemas.tenant_user import (
    TenantUserCreateBody,
    TenantUserUpdateBody,
    validate_create_tenant_user,
    validate_update_tenant_user,
)
from expense_api.core.security.jwt import hash_password
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


def _tenant_user_not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")


async def _get_tenant_user_or_404(session: AsyncSession, tenant_id: str, user_id: str) -> User:
    user = (
        await session.execute(
            select(User).where(User.id == user_id, User.tenantId == tenant_id)
        )
    ).scalars().first()
    if user is None:
        raise _tenant_user_not_found()
    return user


_USER_SELECT_FIELDS = (
    "id", "userid", "username", "role", "department", "phoneNumber", "isActive",
    "createdAt", "updatedAt",
)


# ── GET /platform/tenants/{id}/users — 사용자 목록 ───────────────────────
@router.get("/tenants/{tenant_id}/users")
async def list_tenant_users(
    tenant_id: str,
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    role: str | None = None,
    isActive: bool | None = None,
    sortBy: str = "createdAt",
    sortOrder: str = "desc",
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    page = max(page, 1)
    limit = min(max(limit, 1), 100)

    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise _tenant_not_found()

    where = [User.tenantId == tenant_id]
    if search:
        pattern = f"%{search}%"
        where.append(
            (User.userid.ilike(pattern))
            | (User.username.ilike(pattern))
            | (User.phoneNumber.ilike(pattern))
        )
    if role:
        where.append(User.role == role)
    if isActive is not None:
        where.append(User.isActive == isActive)

    total = (await session.execute(select(func.count(User.id)).where(*where))).scalar_one()

    sort_column = getattr(User, sortBy, User.createdAt)
    order = sort_column.desc() if sortOrder == "desc" else sort_column.asc()

    users = (
        (
            await session.execute(
                select(User)
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
    for user in users:
        expenses_count = (
            await session.execute(
                select(func.count(Expense.id)).where(Expense.userId == user.id)
            )
        ).scalar_one()
        item = {field: getattr(user, field) for field in _USER_SELECT_FIELDS}
        item["_count"] = {"expenses": expenses_count}
        items.append(item)

    return {
        "users": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit if limit else 0,
        },
        "limits": {
            "maxUsers": tenant.maxUsers,
            "currentUsers": total,
        },
    }


# ── POST /platform/tenants/{id}/users — 사용자 생성 ──────────────────────
@router.post("/tenants/{tenant_id}/users", status_code=status.HTTP_201_CREATED)
async def create_tenant_user(
    tenant_id: str,
    body: TenantUserCreateBody,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        data = validate_create_tenant_user(body)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise _tenant_not_found()

    if not tenant.isActive:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "비활성화된 테넌트에는 사용자를 추가할 수 없습니다."
        )

    current_user_count = (
        await session.execute(
            select(func.count(User.id)).where(User.tenantId == tenant_id, User.isActive == True)  # noqa: E712
        )
    ).scalar_one()

    if current_user_count >= tenant.maxUsers:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"사용자 수 제한({tenant.maxUsers}명)에 도달했습니다. "
            "요금제를 업그레이드하거나 기존 사용자를 비활성화하세요.",
        )

    existing_user = (
        await session.execute(
            select(User).where(User.tenantId == tenant_id, User.userid == data["userid"])
        )
    ).scalars().first()
    if existing_user:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 아이디입니다.")

    user = User(
        tenantId=tenant_id,
        userid=data["userid"],
        username=data["username"],
        password=hash_password(data["password"]),
        role=data["role"],
        department=data["department"],
        phoneNumber=data["phoneNumber"],
        isActive=True,
    )
    session.add(user)
    await session.flush()

    tenant.currentUsers = current_user_count + 1
    session.add(tenant)

    await session.commit()
    await session.refresh(user)

    return {field: getattr(user, field) for field in ("id", "userid", "username", "role", "department", "phoneNumber", "isActive", "createdAt")}


# ── GET /platform/tenants/{id}/users/{userId} — 사용자 상세 ──────────────
@router.get("/tenants/{tenant_id}/users/{user_id}")
async def get_tenant_user(
    tenant_id: str,
    user_id: str,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise _tenant_not_found()

    user = await _get_tenant_user_or_404(session, tenant_id, user_id)

    expenses_count = (
        await session.execute(
            select(func.count(Expense.id)).where(Expense.userId == user.id)
        )
    ).scalar_one()

    recent_expenses = (
        (
            await session.execute(
                select(Expense)
                .where(Expense.tenantId == tenant_id, Expense.applicantName == user.username)
                .order_by(Expense.createdAt.desc())
                .limit(5)
            )
        )
        .scalars()
        .all()
    )

    out = {field: getattr(user, field) for field in _USER_SELECT_FIELDS}
    out["_count"] = {"expenses": expenses_count}
    out["recentActivity"] = {
        "expenses": [
            {
                "id": e.id,
                "requestAmount": e.requestAmount,
                "status": e.status,
                "createdAt": e.createdAt,
            }
            for e in recent_expenses
        ]
    }
    return out


# ── PUT /platform/tenants/{id}/users/{userId} — 사용자 수정 ──────────────
@router.put("/tenants/{tenant_id}/users/{user_id}")
async def update_tenant_user(
    tenant_id: str,
    user_id: str,
    body: TenantUserUpdateBody,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        data = validate_update_tenant_user(body)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    existing_user = await _get_tenant_user_or_404(session, tenant_id, user_id)

    if "isActive" in data and data["isActive"] != existing_user.isActive:
        tenant = await session.get(Tenant, tenant_id)
        if data["isActive"]:
            active_user_count = (
                await session.execute(
                    select(func.count(User.id)).where(
                        User.tenantId == tenant_id, User.isActive == True  # noqa: E712
                    )
                )
            ).scalar_one()
            if tenant and active_user_count >= tenant.maxUsers:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"사용자 수 제한({tenant.maxUsers}명)에 도달했습니다.",
                )

    if "password" in data:
        data["password"] = hash_password(data.pop("password"))

    for key, value in data.items():
        setattr(existing_user, key, value)
    session.add(existing_user)
    await session.flush()

    if "isActive" in data:
        active_user_count = (
            await session.execute(
                select(func.count(User.id)).where(
                    User.tenantId == tenant_id, User.isActive == True  # noqa: E712
                )
            )
        ).scalar_one()
        tenant = await session.get(Tenant, tenant_id)
        if tenant is not None:
            tenant.currentUsers = active_user_count
            session.add(tenant)

    await session.commit()
    await session.refresh(existing_user)

    return {
        field: getattr(existing_user, field)
        for field in ("id", "userid", "username", "role", "department", "phoneNumber", "isActive", "createdAt", "updatedAt")
    }


# ── DELETE /platform/tenants/{id}/users/{userId} — 사용자 삭제(소프트/하드) ──
@router.delete("/tenants/{tenant_id}/users/{user_id}")
async def delete_tenant_user(
    tenant_id: str,
    user_id: str,
    hard: bool = False,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    existing_user = await _get_tenant_user_or_404(session, tenant_id, user_id)

    expenses_count = (
        await session.execute(
            select(func.count(Expense.id)).where(Expense.userId == existing_user.id)
        )
    ).scalar_one()

    if hard:
        if expenses_count > 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "지출 기록이 있는 사용자는 완전히 삭제할 수 없습니다. 비활성화를 사용하세요.",
            )

        was_active = existing_user.isActive
        await session.delete(existing_user)
        await session.flush()

        if was_active:
            active_user_count = (
                await session.execute(
                    select(func.count(User.id)).where(
                        User.tenantId == tenant_id, User.isActive == True  # noqa: E712
                    )
                )
            ).scalar_one()
            tenant = await session.get(Tenant, tenant_id)
            if tenant is not None:
                tenant.currentUsers = active_user_count
                session.add(tenant)

        await session.commit()
        return {"message": "사용자가 완전히 삭제되었습니다."}

    was_active = existing_user.isActive
    existing_user.isActive = False
    session.add(existing_user)
    await session.flush()

    if was_active:
        # Next 원본 소프트삭제 분기와 동일하게 활성 사용자 수를 조회 후 -1 을 적용한다
        # (원본의 activeUserCount - 1 산식을 그대로 재현 — 하드삭제 분기와 다르게 이미
        # 대상 사용자가 카운트에서 빠진 값에서 한 번 더 차감하는 로직이나, 컷오버 시점에
        # 임의로 정정하지 않고 원본 계약을 그대로 따른다).
        active_user_count = (
            await session.execute(
                select(func.count(User.id)).where(
                    User.tenantId == tenant_id, User.isActive == True  # noqa: E712
                )
            )
        ).scalar_one()
        tenant = await session.get(Tenant, tenant_id)
        if tenant is not None:
            tenant.currentUsers = active_user_count - 1
            session.add(tenant)

    await session.commit()
    return {"message": "사용자가 비활성화되었습니다."}


# ── GET /platform/tenants/{id}/stats — 테넌트 사용량 통계 ────────────────
@router.get("/tenants/{tenant_id}/stats")
async def get_tenant_stats(
    tenant_id: str,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise _tenant_not_found()

    now = datetime.now(timezone.utc)
    this_month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    this_year_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)

    async def _agg(where_clause) -> tuple[int, int]:
        count = (
            await session.execute(select(func.count(Expense.id)).where(*where_clause))
        ).scalar_one()
        amount = (
            await session.execute(select(func.sum(Expense.requestAmount)).where(*where_clause))
        ).scalar_one()
        return count, amount or 0

    users_count = (
        await session.execute(select(func.count(User.id)).where(User.tenantId == tenant_id))
    ).scalar_one()

    total_count, total_amount = await _agg([Expense.tenantId == tenant_id])
    month_count, month_amount = await _agg(
        [Expense.tenantId == tenant_id, Expense.createdAt >= this_month_start]
    )
    year_count, year_amount = await _agg(
        [Expense.tenantId == tenant_id, Expense.createdAt >= this_year_start]
    )

    status_rows = (
        await session.execute(
            select(Expense.status, func.count(Expense.id))
            .where(Expense.tenantId == tenant_id)
            .group_by(Expense.status)
        )
    ).all()
    by_status = {row[0]: row[1] for row in status_rows}

    recent_rows = (
        (
            await session.execute(
                select(Expense)
                .where(Expense.tenantId == tenant_id)
                .order_by(Expense.createdAt.desc())
                .limit(10)
            )
        )
        .scalars()
        .all()
    )
    recent_activity = [
        {
            "id": e.id,
            "applicantName": e.applicantName,
            "requestAmount": e.requestAmount,
            "status": e.status,
            "createdAt": e.createdAt,
        }
        for e in recent_rows
    ]

    monthly_trend = []
    for i in range(6):
        month_index = now.month - 1 - i
        year_offset, month_offset = divmod(month_index, 12)
        target_year = now.year + year_offset
        target_month = month_offset + 1
        start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)

        m_count, m_amount = await _agg(
            [
                Expense.tenantId == tenant_id,
                Expense.createdAt >= start_date,
                Expense.createdAt < end_date,
            ]
        )
        monthly_trend.append(
            {"month": start_date.strftime("%Y-%m"), "count": m_count, "amount": m_amount}
        )
    monthly_trend.reverse()

    return {
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "subdomain": tenant.subdomain,
            "plan": tenant.plan,
            "createdAt": tenant.createdAt,
        },
        "usage": {
            "users": {
                "current": users_count,
                "max": tenant.maxUsers,
                "percentage": round((users_count / tenant.maxUsers) * 100) if tenant.maxUsers else 0,
            },
            "storage": {
                "currentMB": tenant.currentStorage,
                "maxMB": tenant.maxStorageMB,
                "percentage": (
                    round((tenant.currentStorage / tenant.maxStorageMB) * 100)
                    if tenant.maxStorageMB
                    else 0
                ),
            },
        },
        "expenses": {
            "total": {"count": total_count, "amount": total_amount},
            "thisMonth": {"count": month_count, "amount": month_amount},
            "thisYear": {"count": year_count, "amount": year_amount},
            "byStatus": by_status,
        },
        "monthlyTrend": monthly_trend,
        "recentActivity": recent_activity,
    }
