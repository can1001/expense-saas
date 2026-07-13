"""지출결의서 리포지토리 (tenant-scoped)."""

from __future__ import annotations  # list 메서드가 builtin list 애노테이션을 가리는 문제 방지

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.expense import Expense, ExpenseItem


class ExpenseRepository:
    def __init__(self, session: AsyncSession, tenant_id: str):
        if not tenant_id:
            raise ValueError("ExpenseRepository 는 tenant_id 가 필요합니다.")
        self.session = session
        self.tenant_id = tenant_id

    async def get(self, expense_id: str) -> Expense | None:
        stmt = select(Expense).where(Expense.tenantId == self.tenant_id, Expense.id == expense_id)
        return (await self.session.execute(stmt)).scalars().first()

    async def list(
        self, *, only_user_id: str | None = None, limit: int = 100, offset: int = 0
    ) -> list[Expense]:
        stmt = select(Expense).where(Expense.tenantId == self.tenant_id)
        if only_user_id is not None:
            stmt = stmt.where(Expense.userId == only_user_id)
        stmt = stmt.order_by(Expense.createdAt.desc()).limit(limit).offset(offset)
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_items(self, expense_id: str) -> list[ExpenseItem]:
        stmt = (
            select(ExpenseItem)
            .where(ExpenseItem.expenseId == expense_id)
            .order_by(ExpenseItem.order)
        )
        return list((await self.session.execute(stmt)).scalars().all())
