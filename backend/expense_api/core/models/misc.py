"""지출 템플릿·저장된 계좌 모델 (Prisma ExpenseTemplate, SavedBankAccount 이전, B5).

컬럼명 camelCase 보존, tenantId 스코프. 둘 다 본인(userId) 소유 리소스.
"""

from datetime import datetime

from sqlalchemy import UniqueConstraint, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.ids import new_id, utcnow


class ExpenseTemplate(SQLModel, table=True):
    __tablename__ = "ExpenseTemplate"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)
    userId: str = Field(foreign_key="User.id", index=True)

    name: str

    budgetCategory: str
    budgetSubcategory: str
    budgetDetail: str

    description: str | None = None
    defaultAmount: int | None = None

    usageCount: int = 0

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class SavedBankAccount(SQLModel, table=True):
    __tablename__ = "SavedBankAccount"
    __table_args__ = (UniqueConstraint("userId", "accountNumber"),)

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)
    userId: str = Field(foreign_key="User.id", index=True)

    bankName: str
    accountNumber: str
    accountHolder: str

    nickname: str | None = None
    isDefault: bool = Field(default=False, index=True)

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
