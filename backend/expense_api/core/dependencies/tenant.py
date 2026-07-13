"""테넌트 의존성 + 기능 모듈(capability) 게이팅. (spec §15.3)"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.models.enums import CORE_MODULES, default_modules_for
from expense_api.core.models.tenant import Tenant


async def get_tenant(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Tenant | None:
    """현재 사용자의 테넌트. (단일테넌트 레거시면 None)"""
    if not user.tenantId:
        return None
    return await session.get(Tenant, user.tenantId)


async def require_tenant_id(user: CurrentUser = Depends(get_current_user)) -> str:
    """테넌트 스코프가 반드시 필요한 라우트용 — tenantId 가 없으면 400."""
    if not user.tenantId:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "테넌트 컨텍스트가 필요합니다.")
    return user.tenantId


def effective_modules(tenant: Tenant | None) -> list[str]:
    """활성 모듈 목록. enabledModules 가 비어 있으면 orgType 프리셋으로 폴백.

    (RBAC 의 'Role.permissions 비면 프리셋 폴백' 과 동일한 설계)
    """
    if tenant is None:
        return list(CORE_MODULES)
    if tenant.enabledModules:  # 비어있지 않으면 정본
        return list(tenant.enabledModules)
    return default_modules_for(tenant.orgType)


def require_module(module: str):
    """해당 기능 모듈이 테넌트에 활성화되어 있어야 통과하는 의존성 팩토리.

    사용 예: router = APIRouter(dependencies=[Depends(require_module("offering"))])
    """

    async def _dep(tenant: Tenant | None = Depends(get_tenant)) -> Tenant | None:
        if module not in effective_modules(tenant):
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail=f"이 조직에서 사용하지 않는 기능입니다: {module}",
            )
        return tenant

    return _dep
