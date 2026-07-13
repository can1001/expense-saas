"""인증 서비스 — 로그인 (app/api/auth/login/route.ts 로직 이전).

흐름: subdomain→테넌트 해석 → userid로 사용자 조회 → 활성/테넌트 활성 확인 →
bcrypt 검증 → roles+granted 로 JWT 발급. (권한은 굽지 않고 역할로부터 파생 — roles-only)
"""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS, derive_legacy_flags
from expense_api.core.repository.tenant_repository import TenantRepository
from expense_api.core.repository.user_repository import find_login_user
from expense_api.core.security.jwt import create_access_token, create_refresh_token, verify_password


class LoginError(Exception):
    """로그인 실패 — status_code 와 메시지를 담는다."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


@dataclass
class LoginResult:
    token: str
    refresh_token: str
    user: object  # User
    tenant: object | None  # Tenant | None
    roles: list[str]
    granted: list[str]
    flags: dict[str, bool]


async def login(
    session: AsyncSession,
    userid: str,
    password: str,
    subdomain: str | None,
) -> LoginResult:
    tenant = None
    if subdomain:
        tenant = await TenantRepository(session).get_by_subdomain(subdomain, active_only=True)
        if tenant is None:
            raise LoginError(404, "존재하지 않거나 비활성화된 조직입니다.")

    tenant_id = tenant.id if tenant else None
    user = await find_login_user(session, userid, tenant_id)

    # 사용자 없음 / 비활성 / 비밀번호 미설정·불일치는 모두 동일한 401 메시지로 (계정 존재 노출 방지)
    if user is None:
        raise LoginError(401, "아이디 또는 비밀번호가 올바르지 않습니다.")
    if not user.isActive:
        raise LoginError(403, "계정이 비활성화되어 있습니다. 관리자에게 문의하세요.")
    if not user.password:
        raise LoginError(401, "비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.")
    if not verify_password(password, user.password):
        raise LoginError(401, "아이디 또는 비밀번호가 올바르지 않습니다.")

    # roles-only: 유효 역할 코드로부터 권한 파생
    roles = [user.role]
    granted = [PERMISSIONS.USER_REGISTER] if user.canRegisterUsers else []
    flags = derive_legacy_flags(roles, granted)

    claims = {
        "tenantId": user.tenantId or "",
        "userid": user.userid,
        "username": user.username,
        "role": user.role,
        "roles": roles,
        "granted": granted,
        "roleId": user.roleId,
        "department": user.department,
    }
    token = create_access_token(user.id, extra=claims)
    refresh = create_refresh_token(user.id)

    return LoginResult(
        token=token,
        refresh_token=refresh,
        user=user,
        tenant=tenant,
        roles=roles,
        granted=granted,
        flags=flags,
    )
