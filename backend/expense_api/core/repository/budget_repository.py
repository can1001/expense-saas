"""예산 계층 리포지토리 (tenant-scoped)."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetSubcategory,
    Committee,
    Department,
    DepartmentBudgetDetail,
)


@dataclass
class LinkedDetailRow:
    """부서에 연결된 세목 1건의 항/목/세목 정보 (활성 여부 포함)."""

    category_name: str
    category_active: bool
    subcategory_name: str
    subcategory_active: bool
    detail_name: str
    detail_active: bool


class BudgetRepository:
    def __init__(self, session: AsyncSession, tenant_id: str):
        if not tenant_id:
            raise ValueError("BudgetRepository 는 tenant_id 가 필요합니다.")
        self.session = session
        self.tenant_id = tenant_id

    # ── 위원회 / 부서 ────────────────────────────────────────────────
    async def list_committees(self, *, active_only: bool = True) -> list[Committee]:
        stmt = select(Committee).where(Committee.tenantId == self.tenant_id)
        if active_only:
            stmt = stmt.where(Committee.isActive == True)  # noqa: E712
        stmt = stmt.order_by(Committee.sortOrder)
        return list((await self.session.execute(stmt)).scalars().all())

    async def get_committee_by_name(
        self, name: str, *, active_only: bool = True
    ) -> Committee | None:
        stmt = select(Committee).where(Committee.tenantId == self.tenant_id, Committee.name == name)
        if active_only:
            stmt = stmt.where(Committee.isActive == True)  # noqa: E712
        return (await self.session.execute(stmt)).scalars().first()

    async def list_departments(
        self, *, committee_id: str | None = None, active_only: bool = True
    ) -> list[Department]:
        stmt = select(Department).where(Department.tenantId == self.tenant_id)
        if committee_id is not None:
            stmt = stmt.where(Department.committeeId == committee_id)
        if active_only:
            stmt = stmt.where(Department.isActive == True)  # noqa: E712
        stmt = stmt.order_by(Department.sortOrder)
        return list((await self.session.execute(stmt)).scalars().all())

    async def get_department_by_name(self, name: str) -> Department | None:
        # 원본(TS)은 부서 조회 시 isActive 필터를 걸지 않는다 — 동작 보존
        stmt = select(Department).where(
            Department.tenantId == self.tenant_id, Department.name == name
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def list_departments_with_committee(self) -> list[tuple[str, str]]:
        """(위원회명, 부서명) 매핑 — GET /api/budget 의 items."""
        stmt = (
            select(Committee.name, Department.name)
            .join(Department, Department.committeeId == Committee.id)
            .where(Department.tenantId == self.tenant_id, Department.isActive == True)  # noqa: E712
            .order_by(Department.sortOrder)
        )
        return [(row[0], row[1]) for row in (await self.session.execute(stmt)).all()]

    # ── 부서-세목 링크 조인 (캐스케이드의 핵심) ────────────────────────
    async def linked_detail_rows(self, department_id: str) -> list[LinkedDetailRow]:
        """부서에 연결된(DepartmentBudgetDetail) 활성 세목들의 항/목/세목 정보."""
        stmt = (
            select(
                BudgetCategory.name,
                BudgetCategory.isActive,
                BudgetSubcategory.name,
                BudgetSubcategory.isActive,
                BudgetDetail.name,
                BudgetDetail.isActive,
            )
            .select_from(DepartmentBudgetDetail)
            .join(BudgetDetail, DepartmentBudgetDetail.budgetDetailId == BudgetDetail.id)
            .join(BudgetSubcategory, BudgetDetail.subcategoryId == BudgetSubcategory.id)
            .join(BudgetCategory, BudgetSubcategory.categoryId == BudgetCategory.id)
            .where(
                DepartmentBudgetDetail.tenantId == self.tenant_id,
                DepartmentBudgetDetail.departmentId == department_id,
                DepartmentBudgetDetail.isActive == True,  # noqa: E712
            )
        )
        rows = (await self.session.execute(stmt)).all()
        return [LinkedDetailRow(*r) for r in rows]
