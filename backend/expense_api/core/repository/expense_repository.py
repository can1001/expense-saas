"""지출결의서 리포지토리 (tenant-scoped)."""

from __future__ import annotations  # list 메서드가 builtin list 애노테이션을 가리는 문제 방지

from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.expense import Expense, ExpenseItem

# 서버 정렬 허용 키 — app/api/expenses/route.ts SORTABLE_KEYS 와 동일
_SORTABLE_COLUMNS = {
    "requestDate": Expense.requestDate,
    "applicantName": Expense.applicantName,
    "requestAmount": Expense.requestAmount,
    "committee": Expense.committee,
    "status": Expense.status,
    "approvedAt": Expense.approvedAt,
    "expenseDate": Expense.expenseDate,
    "paymentStatus": Expense.paymentStatus,
    "createdAt": Expense.createdAt,
}


class ExpenseRepository:
    def __init__(self, session: AsyncSession, tenant_id: str):
        if not tenant_id:
            raise ValueError("ExpenseRepository 는 tenant_id 가 필요합니다.")
        self.session = session
        self.tenant_id = tenant_id

    async def get(self, expense_id: str) -> Expense | None:
        stmt = select(Expense).where(Expense.tenantId == self.tenant_id, Expense.id == expense_id)
        return (await self.session.execute(stmt)).scalars().first()

    def _build_where(
        self,
        *,
        only_user_id: str | None,
        only_department: str | None,
        committee: str | None,
        department: str | None,
        category: str | None,
        status: str | None,
        payment_status: str | None,
        start_date: datetime | None,
        end_date: datetime | None,
        min_amount: int | None,
        max_amount: int | None,
        approved_start: datetime | None,
        approved_end: datetime | None,
        expense_start: datetime | None,
        expense_end: datetime | None,
        q: str | None,
    ):
        conditions = [Expense.tenantId == self.tenant_id]

        # 권한 스코프 — 전체조회 권한 없으면 부서 또는 본인 것만 (route.ts permissionWhere)
        if only_user_id is not None:
            conditions.append(Expense.userId == only_user_id)
        elif only_department is not None:
            conditions.append(Expense.department == only_department)

        if committee:
            conditions.append(Expense.committee == committee)
        if department:
            conditions.append(Expense.department == department)
        if category:
            conditions.append(
                select(ExpenseItem.id)
                .where(ExpenseItem.expenseId == Expense.id, ExpenseItem.budgetCategory == category)
                .exists()
            )
        if start_date:
            conditions.append(Expense.requestDate >= start_date)
        if end_date:
            conditions.append(Expense.requestDate <= end_date)
        if min_amount is not None:
            conditions.append(Expense.requestAmount >= min_amount)
        if max_amount is not None:
            conditions.append(Expense.requestAmount <= max_amount)
        if status:
            conditions.append(Expense.status == status)
        if payment_status:
            # 지급 상태 필터: 최종 승인된 항목 중 paymentStatus 일치 (레거시 동작 보존)
            conditions.append(Expense.status == "APPROVED_FINAL")
            conditions.append(Expense.paymentStatus == payment_status)
        if approved_start:
            conditions.append(Expense.approvedAt >= approved_start)
        if approved_end:
            conditions.append(Expense.approvedAt <= approved_end)
        if expense_start:
            conditions.append(Expense.expenseDate >= expense_start)
        if expense_end:
            conditions.append(Expense.expenseDate <= expense_end)
        if q and q.strip():
            like = f"%{q.strip()}%"
            conditions.append(
                or_(
                    Expense.applicantName.ilike(like),
                    Expense.committee.ilike(like),
                    Expense.department.ilike(like),
                    select(ExpenseItem.id)
                    .where(ExpenseItem.expenseId == Expense.id, ExpenseItem.budgetCategory.ilike(like))
                    .exists(),
                )
            )

        return and_(*conditions)

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
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Expense], int, int]:
        where_clause = self._build_where(
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
        )

        column = _SORTABLE_COLUMNS.get(sort_by, Expense.createdAt)
        order = column.asc() if sort_dir == "asc" else column.desc()

        list_stmt = select(Expense).where(where_clause).order_by(order).limit(limit).offset(offset)
        count_stmt = select(func.count()).select_from(Expense).where(where_clause)
        sum_stmt = select(func.coalesce(func.sum(Expense.requestAmount), 0)).where(where_clause)

        expenses = list((await self.session.execute(list_stmt)).scalars().all())
        total = (await self.session.execute(count_stmt)).scalar_one()
        total_amount = (await self.session.execute(sum_stmt)).scalar_one()
        return expenses, total, int(total_amount)

    async def list_items(self, expense_id: str) -> list[ExpenseItem]:
        stmt = (
            select(ExpenseItem)
            .where(ExpenseItem.expenseId == expense_id)
            .order_by(ExpenseItem.order)
        )
        return list((await self.session.execute(stmt)).scalars().all())
