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
from expense_api.core.models.approval import (  # noqa: F401
    ApprovalLine,
    ApprovalLog,
    ApprovalStep,
)
from expense_api.core.models.approval_policy import ApprovalPolicy  # noqa: F401
from expense_api.core.models.expense import (  # noqa: F401
    Expense,
    ExpenseAttachment,
    ExpenseItem,
)
from expense_api.core.models.misc import ExpenseTemplate, SavedBankAccount  # noqa: F401
from expense_api.core.models.notification import (  # noqa: F401
    AdminNotification,
    FcmLog,
    FcmToken,
    NotificationLog,
    NotificationPreference,
    PushSubscription,
)
from expense_api.core.models.offering import Offering  # noqa: F401
from expense_api.core.models.provisioning import (  # noqa: F401
    AccountCategory,
    AccountCategoryTemplate,
    ApprovalLineTemplate,
    ApprovalStepTemplate,
)
from expense_api.core.models.recurring_expense import RecurringExpense  # noqa: F401
from expense_api.core.models.schema_info import SchemaInfo  # noqa: F401
from expense_api.core.models.system_setting import SystemSetting  # noqa: F401
from expense_api.core.models.tenant import (  # noqa: F401
    PlatformActivityLog,
    SuperAdmin,
    Tenant,
)
from expense_api.core.models.user import (  # noqa: F401
    Membership,
    Role,
    User,
    UserSignature,
    UserYearRole,
)
from expense_api.core.models.youth_night import (  # noqa: F401
    Attendance,
    Curriculum,
    Lesson,
    Question,
    QuizResponse,
    RecitationSubmission,
    StudentPoints,
)

__all__ = [
    "SchemaInfo",
    "Tenant",
    "SuperAdmin",
    "Role",
    "User",
    "Membership",
    "UserSignature",
    "UserYearRole",
    "Committee",
    "Department",
    "BudgetCategory",
    "BudgetSubcategory",
    "BudgetDetail",
    "BudgetDetailYear",
    "DepartmentBudgetDetail",
    "Expense",
    "ExpenseItem",
    "ExpenseAttachment",
    "ApprovalLine",
    "ApprovalStep",
    "ApprovalLog",
    "ApprovalPolicy",
    "NotificationPreference",
    "NotificationLog",
    "PushSubscription",
    "FcmToken",
    "FcmLog",
    "ExpenseTemplate",
    "SavedBankAccount",
    "RecurringExpense",
    "SystemSetting",
    "Offering",
    "AccountCategoryTemplate",
    "AccountCategory",
    "ApprovalLineTemplate",
    "ApprovalStepTemplate",
    "PlatformActivityLog",
    "Curriculum",
    "Lesson",
    "Question",
    "Attendance",
    "QuizResponse",
    "StudentPoints",
    "RecitationSubmission",
]
