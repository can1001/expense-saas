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


class UpdateExpenseRequest(BaseModel):
    """지출결의서 수정 요청 — 레거시 updateExpenseSchema(createExpenseSchema.partial())와 동일하게 전 필드 선택.

    status 는 레거시 route.ts 처럼 스키마 밖에서 처리하는 passthrough 필드(DRAFT|PENDING).
    """

    committee: str | None = Field(default=None, min_length=1, max_length=50)
    department: str | None = Field(default=None, min_length=1, max_length=50)
    expenseDate: datetime | None = None
    items: list[ExpenseItemInput] | None = None
    requestDate: datetime | None = None
    requestTeam: str | None = None
    applicantName: str | None = Field(default=None, min_length=1)
    applicantTitle: str | None = None
    bankName: str | None = Field(default=None, min_length=1)
    accountNumber: str | None = Field(default=None, min_length=1)
    accountHolder: str | None = Field(default=None, min_length=1)
    status: str | None = None


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


class ExpenseListItemOut(BaseModel):
    id: str
    committee: str
    department: str
    requestAmount: int
    applicantName: str
    requestDate: datetime
    createdAt: datetime
    status: str
    paymentStatus: str
    approvedAt: datetime | None
    expenseDate: datetime | None
    version: str
    items: list[ExpenseItemOut] = []


class ExpensePaginationOut(BaseModel):
    page: int
    limit: int
    total: int
    totalPages: int


class ExpenseAggregatesOut(BaseModel):
    totalCount: int
    totalRequestAmount: int


class ExpenseListOut(BaseModel):
    expenses: list[ExpenseListItemOut]
    pagination: ExpensePaginationOut
    aggregates: ExpenseAggregatesOut


# ── 필터 옵션 (app/api/expenses/filter-options 이전) ────────────────────


class FilterOptionsOut(BaseModel):
    committees: list[str]
    departments: list[str]
    budgetCategories: list[str]


# ── 지급 상태 (app/api/expenses/[id]/payment-status 이전) ──────────────


class PaymentStatusSignatureInput(BaseModel):
    type: str | None = None
    signatureId: str | None = None
    data: str | None = None


class UpdatePaymentStatusRequest(BaseModel):
    paymentStatus: str
    note: str | None = None
    reason: str | None = None
    signature: PaymentStatusSignatureInput | None = None
    expenseDate: datetime | None = None


class PaymentStatusDataOut(BaseModel):
    id: str
    paymentStatus: str
    paymentCompletedAt: datetime | None
    paymentCompletedBy: str | None
    paymentNote: str | None
    paymentHoldReason: str | None
    paymentHoldAt: datetime | None
    paymentHoldBy: str | None
    paymentSignatureType: str | None
    paymentSignatureData: str | None
    expenseDate: datetime | None


class UpdatePaymentStatusOut(BaseModel):
    success: bool
    message: str
    data: PaymentStatusDataOut


class PaymentStatusGetOut(BaseModel):
    id: str
    status: str
    paymentStatus: str
    paymentCompletedAt: datetime | None
    paymentCompletedBy: str | None
    paymentNote: str | None


# ── 첨부파일 (app/api/expenses/[id]/attachments*, upload* 이전, B2) ─────


class AttachmentOut(BaseModel):
    id: str
    tenantId: str | None
    expenseId: str
    publicId: str
    url: str
    secureUrl: str
    format: str
    fileName: str
    fileSize: int
    width: int | None
    height: int | None
    createdAt: datetime


class CreateAttachmentRequest(BaseModel):
    publicId: str
    url: str
    secureUrl: str
    format: str
    fileName: str
    fileSize: int
    width: int | None = None
    height: int | None = None


class ExpenseWithAttachmentsOut(ExpenseOut):
    attachments: list[AttachmentOut] = []


class DuplicateExpenseOut(BaseModel):
    success: bool
    message: str
    expense: ExpenseWithAttachmentsOut


# ── 간편 지출결의서 (app/api/simple-expenses*, B4) ──────────────────────
# Expense 테이블에 version="4.1.4"로 저장. 항목마다 예산(항/목/세목)을 갖는다.


class SimpleExpenseItemInput(BaseModel):
    budgetCategory: str = Field(min_length=1, max_length=100)
    budgetSubcategory: str = Field(min_length=1, max_length=100)
    budgetDetail: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=200)
    unitPrice: int = Field(ge=0, le=1_000_000_000)
    quantity: int = Field(gt=0, le=100_000)
    order: int | None = None
    # amount 는 서버에서 계산 (조작 방지)


class CreateSimpleExpenseRequest(BaseModel):
    expenseDate: datetime | None = None
    items: list[SimpleExpenseItemInput] = Field(min_length=1)
    requestDate: datetime
    applicantName: str = Field(min_length=1)
    bankName: str = Field(min_length=1)
    accountNumber: str = Field(min_length=1)
    accountHolder: str = Field(min_length=1)
    status: str = "DRAFT"  # DRAFT|PENDING


class UpdateSimpleExpenseRequest(BaseModel):
    expenseDate: datetime | None = None
    items: list[SimpleExpenseItemInput] | None = None
    requestDate: datetime | None = None
    applicantName: str | None = Field(default=None, min_length=1)
    bankName: str | None = Field(default=None, min_length=1)
    accountNumber: str | None = Field(default=None, min_length=1)
    accountHolder: str | None = Field(default=None, min_length=1)


class SimpleExpenseOut(ExpenseOut):
    version: str


class SimpleExpenseDetailOut(SimpleExpenseOut):
    attachments: list[AttachmentOut] = []


class SimpleExpenseListOut(BaseModel):
    expenses: list[SimpleExpenseOut]
    pagination: ExpensePaginationOut


class CreateSimpleExpenseOut(BaseModel):
    success: bool
    message: str
    id: str
    expense: SimpleExpenseOut
