"""플랫폼 테넌트 사용자 CRUD 요청 스키마 (app/api/platform/tenants/[id]/users* 이전).

Next 원본은 zod 로 구조 검증을 하지만, 기존 컷오버 관례(schemas/tenant.py)를 따라
필드는 전부 optional 인 loose BaseModel 로 받고 라우트에서 수동 검증해 Next 와
동일한 400 상태코드·한국어 메시지를 낸다 (FastAPI 자동 422 를 피한다).
"""

from pydantic import BaseModel


class TenantUserCreateBody(BaseModel):
    userid: str | None = None
    username: str | None = None
    password: str | None = None
    role: str | None = None
    department: str | None = None
    phoneNumber: str | None = None


class TenantUserUpdateBody(BaseModel):
    username: str | None = None
    password: str | None = None
    role: str | None = None
    department: str | None = None
    phoneNumber: str | None = None
    isActive: bool | None = None


def validate_create_tenant_user(body: TenantUserCreateBody) -> dict:
    """createUserSchema.parse() 등가 — 위반 시 ValueError(한국어 메시지)."""
    userid = body.userid or ""
    if len(userid) < 3:
        raise ValueError("아이디는 최소 3자 이상이어야 합니다")
    if len(userid) > 50:
        raise ValueError("아이디는 최대 50자까지 가능합니다")

    username = body.username or ""
    if len(username) < 2:
        raise ValueError("이름은 최소 2자 이상이어야 합니다")
    if len(username) > 100:
        raise ValueError("이름은 최대 100자까지 가능합니다")

    password = body.password or ""
    if len(password) < 8:
        raise ValueError("비밀번호는 최소 8자 이상이어야 합니다")

    return {
        "userid": userid,
        "username": username,
        "password": password,
        "role": body.role or "user",
        "department": body.department,
        "phoneNumber": body.phoneNumber,
    }


def validate_update_tenant_user(body: TenantUserUpdateBody) -> dict:
    """updateUserSchema.parse() 등가 — 지정된 필드만 검증, 나머지는 그대로 통과."""
    data: dict = {}

    if body.username is not None:
        if len(body.username) < 2:
            raise ValueError("이름은 최소 2자 이상이어야 합니다")
        if len(body.username) > 100:
            raise ValueError("이름은 최대 100자까지 가능합니다")
        data["username"] = body.username

    if body.password is not None:
        if len(body.password) < 8:
            raise ValueError("비밀번호는 최소 8자 이상이어야 합니다")
        data["password"] = body.password

    if body.role is not None:
        data["role"] = body.role

    if body.department is not None:
        data["department"] = body.department

    if body.phoneNumber is not None:
        data["phoneNumber"] = body.phoneNumber

    if body.isActive is not None:
        data["isActive"] = body.isActive

    return data
