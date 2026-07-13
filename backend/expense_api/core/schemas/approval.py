"""결재 워크플로우 요청/응답 스키마."""

from datetime import datetime

from pydantic import BaseModel, Field


class ApprovalStepInput(BaseModel):
    stepNumber: int = Field(ge=1)
    stepName: str  # "팀장", "회계", "재정팀장" 등
    approverName: str
    approverEmail: str | None = None
    approverTitle: str | None = None


class SubmitRequest(BaseModel):
    # steps 를 주면 그대로 사용(수동), 없으면 테넌트 결재 정책으로 자동 산출(§15.3).
    steps: list[ApprovalStepInput] | None = None
    policyId: str | None = None  # 특정 정책 지정 (없으면 기본 정책)
    isUrgent: bool = False


class ApproveRequest(BaseModel):
    comment: str | None = None


class RejectRequest(BaseModel):
    comment: str = Field(min_length=1)  # 반려 사유 필수


class ApprovalStepOut(BaseModel):
    stepNumber: int
    stepName: str
    approverName: str
    status: str
    approvedAt: datetime | None
    rejectedAt: datetime | None
    comment: str | None


class ApprovalLineOut(BaseModel):
    expenseId: str
    currentStep: int
    totalSteps: int
    isUrgent: bool
    steps: list[ApprovalStepOut]


class WorkflowResult(BaseModel):
    expenseId: str
    status: str  # 지출결의서 상태
    currentStep: int | None = None
    totalSteps: int | None = None
