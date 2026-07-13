"""테넌트/슈퍼관리자 리포지토리 (전역 스코프)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.tenant import SuperAdmin, Tenant
from expense_api.core.repository.base import BaseRepository


class TenantRepository(BaseRepository[Tenant]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, Tenant)

    async def get_by_subdomain(self, subdomain: str, *, active_only: bool = True) -> Tenant | None:
        """subdomain 으로 테넌트 조회. active_only 면 비활성 테넌트는 None."""
        stmt = select(Tenant).where(Tenant.subdomain == subdomain)
        if active_only:
            stmt = stmt.where(Tenant.isActive == True)  # noqa: E712
        result = await self.session.execute(stmt)
        return result.scalars().first()


class SuperAdminRepository(BaseRepository[SuperAdmin]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, SuperAdmin)

    async def get_by_email(self, email: str) -> SuperAdmin | None:
        stmt = select(SuperAdmin).where(SuperAdmin.email == email)
        result = await self.session.execute(stmt)
        return result.scalars().first()
