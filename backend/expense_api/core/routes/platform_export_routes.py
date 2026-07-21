"""플랫폼 데이터 내보내기 라우터 (P5, app/api/platform/export 이전).

platform 은 테넌트 스코프 예외 — platform 관리자 인증으로 대신 강제한다.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.platform_auth import (
    CurrentPlatformAdmin,
    get_current_platform_admin,
)
from expense_api.core.models.expense import Expense
from expense_api.core.models.tenant import PlatformActivityLog, SuperAdmin, Tenant
from expense_api.core.models.user import User
from expense_api.core.service.platform_activity_log_service import log_platform_activity

router = APIRouter()


def _escape_csv(value: object) -> str:
    if value is None:
        return ""
    text = str(value)
    if "," in text or '"' in text or "\n" in text:
        return '"' + text.replace('"', '""') + '"'
    return text


def _to_csv(headers: list[str], rows: list[list[object]]) -> str:
    header_line = ",".join(_escape_csv(h) for h in headers)
    data_lines = [",".join(_escape_csv(v) for v in row) for row in rows]
    return "\n".join([header_line, *data_lines])


def _format_date(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.date().isoformat()


def _format_amount(amount: int | None) -> str:
    if amount is None:
        return ""
    return f"{amount:,}"


def _iso_z(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


async def _export_tenants(session: AsyncSession) -> tuple[list[dict], list[str], list[list[object]]]:
    tenants = (
        (await session.execute(select(Tenant).order_by(Tenant.createdAt.desc()))).scalars().all()
    )

    data: list[dict] = []
    rows: list[list[object]] = []
    for t in tenants:
        expenses_count = (
            await session.execute(select(func.count(Expense.id)).where(Expense.tenantId == t.id))
        ).scalar_one()
        users_count = (
            await session.execute(select(func.count(User.id)).where(User.tenantId == t.id))
        ).scalar_one()

        item = t.model_dump()
        item["_count"] = {"users": users_count, "expenses": expenses_count}
        data.append(item)

        rows.append(
            [
                t.id,
                t.name,
                t.subdomain,
                t.customDomain or "",
                t.orgType,
                t.plan,
                t.maxUsers,
                t.currentUsers,
                t.maxStorageMB,
                t.currentStorage,
                "활성" if t.isActive else "비활성",
                t.suspendReason or "",
                expenses_count,
                _format_date(t.createdAt),
                _format_date(t.updatedAt),
            ]
        )

    headers = [
        "ID", "이름", "서브도메인", "커스텀도메인", "조직유형", "요금제",
        "최대사용자", "현재사용자", "최대스토리지(MB)", "현재스토리지(MB)",
        "활성상태", "정지사유", "지출결의서수", "생성일", "수정일",
    ]
    return data, headers, rows


async def _export_users(
    session: AsyncSession, tenant_id: str | None
) -> tuple[list[dict], list[str], list[list[object]]]:
    stmt = select(User, Tenant.name, Tenant.subdomain).join(Tenant, Tenant.id == User.tenantId)
    if tenant_id:
        stmt = stmt.where(User.tenantId == tenant_id)
    stmt = stmt.order_by(User.createdAt.desc())
    result = (await session.execute(stmt)).all()

    data: list[dict] = []
    rows: list[list[object]] = []
    for u, tenant_name, tenant_subdomain in result:
        item = u.model_dump()
        item["tenant"] = {"name": tenant_name, "subdomain": tenant_subdomain}
        data.append(item)

        rows.append(
            [
                u.id,
                tenant_name or "",
                u.userid,
                u.username,
                u.role,
                u.department or "",
                u.phoneNumber or "",
                "활성" if u.isActive else "비활성",
                _format_date(u.createdAt),
                _format_date(u.updatedAt),
            ]
        )

    headers = [
        "ID", "테넌트", "사용자ID", "이름", "역할", "부서",
        "전화번호", "활성상태", "생성일", "수정일",
    ]
    return data, headers, rows


async def _export_expenses(
    session: AsyncSession, tenant_id: str | None
) -> tuple[list[dict], list[str], list[list[object]]]:
    stmt = (
        select(Expense, Tenant.name, User.username)
        .outerjoin(Tenant, Tenant.id == Expense.tenantId)
        .outerjoin(User, User.id == Expense.userId)
    )
    if tenant_id:
        stmt = stmt.where(Expense.tenantId == tenant_id)
    stmt = stmt.order_by(Expense.createdAt.desc()).limit(10000)
    result = (await session.execute(stmt)).all()

    data: list[dict] = []
    rows: list[list[object]] = []
    for e, tenant_name, username in result:
        item = e.model_dump()
        item["tenant"] = {"name": tenant_name} if tenant_name is not None else None
        item["user"] = {"username": username} if username is not None else None
        data.append(item)

        rows.append(
            [
                e.id,
                tenant_name or "",
                username or "",
                e.committee,
                e.department,
                _format_amount(e.requestAmount),
                e.status,
                _format_date(e.expenseDate),
                _format_date(e.createdAt),
                _format_date(e.approvedAt),
            ]
        )

    headers = [
        "ID", "테넌트", "작성자", "위원회", "부서", "청구금액",
        "상태", "지출일", "생성일", "승인일",
    ]
    return data, headers, rows


async def _export_activity_logs(
    session: AsyncSession,
) -> tuple[list[dict], list[str], list[list[object]]]:
    logs = (
        (
            await session.execute(
                select(PlatformActivityLog)
                .order_by(PlatformActivityLog.createdAt.desc())
                .limit(10000)
            )
        )
        .scalars()
        .all()
    )

    data = [log.model_dump() for log in logs]
    rows = [
        [
            log.id,
            log.superAdminEmail,
            log.tenantName or "",
            log.action,
            log.entityType,
            log.entityId or "",
            log.ipAddress or "",
            _iso_z(log.createdAt),
        ]
        for log in logs
    ]

    headers = [
        "ID", "관리자이메일", "테넌트", "액션", "엔티티유형",
        "엔티티ID", "IP주소", "생성일시",
    ]
    return data, headers, rows


async def _export_admins(
    session: AsyncSession,
) -> tuple[list[dict], list[str], list[list[object]]]:
    admins = (
        (await session.execute(select(SuperAdmin).order_by(SuperAdmin.createdAt.desc())))
        .scalars()
        .all()
    )

    data = [
        {
            "id": a.id,
            "email": a.email,
            "name": a.name,
            "isActive": a.isActive,
            "createdAt": a.createdAt,
            "updatedAt": a.updatedAt,
        }
        for a in admins
    ]
    rows = [
        [
            a.id,
            a.email,
            a.name,
            "활성" if a.isActive else "비활성",
            _format_date(a.createdAt),
            _format_date(a.updatedAt),
        ]
        for a in admins
    ]

    headers = ["ID", "이메일", "이름", "활성상태", "생성일", "수정일"]
    return data, headers, rows


@router.get("/export")
async def export_platform_data(
    request: Request,
    type: str = "tenants",
    format: str = "csv",
    tenantId: str | None = None,
    admin: CurrentPlatformAdmin = Depends(get_current_platform_admin),
    session: AsyncSession = Depends(get_session),
):
    if type == "tenants":
        data, headers, rows = await _export_tenants(session)
        filename = f"tenants_{_format_date(datetime.now(timezone.utc))}"
    elif type == "users":
        data, headers, rows = await _export_users(session, tenantId)
        filename = (
            f"users_{tenantId}_{_format_date(datetime.now(timezone.utc))}"
            if tenantId
            else f"users_all_{_format_date(datetime.now(timezone.utc))}"
        )
    elif type == "expenses":
        data, headers, rows = await _export_expenses(session, tenantId)
        filename = (
            f"expenses_{tenantId}_{_format_date(datetime.now(timezone.utc))}"
            if tenantId
            else f"expenses_all_{_format_date(datetime.now(timezone.utc))}"
        )
    elif type == "activity-logs":
        data, headers, rows = await _export_activity_logs(session)
        filename = f"activity_logs_{_format_date(datetime.now(timezone.utc))}"
    elif type == "admins":
        data, headers, rows = await _export_admins(session)
        filename = f"admins_{_format_date(datetime.now(timezone.utc))}"
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "지원하지 않는 내보내기 유형입니다.")

    await log_platform_activity(
        session,
        request,
        super_admin_id=admin.id,
        super_admin_email=admin.email,
        action="EXPORT_DATA",
        entity_type="export",
        tenant_id=tenantId or None,
        details={"exportType": type, "format": format, "rowCount": len(rows)},
    )
    await session.commit()

    if format == "json":
        return {
            "type": type,
            "exportedAt": _iso_z(datetime.now(timezone.utc)),
            "count": len(rows),
            "data": data,
        }

    csv_body = _to_csv(headers, rows)
    bom = "﻿"
    return Response(
        content=(bom + csv_body).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )
