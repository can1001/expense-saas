"""플랫폼 운영 라우터 (P4, app/api/platform/{admins,activity-logs,settings,stats} 이전).

platform 은 테넌트 스코프 예외 — platform 관리자 인증으로 대신 강제한다.
"""

import json
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.platform_auth import (
    CurrentPlatformAdmin,
    get_current_platform_admin,
)
from expense_api.core.models.expense import Expense
from expense_api.core.models.system_setting import SystemSetting
from expense_api.core.models.tenant import PlatformActivityLog, SuperAdmin, Tenant
from expense_api.core.models.user import User
from expense_api.core.schemas.tenant_settings import merge_deep
from expense_api.core.security.jwt import hash_password
from expense_api.core.service.platform_activity_log_service import log_platform_activity

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_ADMIN_SELECT_FIELDS = ("id", "email", "name", "isActive", "createdAt", "updatedAt")

_SETTINGS_KEY = "platform_settings"

DEFAULT_PLATFORM_SETTINGS: dict = {
    "general": {
        "platformName": "Expense SaaS",
        "platformDomain": "",
        "supportEmail": "",
        "logoUrl": "",
        "faviconUrl": "",
        "footerText": "",
    },
    "security": {
        "defaultSessionTimeoutMinutes": 60,
        "defaultPasswordMinLength": 8,
        "requirePasswordUppercase": True,
        "requirePasswordNumber": True,
        "requirePasswordSpecial": False,
        "maxLoginAttempts": 5,
        "lockoutDurationMinutes": 15,
    },
    "defaults": {
        "defaultPlan": "FREE",
        "defaultOrgType": "CHURCH",
        "trialDays": 14,
        "autoCreateAdminRole": True,
    },
    "maintenance": {
        "enabled": False,
        "message": "시스템 점검 중입니다. 잠시 후 다시 시도해 주세요.",
        "allowedIPs": [],
        "scheduledStart": "",
        "scheduledEnd": "",
    },
    "email": {
        "smtpHost": "",
        "smtpPort": 587,
        "smtpUser": "",
        "smtpFromEmail": "",
        "smtpFromName": "Expense SaaS",
    },
}


# ── admins ───────────────────────────────────────────────────────────────


class AdminCreateBody(BaseModel):
    email: str | None = None
    password: str | None = None
    name: str | None = None
    isActive: bool | None = None


class AdminUpdateBody(BaseModel):
    email: str | None = None
    name: str | None = None
    isActive: bool | None = None
    password: str | None = None


def _validate_create_admin(body: AdminCreateBody) -> dict:
    email = (body.email or "").strip()
    if not _EMAIL_RE.match(email):
        raise ValueError("유효한 이메일을 입력하세요.")
    password = body.password or ""
    if len(password) < 8:
        raise ValueError("비밀번호는 최소 8자 이상이어야 합니다.")
    name = (body.name or "").strip()
    if not (2 <= len(name) <= 50):
        raise ValueError("이름은 최소 2자 이상이어야 합니다.")
    return {
        "email": email,
        "password": password,
        "name": name,
        "isActive": body.isActive if body.isActive is not None else True,
    }


def _validate_update_admin(body: AdminUpdateBody) -> dict:
    data: dict = {}
    if body.email is not None:
        email = body.email.strip()
        if not _EMAIL_RE.match(email):
            raise ValueError("유효한 이메일을 입력하세요.")
        data["email"] = email
    if body.name is not None:
        if not (2 <= len(body.name) <= 50):
            raise ValueError("이름은 2~50자 사이여야 합니다.")
        data["name"] = body.name
    if body.isActive is not None:
        data["isActive"] = body.isActive
    if body.password is not None:
        if len(body.password) < 8:
            raise ValueError("비밀번호는 최소 8자 이상이어야 합니다.")
        data["password"] = body.password
    return data


def _admin_not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "관리자를 찾을 수 없습니다.")


async def _get_admin_or_404(session: AsyncSession, admin_id: str) -> SuperAdmin:
    admin = await session.get(SuperAdmin, admin_id)
    if admin is None:
        raise _admin_not_found()
    return admin


@router.get("/admins")
async def list_admins(
    search: str | None = None,
    includeInactive: bool = False,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    where = []
    if search:
        pattern = f"%{search}%"
        where.append((SuperAdmin.email.ilike(pattern)) | (SuperAdmin.name.ilike(pattern)))
    if not includeInactive:
        where.append(SuperAdmin.isActive == True)  # noqa: E712

    admins = (
        (
            await session.execute(
                select(SuperAdmin).where(*where).order_by(SuperAdmin.createdAt.desc())
            )
        )
        .scalars()
        .all()
    )

    total = (await session.execute(select(func.count(SuperAdmin.id)))).scalar_one()
    active = (
        await session.execute(
            select(func.count(SuperAdmin.id)).where(SuperAdmin.isActive == True)  # noqa: E712
        )
    ).scalar_one()

    return {
        "admins": [
            {field: getattr(a, field) for field in _ADMIN_SELECT_FIELDS} for a in admins
        ],
        "stats": {"total": total, "active": active},
    }


@router.post("/admins", status_code=status.HTTP_201_CREATED)
async def create_admin(
    body: AdminCreateBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        data = _validate_create_admin(body)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    existing = (
        await session.execute(select(SuperAdmin).where(SuperAdmin.email == data["email"]))
    ).scalars().first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 등록된 이메일입니다.")

    new_admin = SuperAdmin(
        email=data["email"],
        password=hash_password(data["password"]),
        name=data["name"],
        isActive=data["isActive"],
    )
    session.add(new_admin)
    await session.flush()

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action="CREATE_USER",
        entity_type="user",
        entity_id=new_admin.id,
        details={
            "targetType": "superAdmin",
            "email": new_admin.email,
            "name": new_admin.name,
        },
    )

    await session.commit()
    await session.refresh(new_admin)
    return {
        "id": new_admin.id,
        "email": new_admin.email,
        "name": new_admin.name,
        "isActive": new_admin.isActive,
        "createdAt": new_admin.createdAt,
    }


@router.put("/admins/{admin_id}")
async def update_admin(
    admin_id: str,
    body: AdminUpdateBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        data = _validate_update_admin(body)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    existing = await _get_admin_or_404(session, admin_id)

    if "email" in data and data["email"] != existing.email:
        email_exists = (
            await session.execute(select(SuperAdmin).where(SuperAdmin.email == data["email"]))
        ).scalars().first()
        if email_exists:
            raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 이메일입니다.")

    if data.get("isActive") is False:
        active_count = (
            await session.execute(
                select(func.count(SuperAdmin.id)).where(SuperAdmin.isActive == True)  # noqa: E712
            )
        ).scalar_one()
        if active_count <= 1 and existing.isActive:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "최소 1명의 활성 관리자가 필요합니다.")

    changed_fields = [k for k in data if k != "password"]
    password_changed = "password" in data
    if "password" in data:
        data["password"] = hash_password(data.pop("password"))

    for key, value in data.items():
        setattr(existing, key, value)
    session.add(existing)
    await session.flush()

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action="DEACTIVATE_USER" if data.get("isActive") is False else "UPDATE_USER",
        entity_type="user",
        entity_id=admin_id,
        details={
            "targetType": "superAdmin",
            "targetEmail": existing.email,
            "changes": changed_fields,
            "passwordChanged": password_changed,
        },
    )

    await session.commit()
    await session.refresh(existing)
    return {field: getattr(existing, field) for field in _ADMIN_SELECT_FIELDS}


@router.patch("/admins/{admin_id}")
async def update_admin_patch(
    admin_id: str,
    body: AdminUpdateBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await update_admin(admin_id, body, request, admin, session)


@router.delete("/admins/{admin_id}")
async def delete_admin(
    admin_id: str,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    existing = await _get_admin_or_404(session, admin_id)

    if admin_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "자기 자신은 삭제할 수 없습니다.")

    total_count = (await session.execute(select(func.count(SuperAdmin.id)))).scalar_one()
    if total_count <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "최소 1명의 관리자가 필요합니다.")

    await session.delete(existing)

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action="DELETE_USER",
        entity_type="user",
        entity_id=admin_id,
        details={
            "targetType": "superAdmin",
            "deletedEmail": existing.email,
            "deletedName": existing.name,
        },
    )

    await session.commit()
    return {"message": "관리자가 삭제되었습니다."}


# ── activity-logs ────────────────────────────────────────────────────────


@router.get("/activity-logs")
async def list_activity_logs(
    page: int = 1,
    limit: int = 20,
    tenantId: str | None = None,
    action: str | None = None,
    entityType: str | None = None,
    startDate: str | None = None,
    endDate: str | None = None,
    search: str | None = None,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    page = max(page, 1)
    limit = min(limit, 100)

    where = []
    if tenantId:
        where.append(PlatformActivityLog.tenantId == tenantId)
    if action:
        where.append(PlatformActivityLog.action == action)
    if entityType:
        where.append(PlatformActivityLog.entityType == entityType)
    if startDate:
        where.append(PlatformActivityLog.createdAt >= datetime.fromisoformat(startDate))
    if endDate:
        end = datetime.fromisoformat(endDate).replace(
            hour=23, minute=59, second=59, microsecond=999000
        )
        where.append(PlatformActivityLog.createdAt <= end)
    if search:
        pattern = f"%{search}%"
        where.append(
            (PlatformActivityLog.superAdminEmail.ilike(pattern))
            | (PlatformActivityLog.tenantName.ilike(pattern))
            | (PlatformActivityLog.entityId.ilike(pattern))
        )

    total = (
        await session.execute(select(func.count(PlatformActivityLog.id)).where(*where))
    ).scalar_one()
    logs = (
        (
            await session.execute(
                select(PlatformActivityLog)
                .where(*where)
                .order_by(PlatformActivityLog.createdAt.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )

    # Next 원본: 액션별 통계는 startDate/endDate 가 있을 때만 그 외 필터(tenantId 등) 포함 where 를
    # 그대로 재사용하고, 날짜 필터가 없으면 전체 로그를 대상으로 집계한다 — 원본 계약 그대로 재현.
    stats_where = where if (startDate or endDate) else []
    action_rows = (
        await session.execute(
            select(PlatformActivityLog.action, func.count(PlatformActivityLog.id))
            .where(*stats_where)
            .group_by(PlatformActivityLog.action)
        )
    ).all()

    return {
        "logs": [log.model_dump() for log in logs],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit if limit else 0,
        },
        "stats": {"byAction": {row[0]: row[1] for row in action_rows}},
    }


# ── settings ─────────────────────────────────────────────────────────────


class PlatformSettingsBody(BaseModel):
    general: dict | None = None
    security: dict | None = None
    defaults: dict | None = None
    maintenance: dict | None = None
    email: dict | None = None


def _validate_platform_settings(body: PlatformSettingsBody) -> dict:
    result: dict = {}

    if body.general is not None:
        general = dict(body.general)
        name = general.get("platformName")
        if name is not None and not (1 <= len(name) <= 100):
            raise ValueError("platformName 은 1~100자 사이여야 합니다")
        support_email = general.get("supportEmail")
        if support_email and not _EMAIL_RE.match(support_email):
            raise ValueError("supportEmail 형식이 올바르지 않습니다")
        result["general"] = general

    if body.security is not None:
        security = dict(body.security)
        timeout = security.get("defaultSessionTimeoutMinutes")
        if timeout is not None and not (5 <= timeout <= 1440):
            raise ValueError("defaultSessionTimeoutMinutes 는 5~1440 사이여야 합니다")
        min_len = security.get("defaultPasswordMinLength")
        if min_len is not None and not (6 <= min_len <= 32):
            raise ValueError("defaultPasswordMinLength 는 6~32 사이여야 합니다")
        max_attempts = security.get("maxLoginAttempts")
        if max_attempts is not None and not (3 <= max_attempts <= 10):
            raise ValueError("maxLoginAttempts 는 3~10 사이여야 합니다")
        lockout = security.get("lockoutDurationMinutes")
        if lockout is not None and not (1 <= lockout <= 60):
            raise ValueError("lockoutDurationMinutes 는 1~60 사이여야 합니다")
        result["security"] = security

    if body.defaults is not None:
        defaults = dict(body.defaults)
        trial_days = defaults.get("trialDays")
        if trial_days is not None and not (0 <= trial_days <= 90):
            raise ValueError("trialDays 는 0~90 사이여야 합니다")
        result["defaults"] = defaults

    if body.maintenance is not None:
        result["maintenance"] = dict(body.maintenance)

    if body.email is not None:
        email = dict(body.email)
        smtp_port = email.get("smtpPort")
        if smtp_port is not None and not (1 <= smtp_port <= 65535):
            raise ValueError("smtpPort 는 1~65535 사이여야 합니다")
        from_email = email.get("smtpFromEmail")
        if from_email and not _EMAIL_RE.match(from_email):
            raise ValueError("smtpFromEmail 형식이 올바르지 않습니다")
        result["email"] = email

    return result


async def _get_platform_settings_row(session: AsyncSession) -> SystemSetting | None:
    return (
        await session.execute(
            select(SystemSetting).where(
                SystemSetting.tenantId.is_(None), SystemSetting.key == _SETTINGS_KEY
            )
        )
    ).scalars().first()


@router.get("/settings")
async def get_platform_settings(
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    setting = await _get_platform_settings_row(session)

    current_settings: dict = {}
    if setting and setting.value:
        try:
            current_settings = json.loads(setting.value)
        except (TypeError, ValueError):
            current_settings = {}

    merged = merge_deep(DEFAULT_PLATFORM_SETTINGS, current_settings)

    return {
        "settings": merged,
        "defaults": DEFAULT_PLATFORM_SETTINGS,
        "updatedAt": setting.updatedAt if setting else None,
    }


@router.put("/settings")
async def update_platform_settings(
    body: PlatformSettingsBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        validated = _validate_platform_settings(body)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    existing_setting = await _get_platform_settings_row(session)

    current_settings: dict = {}
    if existing_setting and existing_setting.value:
        try:
            current_settings = json.loads(existing_setting.value)
        except (TypeError, ValueError):
            current_settings = {}

    merged_settings = merge_deep(current_settings, validated)
    settings_json = json.dumps(merged_settings)

    if existing_setting:
        existing_setting.value = settings_json
        existing_setting.description = "플랫폼 전역 설정"
        session.add(existing_setting)
    else:
        session.add(
            SystemSetting(
                tenantId=None,
                key=_SETTINGS_KEY,
                value=settings_json,
                description="플랫폼 전역 설정",
            )
        )
    await session.flush()

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action="UPDATE_TENANT_SETTINGS",
        entity_type="settings",
        entity_id="platform",
        details={"changedSections": list(validated.keys()), "changes": validated},
    )

    await session.commit()
    return {"message": "설정이 저장되었습니다.", "settings": merged_settings}


@router.patch("/settings")
async def update_platform_settings_patch(
    body: PlatformSettingsBody,
    request: Request,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await update_platform_settings(body, request, admin, session)


# ── stats ────────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_platform_stats(
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    now = datetime.now()
    this_month = datetime(now.year, now.month, 1)
    if now.month == 1:
        last_month = datetime(now.year - 1, 12, 1)
    else:
        last_month = datetime(now.year, now.month - 1, 1)
    this_year = datetime(now.year, 1, 1)

    tenant_count = (await session.execute(select(func.count(Tenant.id)))).scalar_one()
    tenant_users_sum = (
        await session.execute(select(func.sum(Tenant.currentUsers)))
    ).scalar_one() or 0
    tenant_storage_sum = (
        await session.execute(select(func.sum(Tenant.currentStorage)))
    ).scalar_one() or 0
    active_tenant_count = (
        await session.execute(select(func.count(Tenant.id)).where(Tenant.isActive == True))  # noqa: E712
    ).scalar_one()
    active_user_count = (
        await session.execute(select(func.count(User.id)).where(User.isActive == True))  # noqa: E712
    ).scalar_one()

    async def _expense_agg(where_clause: list) -> tuple[int, int]:
        count = (
            await session.execute(select(func.count(Expense.id)).where(*where_clause))
        ).scalar_one()
        amount = (
            await session.execute(select(func.sum(Expense.requestAmount)).where(*where_clause))
        ).scalar_one()
        return count, amount or 0

    total_count, total_amount = await _expense_agg([])
    month_count, month_amount = await _expense_agg([Expense.createdAt >= this_month])
    last_month_count, last_month_amount = await _expense_agg(
        [Expense.createdAt >= last_month, Expense.createdAt < this_month]
    )
    year_count, year_amount = await _expense_agg([Expense.createdAt >= this_year])

    plan_rows = (
        await session.execute(select(Tenant.plan, func.count(Tenant.id)).group_by(Tenant.plan))
    ).all()
    org_type_rows = (
        await session.execute(
            select(Tenant.orgType, func.count(Tenant.id)).group_by(Tenant.orgType)
        )
    ).all()

    recent_tenants = (
        (
            await session.execute(
                select(Tenant).order_by(Tenant.createdAt.desc()).limit(5)
            )
        )
        .scalars()
        .all()
    )

    near_limit_tenants = (
        (
            await session.execute(
                select(Tenant).where(Tenant.isActive == True, Tenant.maxUsers > 0)  # noqa: E712
            )
        )
        .scalars()
        .all()
    )
    tenants_near_limit = sorted(
        (
            {
                "id": t.id,
                "name": t.name,
                "subdomain": t.subdomain,
                "currentUsers": t.currentUsers,
                "maxUsers": t.maxUsers,
                "usagePercent": round(t.currentUsers / t.maxUsers * 100),
            }
            for t in near_limit_tenants
            if t.currentUsers / t.maxUsers >= 0.8
        ),
        key=lambda x: x["usagePercent"],
        reverse=True,
    )[:5]

    monthly_trend = []
    for i in range(6):
        month_index = now.month - 1 - i
        year_offset, month_offset = divmod(month_index, 12)
        target_year = now.year + year_offset
        target_month = month_offset + 1
        start_date = datetime(target_year, target_month, 1)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1)
        else:
            end_date = datetime(target_year, target_month + 1, 1)

        m_count, m_amount = await _expense_agg(
            [Expense.createdAt >= start_date, Expense.createdAt < end_date]
        )
        new_tenants = (
            await session.execute(
                select(func.count(Tenant.id)).where(
                    Tenant.createdAt >= start_date, Tenant.createdAt < end_date
                )
            )
        ).scalar_one()
        new_users = (
            await session.execute(
                select(func.count(User.id)).where(
                    User.createdAt >= start_date, User.createdAt < end_date
                )
            )
        ).scalar_one()
        monthly_trend.append(
            {
                "month": start_date.strftime("%Y-%m"),
                "expenses": {"count": m_count, "amount": m_amount},
                "newTenants": new_tenants,
                "newUsers": new_users,
            }
        )
    monthly_trend.reverse()

    expense_growth = (
        round((month_amount - last_month_amount) / last_month_amount * 100)
        if last_month_amount > 0
        else 0
    )

    return {
        "overview": {
            "tenants": {
                "total": tenant_count,
                "active": active_tenant_count,
                "inactive": tenant_count - active_tenant_count,
            },
            "users": {
                "total": tenant_users_sum,
                "active": active_user_count,
            },
            "storage": {
                "totalMB": tenant_storage_sum,
                "totalGB": round(tenant_storage_sum / 1024 * 10) / 10,
            },
            "expenses": {
                "total": {"count": total_count, "amount": total_amount},
                "thisMonth": {"count": month_count, "amount": month_amount},
                "thisYear": {"count": year_count, "amount": year_amount},
                "growth": expense_growth,
            },
        },
        "distribution": {
            "byPlan": {row[0]: row[1] for row in plan_rows},
            "byOrgType": {row[0]: row[1] for row in org_type_rows},
        },
        "monthlyTrend": monthly_trend,
        "recentTenants": [
            {
                "id": t.id,
                "name": t.name,
                "subdomain": t.subdomain,
                "plan": t.plan,
                "orgType": t.orgType,
                "isActive": t.isActive,
                "currentUsers": t.currentUsers,
                "createdAt": t.createdAt,
            }
            for t in recent_tenants
        ],
        "alerts": {"tenantsNearUserLimit": tenants_near_limit},
    }
