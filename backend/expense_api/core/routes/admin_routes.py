"""관리자 대시보드/연도 설정 현황 라우터.
(app/api/admin/dashboard, app/api/admin/year-setup-status 이전)
mount prefix: /api/admin
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.budget import BudgetDetail, BudgetDetailYear, DepartmentBudgetDetail
from expense_api.core.models.expense import Expense
from expense_api.core.models.user import User, UserYearRole

router = APIRouter()


def _current_year() -> int:
    return datetime.now(timezone.utc).year


@router.get("/dashboard")
async def get_dashboard(
    year: int | None = None,
    user: CurrentUser = Depends(require_permission(PERMISSIONS.ADMIN_DASHBOARD_READ)),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    yr = year or _current_year()

    now = datetime.now(timezone.utc)
    current_month = now.month
    month_start = datetime(yr, current_month, 1)
    month_end = (
        datetime(yr, current_month + 1, 1) if current_month < 12 else datetime(yr + 1, 1, 1)
    )

    budget_row = (
        await session.execute(
            select(
                func.sum(BudgetDetailYear.budgetAmount), func.sum(BudgetDetailYear.usedAmount)
            ).where(
                BudgetDetailYear.tenantId == tenant_id,
                BudgetDetailYear.year == yr,
                BudgetDetailYear.isActive.is_(True),
            )
        )
    ).one()
    total_budget = budget_row[0] or 0
    total_used = budget_row[1] or 0
    execution_rate = round(total_used / total_budget * 1000) / 10 if total_budget > 0 else 0

    pending_approvals = (
        await session.execute(
            select(func.count(Expense.id)).where(
                Expense.tenantId == tenant_id,
                Expense.status.in_(["PENDING", "APPROVED_STEP_1", "APPROVED_STEP_2"]),
            )
        )
    ).scalar_one()

    monthly_expense = (
        await session.execute(
            select(func.sum(Expense.requestAmount)).where(
                Expense.tenantId == tenant_id,
                Expense.status == "APPROVED_FINAL",
                Expense.requestDate >= month_start,
                Expense.requestDate < month_end,
            )
        )
    ).scalar_one() or 0

    pending_payments = (
        await session.execute(
            select(func.count(Expense.id)).where(
                Expense.tenantId == tenant_id,
                Expense.status == "APPROVED_FINAL",
                Expense.paymentStatus != "COMPLETED",
            )
        )
    ).scalar_one()

    recent_expenses = (
        (
            await session.execute(
                select(Expense)
                .where(Expense.tenantId == tenant_id, Expense.status != "DRAFT")
                .order_by(Expense.createdAt.desc())
                .limit(5)
            )
        )
        .scalars()
        .all()
    )

    yearly_row = (
        await session.execute(
            select(func.sum(Expense.requestAmount), func.count(Expense.id)).where(
                Expense.tenantId == tenant_id,
                Expense.status == "APPROVED_FINAL",
                Expense.requestDate >= datetime(yr, 1, 1),
                Expense.requestDate < datetime(yr + 1, 1, 1),
            )
        )
    ).one()

    return {
        "year": yr,
        "kpi": {
            "executionRate": execution_rate,
            "totalBudget": total_budget,
            "totalUsed": total_used,
            "pendingApprovals": pending_approvals,
            "monthlyExpense": monthly_expense,
            "pendingPayments": pending_payments,
        },
        "yearly": {
            "totalExpense": yearly_row[0] or 0,
            "expenseCount": yearly_row[1] or 0,
        },
        "recentExpenses": [
            {
                "id": e.id,
                "applicantName": e.applicantName,
                "requestAmount": e.requestAmount,
                "status": e.status,
                "requestDate": e.requestDate,
                "department": e.department,
                "committee": e.committee,
                "createdAt": e.createdAt,
            }
            for e in recent_expenses
        ],
    }


@router.get("/year-setup-status")
async def get_year_setup_status(
    year: int | None = None,
    user: CurrentUser = Depends(require_permission(PERMISSIONS.ADMIN_DASHBOARD_READ)),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    yr = year or _current_year()

    total_active_users = (
        await session.execute(
            select(func.count(User.id)).where(User.tenantId == tenant_id, User.isActive.is_(True))
        )
    ).scalar_one()

    users_with_role = (
        await session.execute(
            select(func.count(func.distinct(UserYearRole.userId)))
            .join(User, User.id == UserYearRole.userId)
            .where(
                UserYearRole.tenantId == tenant_id,
                UserYearRole.year == yr,
                User.isActive.is_(True),
            )
        )
    ).scalar_one()

    role_breakdown_rows = (
        await session.execute(
            select(UserYearRole.role, func.count(UserYearRole.id))
            .join(User, User.id == UserYearRole.userId)
            .where(
                UserYearRole.tenantId == tenant_id,
                UserYearRole.year == yr,
                User.isActive.is_(True),
            )
            .group_by(UserYearRole.role)
        )
    ).all()

    total_budget_details = (
        await session.execute(
            select(func.count(DepartmentBudgetDetail.id))
            .join(BudgetDetail, BudgetDetail.id == DepartmentBudgetDetail.budgetDetailId)
            .where(
                DepartmentBudgetDetail.tenantId == tenant_id,
                DepartmentBudgetDetail.isActive.is_(True),
                BudgetDetail.isActive.is_(True),
            )
        )
    ).scalar_one()

    details_with_manager = (
        await session.execute(
            select(func.count(BudgetDetailYear.id))
            .join(BudgetDetail, BudgetDetail.id == BudgetDetailYear.budgetDetailId)
            .where(
                BudgetDetailYear.tenantId == tenant_id,
                BudgetDetailYear.year == yr,
                BudgetDetailYear.managerId.is_not(None),
                BudgetDetail.isActive.is_(True),
            )
        )
    ).scalar_one()

    details_with_budget = (
        await session.execute(
            select(func.count(BudgetDetailYear.id))
            .join(BudgetDetail, BudgetDetail.id == BudgetDetailYear.budgetDetailId)
            .where(
                BudgetDetailYear.tenantId == tenant_id,
                BudgetDetailYear.year == yr,
                BudgetDetailYear.budgetAmount > 0,
                BudgetDetail.isActive.is_(True),
            )
        )
    ).scalar_one()

    budget_sum = (
        await session.execute(
            select(func.sum(BudgetDetailYear.budgetAmount))
            .join(BudgetDetail, BudgetDetail.id == BudgetDetailYear.budgetDetailId)
            .where(
                BudgetDetailYear.tenantId == tenant_id,
                BudgetDetailYear.year == yr,
                BudgetDetail.isActive.is_(True),
            )
        )
    ).scalar_one() or 0

    manager_year_exists = exists(
        select(BudgetDetailYear.id).where(
            BudgetDetailYear.budgetDetailId == BudgetDetail.id,
            BudgetDetailYear.year == yr,
            BudgetDetailYear.managerId.is_not(None),
        )
    )
    missing_managers_rows = (
        await session.execute(
            select(DepartmentBudgetDetail, BudgetDetail)
            .join(BudgetDetail, BudgetDetail.id == DepartmentBudgetDetail.budgetDetailId)
            .where(
                DepartmentBudgetDetail.tenantId == tenant_id,
                DepartmentBudgetDetail.isActive.is_(True),
                BudgetDetail.isActive.is_(True),
                ~manager_year_exists,
            )
            .limit(10)
        )
    ).all()

    budget_year_exists = exists(
        select(BudgetDetailYear.id).where(
            BudgetDetailYear.budgetDetailId == BudgetDetail.id,
            BudgetDetailYear.year == yr,
            BudgetDetailYear.budgetAmount > 0,
        )
    )
    missing_budgets_rows = (
        await session.execute(
            select(DepartmentBudgetDetail, BudgetDetail)
            .join(BudgetDetail, BudgetDetail.id == DepartmentBudgetDetail.budgetDetailId)
            .where(
                DepartmentBudgetDetail.tenantId == tenant_id,
                DepartmentBudgetDetail.isActive.is_(True),
                BudgetDetail.isActive.is_(True),
                ~budget_year_exists,
            )
            .limit(10)
        )
    ).all()

    missing_managers = await _to_missing_detail_dtos(session, missing_managers_rows)
    missing_budgets = await _to_missing_detail_dtos(session, missing_budgets_rows)

    role_year_exists = exists(
        select(UserYearRole.id).where(
            UserYearRole.userId == User.id,
            UserYearRole.year == yr,
        )
    )
    missing_roles_rows = (
        await session.execute(
            select(User)
            .where(User.tenantId == tenant_id, User.isActive.is_(True), ~role_year_exists)
            .limit(10)
        )
    ).scalars().all()

    return {
        "year": yr,
        "summary": {
            "roleSetup": {
                "total": total_active_users,
                "completed": users_with_role,
                "rate": round(users_with_role / total_active_users * 100)
                if total_active_users > 0
                else 0,
                "breakdown": [{"role": role, "count": count} for role, count in role_breakdown_rows],
            },
            "managerAssignment": {
                "total": total_budget_details,
                "completed": details_with_manager,
                "rate": round(details_with_manager / total_budget_details * 100)
                if total_budget_details > 0
                else 0,
            },
            "budgetInput": {
                "total": total_budget_details,
                "completed": details_with_budget,
                "rate": round(details_with_budget / total_budget_details * 100)
                if total_budget_details > 0
                else 0,
                "totalAmount": budget_sum,
            },
        },
        "missing": {
            "roles": [{"id": u.id, "username": u.username, "userid": u.userid} for u in missing_roles_rows],
            "managers": missing_managers,
            "budgets": missing_budgets,
        },
    }


async def _to_missing_detail_dtos(
    session: AsyncSession, rows: list
) -> list[dict]:
    """DepartmentBudgetDetail+BudgetDetail 조인 결과 → committee/department/category/subcategory 라벨 부착."""
    from expense_api.core.models.budget import BudgetCategory, BudgetSubcategory, Committee, Department

    out: list[dict] = []
    for dept_detail, detail in rows:
        dept = await session.get(Department, dept_detail.departmentId)
        committee = await session.get(Committee, dept.committeeId) if dept else None
        subcategory = await session.get(BudgetSubcategory, detail.subcategoryId)
        category = await session.get(BudgetCategory, subcategory.categoryId) if subcategory else None
        out.append(
            {
                "id": detail.id,
                "name": detail.name,
                "committee": committee.name if committee else None,
                "department": dept.name if dept else None,
                "category": category.name if category else None,
                "subcategory": subcategory.name if subcategory else None,
            }
        )
    return out
