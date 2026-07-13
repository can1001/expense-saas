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


class MeResponse(BaseModel):
    id: str
    userid: str
    username: str
    role: str
    roles: list[str]
    tenantId: str | None = None
    department: str | None = None
    permissions: list[str]  # effective permission 코드 목록
