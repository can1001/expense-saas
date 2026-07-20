"""지출 템플릿·저장된 계좌 요청/응답 스키마 (B5)."""

import re
from datetime import datetime

from pydantic import BaseModel, Field

_ACCOUNT_NUMBER_RE = re.compile(r"^[0-9-]+$")


class ExpenseTemplateOut(BaseModel):
    id: str
    tenantId: str | None
    userId: str
    name: str
    budgetCategory: str
    budgetSubcategory: str
    budgetDetail: str
    description: str | None
    defaultAmount: int | None
    usageCount: int
    createdAt: datetime
    updatedAt: datetime


class ExpenseTemplateListOut(BaseModel):
    templates: list[ExpenseTemplateOut]


class CreateExpenseTemplateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    budgetCategory: str = Field(min_length=1)
    budgetSubcategory: str = Field(min_length=1)
    budgetDetail: str = Field(min_length=1)
    description: str | None = None
    defaultAmount: int | None = Field(default=None, gt=0)


class UpdateExpenseTemplateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    budgetCategory: str | None = Field(default=None, min_length=1)
    budgetSubcategory: str | None = Field(default=None, min_length=1)
    budgetDetail: str | None = Field(default=None, min_length=1)
    description: str | None = None
    defaultAmount: int | None = None


class SavedBankAccountOut(BaseModel):
    id: str
    tenantId: str | None
    userId: str
    bankName: str
    accountNumber: str
    accountHolder: str
    nickname: str | None
    isDefault: bool
    createdAt: datetime
    updatedAt: datetime


class SavedBankAccountListOut(BaseModel):
    accounts: list[SavedBankAccountOut]


class CreateSavedBankAccountRequest(BaseModel):
    bankName: str = Field(min_length=1, max_length=50)
    accountNumber: str = Field(min_length=1, max_length=50, pattern=_ACCOUNT_NUMBER_RE.pattern)
    accountHolder: str = Field(min_length=1, max_length=50)
    nickname: str | None = Field(default=None, max_length=50)
    isDefault: bool = False


class UpdateSavedBankAccountRequest(BaseModel):
    bankName: str | None = Field(default=None, min_length=1, max_length=50)
    accountNumber: str | None = Field(
        default=None, min_length=1, max_length=50, pattern=_ACCOUNT_NUMBER_RE.pattern
    )
    accountHolder: str | None = Field(default=None, min_length=1, max_length=50)
    nickname: str | None = None
    isDefault: bool | None = None
