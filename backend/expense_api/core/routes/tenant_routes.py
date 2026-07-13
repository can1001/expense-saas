"""테넌트 정보 라우터 — 프론트 TenantContext 용. (app/api/tenant/info 이전)"""

from fastapi import APIRouter, Depends

from expense_api.core.dependencies.tenant import effective_modules, get_tenant
from expense_api.core.models.tenant import Tenant

router = APIRouter()


@router.get("/info")
async def tenant_info(tenant: Tenant | None = Depends(get_tenant)) -> dict:
    if tenant is None:
        return {"tenant": None, "orgType": "CHURCH", "enabledModules": []}
    return {
        "tenant": {"id": tenant.id, "name": tenant.name, "subdomain": tenant.subdomain},
        "orgType": tenant.orgType,
        "enabledModules": effective_modules(tenant),
    }
