"""플랫폼 관리 활동 로그 (lib/platform/activity-log.ts logPlatformActivity 이전)."""

import logging

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.tenant import PlatformActivityLog

_logger = logging.getLogger(__name__)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    return "unknown"


async def log_platform_activity(
    session: AsyncSession,
    request: Request,
    *,
    super_admin_id: str,
    super_admin_email: str,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    tenant_id: str | None = None,
    tenant_name: str | None = None,
    details: dict | None = None,
) -> None:
    """로그 기록 실패는 메인 작업에 영향을 주지 않는다 (Next 원본과 동일하게 예외를 삼킨다)."""
    try:
        session.add(
            PlatformActivityLog(
                superAdminId=super_admin_id,
                superAdminEmail=super_admin_email,
                action=action,
                entityType=entity_type,
                entityId=entity_id,
                tenantId=tenant_id,
                tenantName=tenant_name,
                details=jsonable_encoder(details) if details is not None else None,
                ipAddress=_client_ip(request),
                userAgent=request.headers.get("user-agent"),
            )
        )
        await session.flush()
    except Exception:
        _logger.exception("Failed to log platform activity")
