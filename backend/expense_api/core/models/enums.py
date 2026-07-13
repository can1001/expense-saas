"""도메인 enum — Prisma 네이티브 enum 을 문자열 저장 + Python Enum 으로 이전. (spec §4.3)

값(value)은 기존 Prisma enum 과 100% 동일하게 유지한다.
"""

from enum import Enum


class OrgType(str, Enum):
    CHURCH = "CHURCH"
    NONPROFIT = "NONPROFIT"
    SCHOOL = "SCHOOL"
    COMPANY = "COMPANY"
    OTHER = "OTHER"


class PlanType(str, Enum):
    FREE = "FREE"
    BASIC = "BASIC"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


# ─────────────────────────────────────────────────────────────
# 기능 모듈(capability) 프리셋 — spec §15.3
# Tenant.enabledModules 가 비어 있으면 orgType 프리셋으로 폴백한다.
# (RBAC 의 "Role.permissions 비면 프리셋 폴백" 과 동일한 설계)
# ─────────────────────────────────────────────────────────────

# 공유 코어 모듈 (모든 테넌트)
CORE_MODULES: list[str] = ["expense", "budget", "approval", "user_admin"]

# 교회 전용 팩
CHURCH_MODULES: list[str] = ["offering", "youth_night", "account_report"]

# 회사 전용 팩 (Phase 5+ 에서 실제 라우터 연결)
COMPANY_MODULES: list[str] = ["tax_invoice", "corporate_card", "cost_center"]

MODULE_PRESETS_BY_ORG_TYPE: dict[OrgType, list[str]] = {
    OrgType.CHURCH: CORE_MODULES + CHURCH_MODULES,
    OrgType.COMPANY: CORE_MODULES + COMPANY_MODULES,
    OrgType.NONPROFIT: CORE_MODULES,
    OrgType.SCHOOL: CORE_MODULES,
    OrgType.OTHER: CORE_MODULES,
}


def default_modules_for(org_type: str) -> list[str]:
    """orgType 에 대응하는 기본 활성 모듈 목록."""
    try:
        return MODULE_PRESETS_BY_ORG_TYPE[OrgType(org_type)]
    except (ValueError, KeyError):
        return list(CORE_MODULES)
