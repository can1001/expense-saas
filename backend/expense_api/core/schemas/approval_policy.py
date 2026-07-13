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
    # 조건부: 청구금액이 [minAmount, maxAmount] 범위일 때만 이 단계 포함
    minAmount: int | None = None
    maxAmount: int | None = None
    # 병렬: True 면 (직전 포함 단계와) 같은 레벨에서 동시 결재
    parallel: bool = False


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
    stepNumber: int  # 결재 레벨 (병렬 시 여러 스텝이 동일 값 공유)
    stepName: str
    approverName: str
    approverId: str | None
    isAutoApproved: bool
    isParallel: bool = False


class CalculatedLineOut(BaseModel):
    totalSteps: int  # 전체 레벨 수 (병렬 스텝은 한 레벨로 계산)
    firstPendingStep: int  # 선두 연속 전결 레벨 이후 첫 대기 레벨
    allAutoApproved: bool
    steps: list[ResolvedStepOut]
