"""지출결의서 서비스 — 생성/조회. (app/api/expenses/route.ts 로직 이전)

신규 생성은 항상 DRAFT. 금액은 서버에서 재계산(조작 방지). 제출은 approval_service.submit.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS, has_permission
from expense_api.core.dependencies.auth import CurrentUser
from expense_api.core.domain.amount import calculate_amount, calculate_request_amount
from expense_api.core.models.budget import Committee, Department
from expense_api.core.models.enums import ApprovalStatus, PaymentStatus
from expense_api.core.models.expense import Expense, ExpenseItem
from expense_api.core.models.user import UserYearRole
from expense_api.core.repository.expense_repository import ExpenseRepository
from expense_api.core.schemas.expense import (
    CreateExpenseRequest,
    ExpenseAggregatesOut,
    ExpenseItemOut,
    ExpenseListItemOut,
    ExpenseListOut,
    ExpenseOut,
    ExpensePaginationOut,
)

# 연도별 역할 우선순위 (낮을수록 높은 우선순위) — lib/services/user-service.ts ROLE_PRIORITY 와 동일
_ROLE_PRIORITY = {
    "finance_head": 0,
    "accountant": 1,
    "finance_member": 2,
    "admin_assistant": 3,
    "team_leader": 4,
    "user": 99,
}


def _derive_request_team(committee: str, department: str) -> str:
    """청구팀 자동 생성 (committee/department 기반)."""
    return department or committee or "출납팀"


def to_list_item_out(expense: Expense, items: list[ExpenseItem]) -> ExpenseListItemOut:
    return ExpenseListItemOut(
        id=expense.id,
        committee=expense.committee,
        department=expense.department,
        requestAmount=expense.requestAmount,
        applicantName=expense.applicantName,
        requestDate=expense.requestDate,
        createdAt=expense.createdAt,
        status=expense.status,
        paymentStatus=expense.paymentStatus,
        approvedAt=expense.approvedAt,
        expenseDate=expense.expenseDate,
        version=expense.version,
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

    async def resolve_read_scope(
        self, user: CurrentUser, year: int
    ) -> tuple[str | None, str | None]:
        """권한 기반 목록 조회 스코프 (only_user_id, only_department).

        (app/api/expenses/route.ts 역할 기반 필터링 이전)
        둘 다 None 이면 전체 조회 권한.
        """
        effective_role, department_id = await self._resolve_effective_role(user, year)

        if has_permission([effective_role], PERMISSIONS.EXPENSE_READ_ALL):
            return None, None

        if effective_role == "team_leader":
            department = user.department
            if department_id:
                row = (
                    await self.session.execute(
                        select(Department.name, Committee.name)
                        .join(Committee, Committee.id == Department.committeeId)
                        .where(Department.id == department_id, Department.tenantId == self.tenant_id)
                    )
                ).first()
                if row:
                    department = f"{row[1]}/{row[0]}"
            if department:
                return None, department
            return user.id, None

        return user.id, None

    async def _resolve_effective_role(
        self, user: CurrentUser, year: int
    ) -> tuple[str, str | None]:
        """연도별 유효 역할 조회 (UserYearRole 기준). (lib/services/user-service.ts getEffectiveRole 이전)"""
        if user.role == "admin":
            return "admin", None

        stmt = select(UserYearRole).where(UserYearRole.userId == user.id, UserYearRole.year == year)
        year_roles = (await self.session.execute(stmt)).scalars().all()
        if year_roles:
            best = min(year_roles, key=lambda r: _ROLE_PRIORITY.get(r.role, 99))
            return best.role, best.departmentId
        return user.role, None

    async def list(
        self,
        *,
        only_user_id: str | None = None,
        only_department: str | None = None,
        committee: str | None = None,
        department: str | None = None,
        category: str | None = None,
        status: str | None = None,
        payment_status: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        min_amount: int | None = None,
        max_amount: int | None = None,
        approved_start: datetime | None = None,
        approved_end: datetime | None = None,
        expense_start: datetime | None = None,
        expense_end: datetime | None = None,
        q: str | None = None,
        sort_by: str = "createdAt",
        sort_dir: str = "desc",
        page: int = 1,
        limit: int = 50,
    ) -> ExpenseListOut:
        offset = (page - 1) * limit
        expenses, total, total_amount = await self.repo.list(
            only_user_id=only_user_id,
            only_department=only_department,
            committee=committee,
            department=department,
            category=category,
            status=status,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
            min_amount=min_amount,
            max_amount=max_amount,
            approved_start=approved_start,
            approved_end=approved_end,
            expense_start=expense_start,
            expense_end=expense_end,
            q=q,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        out: list[ExpenseListItemOut] = []
        for e in expenses:
            items = await self.repo.list_items(e.id)
            out.append(to_list_item_out(e, items))

        total_pages = (total + limit - 1) // limit if limit else 0
        return ExpenseListOut(
            expenses=out,
            pagination=ExpensePaginationOut(page=page, limit=limit, total=total, totalPages=total_pages),
            aggregates=ExpenseAggregatesOut(totalCount=total, totalRequestAmount=total_amount),
        )

    async def get(self, expense_id: str) -> ExpenseOut | None:
        expense = await self.repo.get(expense_id)
        if expense is None:
            return None
        items = await self.repo.list_items(expense_id)
        return to_out(expense, items)
