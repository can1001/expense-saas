"""예산 계층 모델 (Prisma 이전).

5단계 계층: 위원회(Committee) → 사역팀/부(Department) → 예산 항(BudgetCategory)
→ 예산 목(BudgetSubcategory) → 예산 세목(BudgetDetail)
+ 연도별 세목 설정(BudgetDetailYear), 부서-세목 연결(DepartmentBudgetDetail)

컬럼명 camelCase 보존, tenantId 스코프. (spec §4.1)
"""

from datetime import datetime

from sqlalchemy import UniqueConstraint, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.ids import new_id, utcnow


class Committee(SQLModel, table=True):
    __tablename__ = "Committee"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, foreign_key="Tenant.id", index=True)

    name: str  # 위원회명 (테넌트 내 유니크)
    sortOrder: int = Field(default=0, index=True)
    isActive: bool = Field(default=True, index=True)

    leaderId: str | None = Field(default=None, foreign_key="User.id", index=True)

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


class Department(SQLModel, table=True):
    __tablename__ = "Department"
    __table_args__ = (UniqueConstraint("committeeId", "name", name="uq_department_committee_name"),)

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용

    committeeId: str = Field(foreign_key="Committee.id", index=True)
    name: str  # 사역팀/부
    sortOrder: int = Field(default=0, index=True)
    isActive: bool = Field(default=True, index=True)

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


class BudgetCategory(SQLModel, table=True):
    __tablename__ = "BudgetCategory"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, foreign_key="Tenant.id", index=True)

    name: str  # 예산(항) (테넌트 내 유니크)
    sortOrder: int = Field(default=0, index=True)
    isActive: bool = Field(default=True, index=True)

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


class BudgetSubcategory(SQLModel, table=True):
    __tablename__ = "BudgetSubcategory"
    __table_args__ = (UniqueConstraint("categoryId", "name", name="uq_subcategory_category_name"),)

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용

    categoryId: str = Field(foreign_key="BudgetCategory.id", index=True)
    name: str  # 예산(목)
    sortOrder: int = Field(default=0, index=True)
    isActive: bool = Field(default=True, index=True)

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


class BudgetDetail(SQLModel, table=True):
    __tablename__ = "BudgetDetail"
    __table_args__ = (UniqueConstraint("subcategoryId", "name", name="uq_detail_subcategory_name"),)

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용

    subcategoryId: str = Field(foreign_key="BudgetSubcategory.id", index=True)
    name: str  # 예산(세목)
    accountCode: str | None = None  # 계정코드
    description: str | None = None  # 항목 내역
    sortOrder: int = Field(default=0, index=True)
    isActive: bool = Field(default=True, index=True)

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


class BudgetDetailYear(SQLModel, table=True):
    __tablename__ = "BudgetDetailYear"
    __table_args__ = (UniqueConstraint("budgetDetailId", "year", name="uq_detailyear_detail_year"),)

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용

    budgetDetailId: str = Field(foreign_key="BudgetDetail.id", index=True)
    year: int = Field(index=True)

    managerId: str | None = Field(default=None, foreign_key="User.id", index=True)  # 담당자(1차 결재자)

    budgetAmount: int = 0  # 배정 예산
    usedAmount: int = 0  # 사용 금액(집계)
    isActive: bool = Field(default=True, index=True)

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


class DepartmentBudgetDetail(SQLModel, table=True):
    __tablename__ = "DepartmentBudgetDetail"
    __table_args__ = (
        UniqueConstraint("departmentId", "budgetDetailId", name="uq_deptdetail_dept_detail"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용

    departmentId: str = Field(foreign_key="Department.id", index=True)
    budgetDetailId: str = Field(foreign_key="BudgetDetail.id", index=True)
    isActive: bool = True

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
