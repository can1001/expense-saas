"""인증 서비스 — 로그인 (app/api/auth/login/route.ts 로직 이전).

흐름: subdomain→테넌트 해석 → userid로 사용자 조회 → 활성/테넌트 활성 확인 →
bcrypt 검증 → roles+granted 로 JWT 발급. (권한은 굽지 않고 역할로부터 파생 — roles-only)
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS, derive_legacy_flags
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import AuthAccount, Invitation, Membership, User
from expense_api.core.models.ids import utcnow
from expense_api.core.repository.tenant_repository import TenantRepository
from expense_api.core.repository.user_repository import find_login_user
from expense_api.core.security.jwt import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)


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


# ── 조직 전환 공용 (A5, Next lib/auth/login-session.ts buildTenantSession 이전) ──────


def membership_role_to_role_code(role: str) -> str:
    """Membership.role(TENANT_ADMIN/MEMBER) → 인가용 역할 코드(Role.code)."""
    return "admin" if role == "TENANT_ADMIN" else "user"


async def get_memberships(session: AsyncSession, user_id: str) -> list[tuple[Membership, Tenant]]:
    """유저의 소속 목록 조회 (Next lib/services/membership.ts getMemberships 이전, A6).

    활성 테넌트만, 기본 조직 우선 정렬. 0건이면 호출측이 User.tenantId 로 폴백한다.
    """
    rows = (
        await session.execute(
            select(Membership, Tenant)
            .join(Tenant, Membership.tenantId == Tenant.id)
            .where(Membership.userId == user_id, Tenant.isActive == True)  # noqa: E712
            .order_by(Membership.isDefault.desc(), Membership.createdAt.asc())
        )
    ).all()
    return [(m, t) for m, t in rows]


def build_tenant_session(user: User, session_tenant_id: str, membership_role: str | None) -> dict:
    """세션 테넌트에서의 역할을 결정해 세션 dict 를 만든다.

    홈 테넌트면 User.role/roleId/부서·개별권한을 유지하고, 게스트 소속(홈이 아닌 테넌트)이면
    Membership.role 에서만 역할을 파생해 홈 관리자 권한이 다른 테넌트로 상승하지 않게 한다.
    """
    is_guest = session_tenant_id != (user.tenantId or "")
    role = membership_role_to_role_code(membership_role or "MEMBER") if is_guest else user.role
    role_id = None if is_guest else user.roleId
    department = None if is_guest else user.department
    can_register_users = False if is_guest else user.canRegisterUsers

    roles = [role]
    granted = [PERMISSIONS.USER_REGISTER] if can_register_users else []
    flags = derive_legacy_flags(roles, granted)

    return {
        "id": user.id,
        "tenantId": session_tenant_id,
        "userid": user.userid,
        "username": user.username,
        "role": role,
        "roles": roles,
        "roleId": role_id,
        "department": department,
        "granted": granted,
        **flags,
    }


def issue_session_token(session: dict) -> str:
    """세션 dict 로부터 정식 access 토큰 발급 (login/switch-tenant/accept-invitation 공용)."""
    claims = {
        "tenantId": session["tenantId"],
        "userid": session["userid"],
        "username": session["username"],
        "role": session["role"],
        "roles": session["roles"],
        "granted": session["granted"],
        "roleId": session["roleId"],
        "department": session["department"],
    }
    return create_access_token(session["id"], extra=claims)


# ── 초대 수락 (A5, Next lib/services/invitation.ts acceptInvitation 이전) ───────────
# kakao 연결 경로(existingUserId/kakaoProviderUserId)는 A6(카카오 포팅)에서 확장한다.


class InvitationError(Exception):
    """초대 검증/수락 실패 — status_code 와 메시지를 담는다."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _as_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


async def get_valid_invitation(session: AsyncSession, token: str) -> tuple[Invitation, Tenant]:
    """초대 토큰 검증 — 미존재(404)/기수락(409)/만료(410)/비활성 테넌트(403)면 InvitationError."""
    invitation = (
        await session.execute(select(Invitation).where(Invitation.token == token))
    ).scalars().first()
    if invitation is None:
        raise InvitationError("유효하지 않은 초대입니다.", 404)
    if invitation.acceptedAt is not None:
        raise InvitationError("이미 사용된 초대입니다.", 409)
    if _as_naive_utc(invitation.expiresAt) < _as_naive_utc(utcnow()):
        raise InvitationError("만료된 초대입니다.", 410)

    tenant = await session.get(Tenant, invitation.tenantId)
    if tenant is None or not tenant.isActive:
        raise InvitationError("이 조직은 현재 이용할 수 없습니다.", 403)

    return invitation, tenant


async def accept_invitation(
    session: AsyncSession,
    *,
    token: str,
    userid: str,
    username: str,
    password: str,
) -> tuple[User, Membership, Tenant]:
    """초대 수락 — User·AuthAccount(email)·Membership 생성과 초대 소진.

    session.commit() 전에 실패하면 아무것도 반영되지 않는다(요청 스코프 세션 close 시 rollback).
    """
    invitation, tenant = await get_valid_invitation(session, token)

    # 동시 수락 방지 — acceptedAt 이 아직 null 인 경우에만 선점
    claimed = await session.execute(
        update(Invitation)
        .where(Invitation.id == invitation.id, Invitation.acceptedAt.is_(None))
        .values(acceptedAt=utcnow())
    )
    if claimed.rowcount == 0:
        raise InvitationError("이미 사용된 초대입니다.", 409)

    duplicated = (
        await session.execute(
            select(User).where(User.tenantId == invitation.tenantId, User.userid == userid)
        )
    ).scalars().first()
    if duplicated:
        raise InvitationError("이미 존재하는 아이디입니다.", 409)

    user = User(
        tenantId=invitation.tenantId,
        userid=userid,
        username=username,
        password=hash_password(password),
        role="user",
    )
    session.add(user)
    await session.flush()

    # 아이디/비밀번호 가입은 provider "email" 로 인증 경로 일원화 (provider, providerUserId 전역 유니크)
    email_taken = (
        await session.execute(
            select(AuthAccount).where(
                AuthAccount.provider == "email", AuthAccount.providerUserId == userid
            )
        )
    ).scalars().first()
    if email_taken:
        raise InvitationError("이미 존재하는 아이디입니다.", 409)
    session.add(AuthAccount(userId=user.id, provider="email", providerUserId=userid))

    membership_count = (
        await session.execute(
            select(func.count()).select_from(Membership).where(Membership.userId == user.id)
        )
    ).scalar_one()
    membership = Membership(
        userId=user.id,
        tenantId=invitation.tenantId,
        role=invitation.role,
        isDefault=membership_count == 0,
    )
    session.add(membership)

    await session.commit()
    await session.refresh(user)
    await session.refresh(membership)
    return user, membership, tenant
