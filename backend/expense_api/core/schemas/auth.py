"""인증 요청/응답 스키마."""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    userid: str
    password: str


class UserPermissionFlags(BaseModel):
    canApprove: bool
    canManageExpense: bool
    canAccessAdmin: bool
    canExportData: bool
    canRegisterUsers: bool


class LoginUser(BaseModel):
    id: str
    userid: str
    username: str
    role: str
    department: str | None = None
    permissions: UserPermissionFlags


class LoginTenant(BaseModel):
    id: str
    name: str
    subdomain: str


class LoginResponse(BaseModel):
    success: bool = True
    message: str = "로그인 성공"
    user: LoginUser
    tenant: LoginTenant | None = None
    token: str


class MeUser(BaseModel):
    id: str
    userid: str
    username: str
    role: str
    roles: list[str]
    department: str | None = None
    departmentId: str | None = None
    permissions: UserPermissionFlags
    permissionCodes: list[str]  # effective permission 코드 목록
    canRegisterUsers: bool


class MeTenant(BaseModel):
    id: str
    name: str
    subdomain: str


class MeResponse(BaseModel):
    user: MeUser
    tenant: MeTenant | None = None


# ── 회원가입 (A5) ──────────────────────────────────────────
class SignupRequest(BaseModel):
    userid: str | None = None
    username: str | None = None
    password: str | None = None
    department: str | None = None


class SignupUser(BaseModel):
    id: str
    userid: str
    username: str
    role: str
    department: str | None = None


# ── 비밀번호 변경 (A5) ─────────────────────────────────────
class ChangePasswordRequest(BaseModel):
    currentPassword: str | None = None
    newPassword: str | None = None


# ── 조직 전환 (A5, ARC-002 §3.2 B3) ───────────────────────
class SwitchTenantRequest(BaseModel):
    tenantId: str | None = None


# ── 초대 수락 (A5, ARC-003 §4.2 C3) ───────────────────────
class AcceptInvitationRequest(BaseModel):
    inviteToken: str | None = None
    kakaoAccessToken: str | None = None
    userid: str | None = None
    password: str | None = None
    username: str | None = None


# ── 카카오 로그인/연결 (A6) ────────────────────────────────
class KakaoLoginRequest(BaseModel):
    kakaoAccessToken: str | None = None
    # OIDC(id_token) 분기용 예약 필드 — KAKAO_USE_OIDC 활성화 시 사용
    idToken: str | None = None


class LinkKakaoRequest(BaseModel):
    kakaoAccessToken: str | None = None
