"""자동이체 요청/응답 스키마 (B6)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

_FREQUENCIES = ("MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL")
_UPDATE_STATUSES = ("ACTIVE", "PAUSED")


class CreateRecurringExpenseRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    committee: str = Field(min_length=1)
    department: str = Field(min_length=1)
    budgetCategory: str = Field(min_length=1)
    budgetSubcategory: str = Field(min_length=1)
    budgetDetail: str | None = None
    recipientName: str = Field(min_length=1)
    bankName: str = Field(min_length=1)
    accountNumber: str = Field(min_length=1)
    baseAmount: int = Field(ge=0)
    frequency: Literal[_FREQUENCIES]
    dayOfMonth: int = Field(ge=1, le=28)
    startDate: datetime
    endDate: datetime | None = None
    advanceDays: int = Field(default=7, ge=0, le=30)


class UpdateRecurringExpenseRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    recipientName: str | None = Field(default=None, min_length=1)
    bankName: str | None = Field(default=None, min_length=1)
    accountNumber: str | None = Field(default=None, min_length=1)
    baseAmount: int | None = Field(default=None, ge=0)
    dayOfMonth: int | None = Field(default=None, ge=1, le=28)
    advanceDays: int | None = Field(default=None, ge=0, le=30)
    endDate: datetime | None = None
    status: Literal[_UPDATE_STATUSES] | None = None


class RecurringExpenseOut(BaseModel):
    id: str
    tenantId: str | None
    userId: str
    name: str
    description: str | None
    committee: str
    department: str
    budgetCategory: str
    budgetSubcategory: str
    budgetDetail: str | None
    recipientName: str
    bankName: str
    accountNumber: str
    baseAmount: int
    frequency: str
    dayOfMonth: int
    startDate: datetime
    endDate: datetime | None
    advanceDays: int
    status: str
    lastGeneratedDate: datetime | None
    nextGenerationDate: datetime | None
    deletedAt: datetime | None
    createdAt: datetime
    updatedAt: datetime


class RecurringExpenseUserOut(BaseModel):
    id: str
    username: str


class RecurringExpenseWithUserOut(RecurringExpenseOut):
    user: RecurringExpenseUserOut


class RecurringExpenseListOut(BaseModel):
    recurringExpenses: list[RecurringExpenseWithUserOut]
    nextCursor: str | None
    hasMore: bool


class RecurringExpenseGeneratedExpenseOut(BaseModel):
    id: str
    requestAmount: int
    status: str
    createdAt: datetime
    accountHolder: str


class RecurringExpenseDetailOut(RecurringExpenseWithUserOut):
    generatedExpenses: list[RecurringExpenseGeneratedExpenseOut]


class GenerateRecurringExpenseOut(BaseModel):
    expenseId: str
