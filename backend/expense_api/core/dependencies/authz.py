"""인가(permission) 의존성. (lib/auth/user.ts withPermissions 이전)

세션 역할 → 테넌트별 DB resolver(Role.permissions, 비면 프리셋 폴백) → has_permission 판정.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import has_permission, make_db_resolver
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.repository.user_repository import load_tenant_roles_map


async def effective_permissions(
    user: CurrentUser,
    session: AsyncSession,
) -> set[str]:
    """현재 사용자의 effective permission 집합 (DB resolver + 프리셋 폴백 + granted)."""
    from expense_api.core.auth.permissions import resolve_permissions

    roles_map = await load_tenant_roles_map(session, user.tenantId or None)
    resolver = make_db_resolver(roles_map)
    return resolve_permissions(user.roles, resolver=resolver, granted=user.granted)


def require_permission(permission: str):
    """특정 permission 을 요구하는 의존성 팩토리."""

    async def _dep(
        user: CurrentUser = Depends(get_current_user),
        session: AsyncSession = Depends(get_session),
    ) -> CurrentUser:
        roles_map = await load_tenant_roles_map(session, user.tenantId or None)
        resolver = make_db_resolver(roles_map)
        if not has_permission(user.roles, permission, resolver=resolver, granted=user.granted):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "이 작업을 수행할 권한이 없습니다."
            )
        return user

    return _dep
