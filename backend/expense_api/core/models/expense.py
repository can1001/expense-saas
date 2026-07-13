"""지출결의서 모델 (Prisma Expense, ExpenseItem, ExpenseAttachment 이전).

컬럼명 camelCase 보존, tenantId 스코프. enum은 String 저장. (spec §4)
"""

from datetime import datetime

from sqlalchemy import Column, Text, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.enums import ApprovalStatus, PaymentStatus
from expense_api.core.models.ids import new_id, utcnow


class Expense(SQLModel, table=True):
    __tablename__ = "Expense"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, foreign_key="Tenant.id", index=True)
    userId: str = Field(foreign_key="User.id", index=True)

    committee: str = Field(index=True)
    department: str = Field(index=True)

    expenseDate: datetime | None = None
    requestAmount: int  # 자동 계산 (Σ item.amount)

    requestDate: datetime = Field(index=True)
    requestTeam: str = "출납팀"
    applicantName: str = Field(index=True)
    applicantTitle: str | None = None

    applicantSignatureType: str | None = None  # "signature" | "stamp"
    applicantSignatureData: str | None = Field(default=None, sa_column=Column(Text))

    bankName: str
    accountNumber: str
    accountHolder: str

    status: str = Field(default=ApprovalStatus.DRAFT.value, index=True)
    submittedAt: datetime | None = None
    approvedAt: datetime | None = None
    rejectedAt: datetime | None = None

    paymentStatus: str = Field(default=PaymentStatus.PENDING.value, index=True)
    paymentCompletedAt: datetime | None = None
    paymentCompletedBy: str | None = None
    paymentNote: str | None = None
    paymentHoldReason: str | None = None
    paymentHoldAt: datetime | None = None
    paymentHoldBy: str | None = None
    paymentSignatureType: str | None = None
    paymentSignatureData: str | None = Field(default=None, sa_column=Column(Text))

    recurringExpenseId: str | None = None  # Phase 4: RecurringExpense FK 로 승격

    version: str = "4.1.3"
    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class ExpenseItem(SQLModel, table=True):
    __tablename__ = "ExpenseItem"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용

    expenseId: str = Field(foreign_key="Expense.id", index=True)

    budgetCategory: str = ""  # 예산(항)
    budgetSubcategory: str = ""  # 예산(목)
    budgetDetail: str  # 예산(세목)
    description: str  # 적요
    unitPrice: int  # 단가
    quantity: int  # 수량
    amount: int  # 금액 = unitPrice × quantity (서버 계산)

    order: int  # 순서
    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )


class ExpenseAttachment(SQLModel, table=True):
    __tablename__ = "ExpenseAttachment"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)

    expenseId: str = Field(foreign_key="Expense.id", index=True)

    publicId: str  # Cloudinary public_id
    url: str
    secureUrl: str
    format: str
    fileName: str
    fileSize: int
    width: int | None = None
    height: int | None = None

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
