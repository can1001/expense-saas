"""결재 정책 요청/응답 스키마."""

from enum import Enum

from pydantic import BaseModel, Field


class ApproverType(str, Enum):
    ROLE = "role"  # UserYearRole(year, role) 담당자
    BUDGET_MANAGER = "budget_manager"  # BudgetDetailYear(년도) 담당자
    FIXED_USER = "fixed_user"  # 특정 사용자 고정


class PolicyStepRule(BaseModel):
    stepName: str
    approverType: ApproverType
    role: str | None = None  # role 타입, 또는 budget_manager 미지정 시 폴백 role
    userId: str | None = None  # fixed_user 타입
    autoApproveWhenSelf: bool = True  # 신청자==결재자 → 전결


class ApprovalPolicyCreate(BaseModel):
    name: str = Field(min_length=1)
    steps: list[PolicyStepRule] = Field(min_length=1)
    isDefault: bool = False
    collapseDuplicateApprovers: bool = True


class ApprovalPolicyOut(BaseModel):
    id: str
    name: str
    isDefault: bool
    isActive: bool
    collapseDuplicateApprovers: bool
    steps: list[dict]


class ResolvedStepOut(BaseModel):
    stepNumber: int
    stepName: str
    approverName: str
    approverId: str | None
    isAutoApproved: bool


class CalculatedLineOut(BaseModel):
    totalSteps: int
    firstPendingStep: int  # 자동승인 이후 첫 대기 단계
    allAutoApproved: bool
    steps: list[ResolvedStepOut]
