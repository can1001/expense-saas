"""지출결의서 요청/응답 스키마."""

from datetime import datetime

from pydantic import BaseModel, Field


class ExpenseItemInput(BaseModel):
    budgetCategory: str = ""
    budgetSubcategory: str = ""
    budgetDetail: str = Field(min_length=1)
    description: str = Field(min_length=1, max_length=200)
    unitPrice: int = Field(gt=0, le=1_000_000_000)
    quantity: int = Field(gt=0, le=100_000)
    order: int = 0
    # amount 는 서버에서 계산하므로 입력받지 않는다 (조작 방지)


class CreateExpenseRequest(BaseModel):
    committee: str = Field(min_length=1, max_length=50)
    department: str = Field(min_length=1, max_length=50)
    expenseDate: datetime | None = None
    items: list[ExpenseItemInput] = Field(min_length=1)
    requestDate: datetime
    requestTeam: str | None = None
    applicantName: str = Field(min_length=1)
    applicantTitle: str | None = None
    bankName: str = Field(min_length=1)
    accountNumber: str = Field(min_length=1)
    accountHolder: str = Field(min_length=1)


class ExpenseItemOut(BaseModel):
    id: str
    budgetCategory: str
    budgetSubcategory: str
    budgetDetail: str
    description: str
    unitPrice: int
    quantity: int
    amount: int
    order: int


class ExpenseOut(BaseModel):
    id: str
    userId: str
    committee: str
    department: str
    expenseDate: datetime | None
    requestAmount: int
    requestDate: datetime
    requestTeam: str
    applicantName: str
    applicantTitle: str | None
    bankName: str
    accountNumber: str
    accountHolder: str
    status: str
    paymentStatus: str
    submittedAt: datetime | None
    approvedAt: datetime | None
    rejectedAt: datetime | None
    createdAt: datetime
    items: list[ExpenseItemOut] = []


class ExpenseListOut(BaseModel):
    expenses: list[ExpenseOut]
    total: int
