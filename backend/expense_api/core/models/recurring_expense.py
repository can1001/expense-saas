"""자동이체(정기 지출결의서) 모델 (Prisma RecurringExpense 이전, B6).

컬럼명 camelCase 보존, tenantId 스코프. frequency/status enum은 String 저장.
"""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import Field, SQLModel

from expense_api.core.models.enums import RecurringExpenseStatus, RecurringFrequency
from expense_api.core.models.ids import new_id, utcnow


class RecurringExpense(SQLModel, table=True):
    __tablename__ = "RecurringExpense"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)
    userId: str = Field(foreign_key="User.id", index=True)

    name: str
    description: str | None = None

    committee: str
    department: str

    budgetCategory: str
    budgetSubcategory: str
    budgetDetail: str | None = None

    recipientName: str
    bankName: str
    accountNumber: str

    baseAmount: int

    frequency: str = RecurringFrequency.MONTHLY.value
    dayOfMonth: int
    startDate: datetime
    endDate: datetime | None = None

    advanceDays: int = 7

    status: str = Field(default=RecurringExpenseStatus.ACTIVE.value, index=True)

    lastGeneratedDate: datetime | None = None
    nextGenerationDate: datetime | None = Field(default=None, index=True)

    deletedAt: datetime | None = Field(default=None, index=True)

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
