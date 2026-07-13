"""지출결의서 서비스 — 생성/조회. (app/api/expenses/route.ts 로직 이전)

신규 생성은 항상 DRAFT. 금액은 서버에서 재계산(조작 방지). 제출은 approval_service.submit.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.domain.amount import calculate_amount, calculate_request_amount
from expense_api.core.models.enums import ApprovalStatus, PaymentStatus
from expense_api.core.models.expense import Expense, ExpenseItem
from expense_api.core.repository.expense_repository import ExpenseRepository
from expense_api.core.schemas.expense import CreateExpenseRequest, ExpenseItemOut, ExpenseOut


def _derive_request_team(committee: str, department: str) -> str:
    """청구팀 자동 생성 (committee/department 기반)."""
    return department or committee or "출납팀"


def to_out(expense: Expense, items: list[ExpenseItem]) -> ExpenseOut:
    return ExpenseOut(
        id=expense.id,
        userId=expense.userId,
        committee=expense.committee,
        department=expense.department,
        expenseDate=expense.expenseDate,
        requestAmount=expense.requestAmount,
        requestDate=expense.requestDate,
        requestTeam=expense.requestTeam,
        applicantName=expense.applicantName,
        applicantTitle=expense.applicantTitle,
        bankName=expense.bankName,
        accountNumber=expense.accountNumber,
        accountHolder=expense.accountHolder,
        status=expense.status,
        paymentStatus=expense.paymentStatus,
        submittedAt=expense.submittedAt,
        approvedAt=expense.approvedAt,
        rejectedAt=expense.rejectedAt,
        createdAt=expense.createdAt,
        items=[
            ExpenseItemOut(
                id=it.id,
                budgetCategory=it.budgetCategory,
                budgetSubcategory=it.budgetSubcategory,
                budgetDetail=it.budgetDetail,
                description=it.description,
                unitPrice=it.unitPrice,
                quantity=it.quantity,
                amount=it.amount,
                order=it.order,
            )
            for it in items
        ],
    )


class ExpenseService:
    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id
        self.repo = ExpenseRepository(session, tenant_id)

    async def create(self, user_id: str, data: CreateExpenseRequest) -> ExpenseOut:
        # 금액 서버 재계산
        item_models: list[ExpenseItem] = []
        amounts: list[int] = []
        for idx, it in enumerate(data.items):
            amount = calculate_amount(it.unitPrice, it.quantity)
            amounts.append(amount)
            item_models.append(
                ExpenseItem(
                    tenantId=self.tenant_id,
                    budgetCategory=it.budgetCategory,
                    budgetSubcategory=it.budgetSubcategory,
                    budgetDetail=it.budgetDetail,
                    description=it.description,
                    unitPrice=it.unitPrice,
                    quantity=it.quantity,
                    amount=amount,
                    order=it.order or (idx + 1),
                )
            )
        request_amount = calculate_request_amount(amounts)

        expense = Expense(
            tenantId=self.tenant_id,
            userId=user_id,
            committee=data.committee,
            department=data.department,
            expenseDate=data.expenseDate,
            requestAmount=request_amount,
            requestDate=data.requestDate,
            requestTeam=data.requestTeam or _derive_request_team(data.committee, data.department),
            applicantName=data.applicantName,
            applicantTitle=data.applicantTitle,
            bankName=data.bankName,
            accountNumber=data.accountNumber,
            accountHolder=data.accountHolder,
            status=ApprovalStatus.DRAFT.value,  # 신규는 항상 DRAFT
            paymentStatus=PaymentStatus.PENDING.value,
        )
        self.session.add(expense)
        await self.session.flush()  # expense.id 확보

        for it in item_models:
            it.expenseId = expense.id
            self.session.add(it)
        await self.session.commit()
        await self.session.refresh(expense)

        items = await self.repo.list_items(expense.id)
        return to_out(expense, items)

    async def list(self, *, only_user_id: str | None) -> list[ExpenseOut]:
        expenses = await self.repo.list(only_user_id=only_user_id)
        out: list[ExpenseOut] = []
        for e in expenses:
            items = await self.repo.list_items(e.id)
            out.append(to_out(e, items))
        return out

    async def get(self, expense_id: str) -> ExpenseOut | None:
        expense = await self.repo.get(expense_id)
        if expense is None:
            return None
        items = await self.repo.list_items(expense_id)
        return to_out(expense, items)
