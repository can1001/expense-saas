"""결재 정책 모델 (설정형 결재선, spec §15.3).

교회 직제에 하드코딩된 결재선 자동 산출(lib/services/approval-line-service.ts)을
테넌트별 설정 데이터로 일반화한다. 정책은 순서 있는 스텝 규칙을 담고,
제출 시 ApprovalPolicyEngine 이 이를 구체 결재자로 resolve 한다.

steps(JSON) 각 항목 스키마 (schemas/approval_policy.py PolicyStepRule):
  {
    "stepName": "회계",
    "approverType": "role" | "budget_manager" | "fixed_user",
    "role": "accountant",        # role, 또는 budget_manager 미지정 시 폴백 role
    "userId": null,              # fixed_user 일 때
    "autoApproveWhenSelf": true  # 신청자==결재자면 전결(자동승인)
  }
"""

from datetime import datetime

from sqlalchemy import JSON, Column, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.ids import new_id, utcnow


class ApprovalPolicy(SQLModel, table=True):
    __tablename__ = "ApprovalPolicy"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, foreign_key="Tenant.id", index=True)

    name: str
    isDefault: bool = Field(default=False, index=True)  # 테넌트 기본 정책
    isActive: bool = Field(default=True, index=True)

    # 순서 있는 스텝 규칙 목록
    steps: list[dict] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]")
    )

    # 전결: 동일 결재자가 뒤 단계에도 있으면 앞 단계를 자동승인 처리
    collapseDuplicateApprovers: bool = True

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
