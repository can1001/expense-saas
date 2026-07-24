"""테넌트 프로비저닝 템플릿 모델 (Prisma AccountCategoryTemplate/AccountCategory/
ApprovalLineTemplate/ApprovalStepTemplate 이전).

슈퍼 어드민이 관리하는 전역 템플릿(*Template)과, 테넌트 생성 시 그 템플릿을
복제해 테넌트별로 독립시킨 복제본(AccountCategory)을 함께 담는다.
컬럼명 camelCase 보존. (spec §4.1)
"""

from datetime import datetime

from sqlalchemy import UniqueConstraint, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.enums import CategoryKind, pg_enum
from expense_api.core.models.ids import new_id, utcnow


class AccountCategoryTemplate(SQLModel, table=True):
    """계정과목 템플릿 (전역 청사진, orgType 별) — 슈퍼 어드민 관리."""

    __tablename__ = "AccountCategoryTemplate"
    __table_args__ = (
        UniqueConstraint("orgType", "code", name="uq_accountcategorytemplate_orgtype_code"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    orgType: str = Field(sa_type=pg_enum("OrgType"))
    code: str  # 계정과목 코드 (예: "1001", "5101")
    name: str
    group: str  # 코드대 그룹명 (예: "헌금수입", "인건비")
    kind: str = Field(default=CategoryKind.EXPENSE.value, sa_type=pg_enum("CategoryKind"))
    sortOrder: int
    isActive: bool = Field(default=True)

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class AccountCategory(SQLModel, table=True):
    """계정과목 (테넌트 복제본) — 템플릿과 FK 로 묶지 않는다 ("복제 후 독립")."""

    __tablename__ = "AccountCategory"
    __table_args__ = (UniqueConstraint("tenantId", "code", name="uq_accountcategory_tenant_code"),)

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str = Field(foreign_key="Tenant.id", index=True)

    code: str
    name: str
    group: str
    kind: str = Field(default=CategoryKind.EXPENSE.value, sa_type=pg_enum("CategoryKind"))
    sortOrder: int
    isActive: bool = Field(default=True)

    # 프로비저닝 출처 템플릿 id (FK 없음 — 템플릿 삭제/개편에도 복제본은 영향받지 않음)
    sourceTemplateId: str | None = None

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class ApprovalLineTemplate(SQLModel, table=True):
    """결재선 템플릿 (전역 청사진) — 슈퍼 어드민 관리, 프로비저닝 시 settings.approvalLines 로 복제."""

    __tablename__ = "ApprovalLineTemplate"

    id: str = Field(default_factory=new_id, primary_key=True)
    orgType: str = Field(index=True, sa_type=pg_enum("OrgType"))
    name: str
    description: str | None = None
    isDefault: bool = Field(default=False)
    sortOrder: int

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class ApprovalStepTemplate(SQLModel, table=True):
    """결재선 템플릿 단계."""

    __tablename__ = "ApprovalStepTemplate"

    id: str = Field(default_factory=new_id, primary_key=True)
    templateId: str = Field(foreign_key="ApprovalLineTemplate.id", ondelete="CASCADE", index=True)

    stepOrder: int
    roleLabel: str  # 결재자 역할 표기 (예: "부서장", "재정부장", "담임목사")

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )


__all__ = [
    "AccountCategoryTemplate",
    "AccountCategory",
    "ApprovalLineTemplate",
    "ApprovalStepTemplate",
]
