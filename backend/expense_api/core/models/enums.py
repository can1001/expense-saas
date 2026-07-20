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


# ── 결재 (Approval) ───────────────────────────────────────────
class ApprovalStatus(str, Enum):
    DRAFT = "DRAFT"  # 작성중 (제출 전)
    PENDING = "PENDING"  # 결재 대기 (1차 결재 대기)
    APPROVED_STEP_1 = "APPROVED_STEP_1"  # 1차 승인 완료
    APPROVED_STEP_2 = "APPROVED_STEP_2"  # 2차 승인 완료
    APPROVED_FINAL = "APPROVED_FINAL"  # 최종 승인
    REJECTED = "REJECTED"  # 반려
    WITHDRAWN = "WITHDRAWN"  # 회수


class PaymentStatus(str, Enum):
    PENDING = "PENDING"  # 지급 대기
    HOLD = "HOLD"  # 지급 보류
    CANCELLED = "CANCELLED"  # 지급 취소
    COMPLETED = "COMPLETED"  # 지급 완료


class StepStatus(str, Enum):
    PENDING = "PENDING"  # 대기중
    APPROVED = "APPROVED"  # 승인
    REJECTED = "REJECTED"  # 반려
    SKIPPED = "SKIPPED"  # 건너뜀


class NotificationChannel(str, Enum):
    SMS = "SMS"
    KAKAO = "KAKAO"
    WEB_PUSH = "WEB_PUSH"


class NotificationEventType(str, Enum):
    SUBMIT = "SUBMIT"  # 결재 요청
    APPROVE = "APPROVE"  # 승인
    REJECT = "REJECT"  # 반려
    WITHDRAW = "WITHDRAW"  # 회수
    PAYMENT_COMPLETE = "PAYMENT_COMPLETE"  # 지급 완료


class NotificationStatus(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class RecurringFrequency(str, Enum):
    MONTHLY = "MONTHLY"  # 매월
    QUARTERLY = "QUARTERLY"  # 분기별 (3개월)
    SEMI_ANNUAL = "SEMI_ANNUAL"  # 반기별 (6개월)
    ANNUAL = "ANNUAL"  # 연간


class RecurringExpenseStatus(str, Enum):
    ACTIVE = "ACTIVE"  # 활성 (정상 실행)
    PAUSED = "PAUSED"  # 일시 중지
    COMPLETED = "COMPLETED"  # 완료 (종료일 도달)
    CANCELLED = "CANCELLED"  # 취소


class ApprovalAction(str, Enum):
    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    RESUBMIT = "RESUBMIT"
    WITHDRAW = "WITHDRAW"
    MODIFY_LINE = "MODIFY_LINE"
    MODIFY_CONTENT = "MODIFY_CONTENT"
    DELEGATE = "DELEGATE"
    PAYMENT_COMPLETE = "PAYMENT_COMPLETE"
    PAYMENT_REVERT = "PAYMENT_REVERT"
    PAYMENT_HOLD = "PAYMENT_HOLD"
    PAYMENT_CANCEL = "PAYMENT_CANCEL"
    BULK_EXPENSE_DATE_UPDATE = "BULK_EXPENSE_DATE_UPDATE"


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
