"""플랫폼 테넌트 CRUD 요청 스키마 (lib/validators/tenant.ts 이전).

Next 원본은 zod 로 구조 검증을 하지만, 기존 컷오버 관례(admin_routes.py RoleCreateBody 등)를
따라 필드는 전부 optional 인 loose BaseModel 로 받고 라우트에서 수동 검증해
Next 와 동일한 400 상태코드·한국어 메시지를 낸다 (FastAPI 자동 422 를 피한다).
"""

import re

from pydantic import BaseModel

ORG_TYPES = ("CHURCH", "NONPROFIT", "SCHOOL", "COMPANY", "OTHER")
PLAN_TYPES = ("FREE", "BASIC", "PRO", "ENTERPRISE")

_SUBDOMAIN_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
_CUSTOM_DOMAIN_RE = re.compile(r"^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z]{2,})+$")
_RESERVED_SUBDOMAINS = {
    "www", "app", "api", "admin", "static", "mail", "ftp", "dev", "staging", "test",
}

PLAN_LIMITS: dict[str, dict[str, int]] = {
    "FREE": {"maxUsers": 10, "maxStorageMB": 1024},
    "BASIC": {"maxUsers": 50, "maxStorageMB": 10240},
    "PRO": {"maxUsers": 200, "maxStorageMB": 51200},
    "ENTERPRISE": {"maxUsers": 999999, "maxStorageMB": 999999999},
}


class TenantCreateBody(BaseModel):
    name: str | None = None
    subdomain: str | None = None
    customDomain: str | None = None
    orgType: str | None = None
    description: str | None = None
    logoUrl: str | None = None
    plan: str | None = None
    adminEmail: str | None = None
    adminName: str | None = None
    adminPassword: str | None = None


class TenantUpdateBody(BaseModel):
    name: str | None = None
    customDomain: str | None = None
    orgType: str | None = None
    description: str | None = None
    logoUrl: str | None = None
    plan: str | None = None
    maxUsers: int | None = None
    maxStorageMB: int | None = None
    isActive: bool | None = None
    suspendReason: str | None = None
    settings: dict | None = None


def validate_subdomain(subdomain: str | None) -> str:
    if not subdomain or len(subdomain) < 3:
        raise ValueError("서브도메인은 최소 3자 이상이어야 합니다")
    if len(subdomain) > 63:
        raise ValueError("서브도메인은 최대 63자까지 가능합니다")
    if not _SUBDOMAIN_RE.match(subdomain):
        raise ValueError("서브도메인은 영문 소문자, 숫자, 하이픈만 사용 가능합니다")
    if subdomain in _RESERVED_SUBDOMAINS:
        raise ValueError("예약된 서브도메인은 사용할 수 없습니다")
    return subdomain


def validate_custom_domain(custom_domain: str | None) -> str | None:
    if not custom_domain:
        return None
    if len(custom_domain) > 255 or not _CUSTOM_DOMAIN_RE.match(custom_domain):
        raise ValueError("올바른 도메인 형식이 아닙니다")
    return custom_domain


def validate_create_tenant(body: TenantCreateBody) -> dict:
    """createTenantSchema.parse() 등가 — 위반 시 ValueError(한국어 메시지)."""
    name = (body.name or "").strip()
    if len(name) < 2:
        raise ValueError("조직명은 최소 2자 이상이어야 합니다")
    if len(name) > 100:
        raise ValueError("조직명은 최대 100자까지 가능합니다")

    subdomain = validate_subdomain(body.subdomain)
    custom_domain = validate_custom_domain(body.customDomain)

    org_type = body.orgType or "CHURCH"
    if org_type not in ORG_TYPES:
        raise ValueError("올바르지 않은 조직 유형입니다")

    plan = body.plan or "FREE"
    if plan not in PLAN_TYPES:
        raise ValueError("올바르지 않은 요금제입니다")

    description = body.description
    if description is not None and len(description) > 500:
        raise ValueError("설명은 최대 500자까지 가능합니다")

    return {
        "name": name,
        "subdomain": subdomain,
        "customDomain": custom_domain,
        "orgType": org_type,
        "description": description,
        "logoUrl": body.logoUrl,
        "plan": plan,
        "adminEmail": body.adminEmail,
        "adminName": body.adminName,
        "adminPassword": body.adminPassword,
    }


def validate_update_tenant(body: TenantUpdateBody) -> dict:
    """updateTenantSchema.parse() 등가 — 지정된 필드만 검증, 나머지는 그대로 통과."""
    data: dict = {}

    if body.name is not None:
        name = body.name.strip()
        if len(name) < 2 or len(name) > 100:
            raise ValueError("조직명은 2자 이상 100자 이하이어야 합니다")
        data["name"] = name

    if body.customDomain is not None:
        data["customDomain"] = validate_custom_domain(body.customDomain)

    if body.orgType is not None:
        if body.orgType not in ORG_TYPES:
            raise ValueError("올바르지 않은 조직 유형입니다")
        data["orgType"] = body.orgType

    if body.description is not None:
        if len(body.description) > 500:
            raise ValueError("설명은 최대 500자까지 가능합니다")
        data["description"] = body.description

    if body.logoUrl is not None:
        data["logoUrl"] = body.logoUrl

    if body.plan is not None:
        if body.plan not in PLAN_TYPES:
            raise ValueError("올바르지 않은 요금제입니다")
        data["plan"] = body.plan

    if body.maxUsers is not None:
        if body.maxUsers < 1:
            raise ValueError("최대 사용자 수는 1 이상이어야 합니다")
        data["maxUsers"] = body.maxUsers

    if body.maxStorageMB is not None:
        if body.maxStorageMB < 100:
            raise ValueError("최대 저장 용량은 100MB 이상이어야 합니다")
        data["maxStorageMB"] = body.maxStorageMB

    if body.isActive is not None:
        data["isActive"] = body.isActive

    if body.suspendReason is not None:
        if len(body.suspendReason) > 500:
            raise ValueError("정지 사유는 최대 500자까지 가능합니다")
        data["suspendReason"] = body.suspendReason

    if body.settings is not None:
        data["settings"] = body.settings

    return data
