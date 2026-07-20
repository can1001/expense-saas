"""인증 라우터 — 실제 로그인/me/logout. (app/api/auth/* 이전)"""

from sqlalchemy import select
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import derive_legacy_flags
from expense_api.core.config.settings import settings
from expense_api.core.dependencies.auth import COOKIE_NAME, CurrentUser, get_current_user
from expense_api.core.dependencies.authz import effective_permissions
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import Membership, User
from expense_api.core.repository.tenant_repository import TenantRepository
from expense_api.core.schemas.auth import (
    AcceptInvitationRequest,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    LoginTenant,
    LoginUser,
    MeResponse,
    MeTenant,
    MeUser,
    SignupRequest,
    SignupUser,
    SwitchTenantRequest,
    UserPermissionFlags,
)
from expense_api.core.security.jwt import JWTError, decode_token, hash_password, verify_password
from expense_api.core.security.rate_limit import (
    check_login_rate_limit,
    clear_login_attempts,
    get_rate_limit_key,
    record_login_failure,
)
from expense_api.core.service.auth_service import (
    InvitationError,
    LoginError,
    accept_invitation,
    build_tenant_session,
    issue_session_token,
    login,
    membership_role_to_role_code,
)

router = APIRouter()


def _extract_token(request: Request) -> str | None:
    """Authorization 헤더 → user_token 쿠키 순 (Next switch-tenant extractToken 이전)."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.cookies.get(COOKIE_NAME)


def _session_user_payload(session: dict) -> dict:
    return {
        "id": session["id"],
        "userid": session["userid"],
        "username": session["username"],
        "role": session["role"],
        "department": session["department"],
        "permissions": {
            "canApprove": session["canApprove"],
            "canManageExpense": session["canManageExpense"],
            "canAccessAdmin": session["canAccessAdmin"],
            "canExportData": session["canExportData"],
            "canRegisterUsers": session["canRegisterUsers"],
        },
    }


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.is_prod,
        max_age=24 * 60 * 60,
    )


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=LoginResponse)
async def login_route(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    x_tenant_subdomain: str | None = Header(default=None),
    x_tenant_param: str | None = Header(default=None),
) -> LoginResponse:
    subdomain = x_tenant_subdomain or x_tenant_param

    # 브루트포스 방지 (리뷰 #1)
    rl_key = get_rate_limit_key(_client_ip(request), body.userid)
    allowed, retry_after = check_login_rate_limit(rl_key)
    if not allowed:
        raise HTTPException(
            429,
            "로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        result = await login(session, body.userid, body.password, subdomain)
    except LoginError as e:
        # 인증 실패(401/403)만 실패로 집계 — 테넌트 미존재(404)는 제외
        if e.status_code in (401, 403):
            record_login_failure(rl_key)
        raise HTTPException(e.status_code, e.message)

    clear_login_attempts(rl_key)  # 성공 시 초기화
    user = result.user
    # HttpOnly 쿠키로도 토큰 발급 (프론트 호환). prod 에서만 Secure (리뷰 #3)
    response.set_cookie(
        COOKIE_NAME,
        result.token,
        httponly=True,
        samesite="lax",
        secure=settings.is_prod,
        max_age=24 * 60 * 60,
    )
    return LoginResponse(
        user=LoginUser(
            id=user.id,
            userid=user.userid,
            username=user.username,
            role=user.role,
            department=user.department,
            permissions=UserPermissionFlags(**result.flags),
        ),
        tenant=(
            LoginTenant(
                id=result.tenant.id, name=result.tenant.name, subdomain=result.tenant.subdomain
            )
            if result.tenant
            else None
        ),
        token=result.token,
    )


@router.get("/me", response_model=MeResponse)
async def me_route(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    perms = await effective_permissions(user, session)
    flags = derive_legacy_flags(user.roles, user.granted)

    tenant = None
    if user.tenantId:
        tenant_row = await TenantRepository(session).get(user.tenantId)
        if tenant_row:
            tenant = MeTenant(
                id=tenant_row.id, name=tenant_row.name, subdomain=tenant_row.subdomain
            )

    return MeResponse(
        user=MeUser(
            id=user.id,
            userid=user.userid,
            username=user.username,
            role=user.role,
            roles=user.roles,
            department=user.department,
            departmentId=None,
            permissions=UserPermissionFlags(**flags),
            permissionCodes=sorted(perms),
            canRegisterUsers=flags["canRegisterUsers"],
        ),
        tenant=tenant,
    )


@router.post("/logout")
async def logout_route(response: Response) -> dict:
    response.delete_cookie(COOKIE_NAME)
    return {"success": True, "message": "로그아웃 되었습니다."}


# ── 회원가입 (A5, app/api/auth/signup/route.ts 이전) ────────────────────
@router.post("/signup", response_model=SignupUser, status_code=201)
async def signup_route(
    body: SignupRequest,
    session: AsyncSession = Depends(get_session),
) -> SignupUser:
    userid = (body.userid or "").strip()
    username = (body.username or "").strip()
    password = body.password or ""
    department = (body.department or "").strip() or None

    if not userid:
        raise HTTPException(400, "아이디를 입력해주세요.")
    if not username:
        raise HTTPException(400, "이름을 입력해주세요.")
    if not password:
        raise HTTPException(400, "비밀번호를 입력해주세요.")
    if len(password) < 4:
        raise HTTPException(400, "비밀번호는 4자 이상이어야 합니다.")

    # 공개 회원가입은 테넌트 컨텍스트가 없다(Next 원본과 동일) — 전 테넌트 대상 중복 확인.
    existing_userid = (
        await session.execute(select(User).where(User.userid == userid))
    ).scalars().first()
    if existing_userid:
        raise HTTPException(409, "이미 존재하는 아이디입니다.")

    existing_username = (
        await session.execute(
            select(User).where(User.username == username, User.isActive == True)  # noqa: E712
        )
    ).scalars().first()
    if existing_username:
        raise HTTPException(409, "이미 존재하는 이름입니다.")

    user = User(
        userid=userid,
        username=username,
        role="user",
        department=department,
        password=hash_password(password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return SignupUser(
        id=user.id, userid=user.userid, username=user.username, role=user.role,
        department=user.department,
    )


# ── 비밀번호 변경 (A5, app/api/auth/change-password/route.ts 이전) ──────
@router.post("/change-password")
async def change_password_route(
    body: ChangePasswordRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    current_password = body.currentPassword
    new_password = body.newPassword

    if not current_password or not isinstance(current_password, str):
        raise HTTPException(400, "현재 비밀번호를 입력해주세요.")
    if not new_password or not isinstance(new_password, str):
        raise HTTPException(400, "새 비밀번호를 입력해주세요.")
    if len(new_password) < 4:
        raise HTTPException(400, "새 비밀번호는 4자 이상이어야 합니다.")

    db_user = await session.get(User, user.id)
    if db_user is None:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    if not db_user.password:
        raise HTTPException(400, "비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.")
    if not verify_password(current_password, db_user.password):
        raise HTTPException(401, "현재 비밀번호가 올바르지 않습니다.")

    db_user.password = hash_password(new_password)
    db_user.mustChangePassword = False
    session.add(db_user)
    await session.commit()

    return {"success": True, "message": "비밀번호가 변경되었습니다."}


# ── 조직 전환 (A5, app/api/auth/switch-tenant/route.ts 이전, ARC-002 §3.2 B3) ──
# tenantId 를 바디로 받는 유일한 예외 경로 — Membership 검증 후에만 새 토큰을 발급한다.
@router.post("/switch-tenant")
async def switch_tenant_route(
    body: SwitchTenantRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant_id = (body.tenantId or "").strip()
    if not tenant_id:
        raise HTTPException(400, "전환할 조직을 지정해주세요.")

    # 1. 현재 토큰 검증 — 정식 토큰 또는 로그인(B2)의 조직 선택용 임시 토큰. 둘 다
    #    동일 시크릿으로 서명되므로 sub 클레임만 신뢰하고(공통 원칙 2), refresh 토큰만 거부한다.
    token = _extract_token(request)
    if not token:
        raise HTTPException(401, "로그인이 필요합니다.")
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(401, "로그인이 필요합니다.")
    if payload.get("type") == "refresh":
        raise HTTPException(401, "로그인이 필요합니다.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "로그인이 필요합니다.")

    # 2. Membership 검증 — 미소속이면 403 (토큰·쿠키 무변경)
    membership = (
        await session.execute(
            select(Membership).where(
                Membership.userId == user_id, Membership.tenantId == tenant_id
            )
        )
    ).scalars().first()
    if membership is None:
        raise HTTPException(403, "해당 조직에 소속되어 있지 않습니다.")

    # 3. 사용자·대상 테넌트 활성 상태 확인
    user = await session.get(User, user_id)
    tenant = await session.get(Tenant, tenant_id)

    if user is None or not user.isActive:
        raise HTTPException(403, "계정이 비활성화되어 있습니다. 관리자에게 문의하세요.")
    if tenant is None or not tenant.isActive:
        raise HTTPException(403, "이 조직은 현재 이용할 수 없습니다.")

    # 4. 새 tenantId 클레임으로 정식 토큰 재발급 — 홈/게스트 역할 파생은 로그인과 동일 헬퍼로.
    session_data = build_tenant_session(user, tenant.id, membership.role)
    token_out = issue_session_token(session_data)
    _set_session_cookie(response, token_out)

    # 5. FCM 토큰/토픽 테넌트 재스코프 — push(N2) 포팅 전이므로 여기서는 생략(전환 자체는 막지 않는다).

    body_out: dict = {
        "success": True,
        "message": "조직이 전환되었습니다.",
        "user": _session_user_payload(session_data),
        "tenant": {
            "id": tenant.id, "name": tenant.name, "subdomain": tenant.subdomain,
            "orgType": tenant.orgType,
        },
        "token": token_out,
    }
    if user.mustChangePassword:
        body_out["mustChangePassword"] = True
    return body_out


# ── 초대 수락 (A5, app/api/auth/accept-invitation/route.ts 이전, ARC-003 §4.2 C3) ──
@router.post("/accept-invitation", status_code=201)
async def accept_invitation_route(
    body: AcceptInvitationRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    invite_token = (body.inviteToken or "").strip()
    if not invite_token:
        raise HTTPException(400, "초대 토큰을 입력해주세요.")

    if body.kakaoAccessToken:
        # 카카오 경로(kapi 검증·계정 매칭)는 A6(카카오 포팅)에서 구현한다.
        raise HTTPException(503, "카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.")

    userid = (body.userid or "").strip()
    username = (body.username or "").strip()
    password = body.password or ""
    if not userid:
        raise HTTPException(400, "아이디를 입력해주세요.")
    if not username:
        raise HTTPException(400, "이름을 입력해주세요.")
    if not password:
        raise HTTPException(400, "비밀번호를 입력해주세요.")
    if len(password) < 4:
        raise HTTPException(400, "비밀번호는 4자 이상이어야 합니다.")

    try:
        user, membership, tenant = await accept_invitation(
            session, token=invite_token, userid=userid, username=username, password=password
        )
    except InvitationError as e:
        raise HTTPException(e.status_code, e.message)

    # 역할은 방금 생성된 Membership.role 에서만 파생 — 홈 User.role 유출/권한 상승 방지.
    effective_role = membership_role_to_role_code(membership.role)
    roles = [effective_role]
    granted: list[str] = []
    flags = derive_legacy_flags(roles, granted)
    session_data = {
        "id": user.id,
        "tenantId": membership.tenantId,
        "userid": user.userid,
        "username": user.username,
        "role": effective_role,
        "roles": roles,
        "roleId": None,
        "department": None,
        "granted": granted,
        **flags,
    }
    token_out = issue_session_token(session_data)
    _set_session_cookie(response, token_out)

    return {
        "success": True,
        "message": "초대를 수락했습니다.",
        "user": _session_user_payload(session_data),
        "tenant": {"id": tenant.id, "name": tenant.name, "subdomain": tenant.subdomain},
        "token": token_out,
    }
