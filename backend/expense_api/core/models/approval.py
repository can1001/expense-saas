"""결재선/결재단계/감사로그 모델 (Prisma ApprovalLine, ApprovalStep, ApprovalLog 이전)."""

from datetime import datetime

from sqlalchemy import JSON, Column, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.enums import StepStatus
from expense_api.core.models.ids import new_id, utcnow


class ApprovalLine(SQLModel, table=True):
    __tablename__ = "ApprovalLine"

    id: str = Field(default_factory=new_id, primary_key=True)
    expenseId: str = Field(foreign_key="Expense.id", ondelete="CASCADE", unique=True, index=True)

    snapshot: dict | None = Field(default=None, sa_column=Column(JSON))  # 제출 시점 고정

    currentStep: int = Field(default=1, index=True)  # 현재 결재 단계
    totalSteps: int
    isUrgent: bool = False

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class ApprovalStep(SQLModel, table=True):
    __tablename__ = "ApprovalStep"

    id: str = Field(default_factory=new_id, primary_key=True)
    approvalLineId: str = Field(foreign_key="ApprovalLine.id", ondelete="CASCADE", index=True)

    stepNumber: int = Field(index=True)  # 결재 순서
    stepName: str  # 결재자 역할명

    approverName: str = Field(index=True)
    approverEmail: str | None = None
    approverTitle: str | None = None

    delegatedTo: str | None = None
    delegationReason: str | None = None

    status: str = Field(default=StepStatus.PENDING.value, index=True)
    approvedAt: datetime | None = None
    rejectedAt: datetime | None = None
    comment: str | None = None

    signatureType: str | None = None  # "signature" | "stamp" | "realtime"
    signatureData: str | None = None  # base64

    isRequired: bool = True
    isParallel: bool = False

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class ApprovalLog(SQLModel, table=True):
    __tablename__ = "ApprovalLog"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용

    expenseId: str = Field(index=True)

    action: str = Field(index=True)  # ApprovalAction
    actorName: str = Field(index=True)
    actorEmail: str | None = None
    actorRole: str | None = None

    stepNumber: int | None = None
    stepName: str | None = None

    previousStatus: str | None = None
    newStatus: str

    comment: str | None = None
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSON))

    beforeSnapshot: dict | None = Field(default=None, sa_column=Column(JSON))
    afterSnapshot: dict | None = Field(default=None, sa_column=Column(JSON))

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True
    )
