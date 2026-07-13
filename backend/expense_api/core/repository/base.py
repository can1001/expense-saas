"""리포지토리 베이스.

멀티테넌시 격리 전략 (spec §8.2):
Prisma $extends 가 하던 "테넌트 스코프 모델에 tenantId 필터 자동 주입"을
TenantScopedRepository 로 대체한다. tenant_id 를 생성자 필수 인자로 두어
tenantId 필터 누락을 구조적으로 방지한다 — 스코프 리포지토리에서는
tenantId 없는 전역 쿼리를 애초에 만들 수 없다.
"""

from typing import Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

T = TypeVar("T", bound=SQLModel)


class BaseRepository(Generic[T]):
    """테넌트 스코프가 아닌(전역) 모델용 기본 리포지토리. (예: Tenant, SuperAdmin)"""

    model: type[T]

    def __init__(self, session: AsyncSession, model: type[T]):
        self.session = session
        self.model = model

    async def get(self, id_: str) -> T | None:
        return await self.session.get(self.model, id_)

    async def add(self, entity: T) -> T:
        self.session.add(entity)
        await self.session.flush()
        return entity


class TenantScopedRepository(Generic[T]):
    """테넌트 스코프 모델용 리포지토리 — 모든 쿼리에 tenantId 필터를 강제한다.

    tenant_id 는 생성자 필수 인자. 조회/생성 시 자동으로 tenantId 를 적용한다.
    """

    model: type[T]

    def __init__(self, session: AsyncSession, model: type[T], tenant_id: str):
        if not tenant_id:
            raise ValueError("TenantScopedRepository 는 tenant_id 가 반드시 필요합니다.")
        self.session = session
        self.model = model
        self.tenant_id = tenant_id

    def _scoped(self):
        """tenantId 필터가 적용된 select 문."""
        return select(self.model).where(self.model.tenantId == self.tenant_id)

    async def get(self, id_: str) -> T | None:
        """id 로 조회 (단, 다른 테넌트 소유면 None — 격리 보장)."""
        stmt = self._scoped().where(self.model.id == id_)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list(self, limit: int = 100, offset: int = 0) -> list[T]:
        stmt = self._scoped().limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self) -> int:
        stmt = select(func.count()).select_from(self.model).where(
            self.model.tenantId == self.tenant_id
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def add(self, entity: T) -> T:
        """생성 시 tenantId 를 강제 주입한다."""
        entity.tenantId = self.tenant_id
        self.session.add(entity)
        await self.session.flush()
        return entity
