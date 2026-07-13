"""사용자/역할 리포지토리."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.user import Role, User
from expense_api.core.repository.base import TenantScopedRepository


class UserRepository(TenantScopedRepository[User]):
    """인증 후 테넌트 스코프 사용자 조회."""

    def __init__(self, session: AsyncSession, tenant_id: str):
        super().__init__(session, User, tenant_id)

    async def get_by_userid(self, userid: str) -> User | None:
        stmt = self._scoped().where(User.userid == userid)
        result = await self.session.execute(stmt)
        return result.scalars().first()


# ── 로그인 전용 (pre-auth): 테넌트 컨텍스트가 아직 없으므로 스코프 밖 ──────
async def find_login_user(
    session: AsyncSession, userid: str, tenant_id: str | None
) -> User | None:
    """로그인용 사용자 조회 (Prisma findFirst 대응).

    tenant_id 가 주어지면 해당 테넌트로 한정, 없으면(단일테넌트 레거시) userid 만으로 조회.
    """
    stmt = select(User).where(User.userid == userid)
    if tenant_id is not None:
        stmt = stmt.where(User.tenantId == tenant_id)
    result = await session.execute(stmt)
    return result.scalars().first()


async def load_tenant_roles_map(
    session: AsyncSession, tenant_id: str | None
) -> dict[str, list[str]]:
    """테넌트의 역할별 permissions 맵 {code: [perm...]} — DB resolver 구성용.

    (프론트 role-permission-cache.getTenantRoleResolver 이전)

    보안: tenant_id 로 '항상' 스코프한다. tenant_id 가 None 이면 Role.tenantId IS NULL
    (단일테넌트 배포)만 매칭 — 조용히 전 테넌트 역할을 로드하지 않는다. (리뷰 #2)
    """
    stmt = select(Role).where(
        Role.isActive == True,  # noqa: E712
        Role.tenantId == tenant_id,  # None → IS NULL
    )
    result = await session.execute(stmt)
    roles = result.scalars().all()
    return {r.code: list(r.permissions or []) for r in roles}
