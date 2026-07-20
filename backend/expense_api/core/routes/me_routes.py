"""내 설정 라우터 — 서버 주도 설정(labels/features/branding) + 소속 조직 목록.
(app/api/me/config/route.ts, app/api/me/memberships/route.ts 이전)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import Membership

router = APIRouter()

# branding 기본색 — 플랫폼 테넌트 설정(theme.primaryColor)의 기본값과 동일
# (app/api/platform/tenants/[id]/settings/route.ts DEFAULT_SETTINGS)
DEFAULT_PRIMARY_COLOR = "#4f46e5"

# orgType 별 department 레이블 (lib/org-terms.ts TERMS_BY_ORG_TYPE.department 이전)
_DEPARTMENT_LABEL_BY_ORG_TYPE = {
    "CHURCH": "사역팀",
    "COMPANY": "팀",
    "NONPROFIT": "부서",
    "SCHOOL": "부서",
    "OTHER": "부서",
}


def _default_settings_for_org_type(org_type: str) -> dict:
    """orgType 별 기본 settings. (lib/tenant/settings.ts defaultSettingsForOrgType 이전)"""
    is_church = org_type == "CHURCH"
    is_company = org_type == "COMPANY"

    return {
        "labels": {
            "department": _DEPARTMENT_LABEL_BY_ORG_TYPE.get(org_type, "부서"),
            "position": "직분" if is_church else "직급",
            "budget": "예산(회계연도)",
        },
        "features": {
            "incomeModule": is_church,
            "budgetModule": True,
            "vat": is_company,
            "taxInvoice": is_company,
            "offeringLink": is_church,
        },
    }


def _resolve_tenant_settings(org_type: str, settings: dict | None) -> dict:
    """저장된 settings.labels/features 로 기본값을 부분 override. (resolveTenantSettings 이전)"""
    defaults = _default_settings_for_org_type(org_type)
    stored = settings if isinstance(settings, dict) else {}
    stored_labels = stored.get("labels") if isinstance(stored.get("labels"), dict) else {}
    stored_features = stored.get("features") if isinstance(stored.get("features"), dict) else {}

    return {
        "labels": {**defaults["labels"], **stored_labels},
        "features": {**defaults["features"], **stored_features},
    }


@router.get("/config")
async def get_my_config(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant = await session.get(Tenant, user.tenantId) if user.tenantId else None
    if tenant is None:
        raise HTTPException(404, "조직 정보를 찾을 수 없습니다.")

    resolved = _resolve_tenant_settings(tenant.orgType, tenant.settings)

    theme = (tenant.settings or {}).get("theme") if isinstance(tenant.settings, dict) else None
    primary_color = (
        theme.get("primaryColor")
        if isinstance(theme, dict) and isinstance(theme.get("primaryColor"), str)
        else DEFAULT_PRIMARY_COLOR
    )

    return {
        "tenant": {"id": tenant.id, "name": tenant.name, "orgType": tenant.orgType},
        "labels": resolved["labels"],
        "features": resolved["features"],
        "branding": {"logoUrl": tenant.logoUrl, "primaryColor": primary_color},
    }


@router.get("/memberships")
async def list_my_memberships(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = (
        select(Membership, Tenant)
        .join(Tenant, Membership.tenantId == Tenant.id)
        .where(Membership.userId == user.id, Tenant.isActive == True)  # noqa: E712
        .order_by(Membership.isDefault.desc(), Membership.createdAt.asc())
    )
    rows = (await session.execute(stmt)).all()

    return {
        "memberships": [
            {
                "tenantId": membership.tenantId,
                "tenantName": tenant.name,
                "orgType": tenant.orgType,
                "role": membership.role,
                "isCurrent": membership.tenantId == user.tenantId,
            }
            for membership, tenant in rows
        ]
    }
