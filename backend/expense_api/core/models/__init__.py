"""SQLModel 모델 레지스트리.

Alembic env.py 가 target_metadata 를 채우려면 모든 모델이 여기서 import 되어야 한다.
Phase 1+ 에서 도메인 모델을 추가할 때마다 이곳에 등록한다.
"""

from expense_api.core.models.budget import (  # noqa: F401
    BudgetCategory,
    BudgetDetail,
    BudgetDetailYear,
    BudgetSubcategory,
    Committee,
    Department,
    DepartmentBudgetDetail,
)
from expense_api.core.models.schema_info import SchemaInfo  # noqa: F401
from expense_api.core.models.tenant import SuperAdmin, Tenant  # noqa: F401
from expense_api.core.models.user import Role, User, UserYearRole  # noqa: F401

__all__ = [
    "SchemaInfo",
    "Tenant",
    "SuperAdmin",
    "Role",
    "User",
    "UserYearRole",
    "Committee",
    "Department",
    "BudgetCategory",
    "BudgetSubcategory",
    "BudgetDetail",
    "BudgetDetailYear",
    "DepartmentBudgetDetail",
]
