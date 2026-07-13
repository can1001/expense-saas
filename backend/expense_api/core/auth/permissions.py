"""RBAC 권한 레지스트리 — lib/auth/permissions.ts 포팅 (단일 출처).

"어떤 권한이 존재하는가"는 PERMISSIONS 카탈로그에서만 정의한다.
"역할이 어떤 권한을 갖는가"의 기본값(seed/fallback)은 ROLE_PERMISSION_PRESETS,
런타임 정본은 DB Role.permissions(테넌트별)이다.
(참조: spec_rbac_refactoring.md, 프론트 lib/auth/permissions.ts 와 값 동일)
"""

from collections.abc import Callable, Iterable

# ── 역할 코드 (단일 출처) ──────────────────────────────────────────────
ROLE_CODES: list[str] = [
    "admin",
    "finance_head",
    "accountant",
    "finance_member",
    "team_leader",
    "admin_assistant",
    "user",
]

YEAR_ROLE_CODES: list[str] = [r for r in ROLE_CODES if r not in ("admin", "user")]
PROTECTED_SYSTEM_ROLE_CODES: list[str] = ["admin", "user"]

ROLE_NAMES: dict[str, str] = {
    "admin": "관리자",
    "finance_head": "재정팀장",
    "accountant": "회계",
    "finance_member": "재정팀원",
    "team_leader": "팀장",
    "admin_assistant": "행정간사",
    "user": "사용자",
}


def is_role_code(value: str) -> bool:
    return value in ROLE_CODES


def is_protected_system_role(code: str) -> bool:
    return code in PROTECTED_SYSTEM_ROLE_CODES


# ── 권한 카탈로그 (resource:action[.scope]) ────────────────────────────
class PERMISSIONS:
    EXPENSE_READ_OWN = "expense:read.own"
    EXPENSE_READ_DEPARTMENT = "expense:read.department"
    EXPENSE_READ_ALL = "expense:read.all"
    EXPENSE_CREATE = "expense:create"
    EXPENSE_APPROVE = "expense:approve"
    EXPENSE_EDIT_APPROVED = "expense:edit_approved"
    EXPENSE_PAYMENT_MANAGE = "expense:payment_manage"
    EXPENSE_BULK_UPLOAD = "expense:bulk_upload"
    EXPENSE_EXPORT = "expense:export"
    SIMPLE_EXPENSE_USE = "simple_expense:use"
    RECURRING_READ = "recurring:read"
    RECURRING_MANAGE_ALL = "recurring:manage_all"
    ADMIN_DASHBOARD_READ = "admin:dashboard.read"
    REPORT_BUDGET_EXEC_READ = "report:budget_execution.read"
    REPORT_HR_ADMIN_READ = "report:hr_admin.read"
    REPORT_QUARTERLY_READ = "report:quarterly.read"
    REPORT_CUMULATIVE_READ = "report:cumulative.read"
    REPORT_FINANCIAL_READ = "report:financial.read"
    REPORT_EXPORT = "report:export"
    COMMITTEE_MANAGE = "committee:manage"
    DEPARTMENT_MANAGE = "department:manage"
    BUDGET_MANAGER_MANAGE = "budget_manager:manage"
    BUDGET_MASTER_MANAGE = "budget_master:manage"
    BUDGET_VIEW = "budget:view"
    OFFERING_MANAGE = "offering:manage"
    USER_READ = "user:read"
    USER_REGISTER = "user:register"
    USER_MANAGE = "user:manage"
    ROLE_MANAGE = "role:manage"
    SETTINGS_MANAGE = "settings:manage"
    NOTIFICATION_SEND = "notification:send"
    YOUTH_MANAGE = "youth:manage"


ALL_PERMISSIONS: list[str] = [
    v for k, v in vars(PERMISSIONS).items() if not k.startswith("_") and isinstance(v, str)
]


def is_permission(value: str) -> bool:
    return value in ALL_PERMISSIONS


def sanitize_permissions(input_: object) -> list[str]:
    """유효한 permission 코드만 남겨 정규화(중복 제거). 비배열이면 빈 리스트."""
    if not isinstance(input_, (list, tuple)):
        return []
    seen: dict[str, None] = {}
    for v in input_:
        if isinstance(v, str) and is_permission(v):
            seen[v] = None
    return list(seen.keys())


# ── 역할별 기본 프리셋 (seed/fallback 전용, 런타임 정본은 DB) ─────────────
_P = PERMISSIONS

_MANAGEMENT_PERMS: list[str] = [
    _P.SIMPLE_EXPENSE_USE,
    _P.RECURRING_READ,
    _P.RECURRING_MANAGE_ALL,
    _P.ADMIN_DASHBOARD_READ,
    _P.REPORT_BUDGET_EXEC_READ,
    _P.REPORT_HR_ADMIN_READ,
    _P.REPORT_QUARTERLY_READ,
    _P.REPORT_CUMULATIVE_READ,
    _P.REPORT_FINANCIAL_READ,
    _P.OFFERING_MANAGE,
    _P.COMMITTEE_MANAGE,
    _P.DEPARTMENT_MANAGE,
    _P.BUDGET_MANAGER_MANAGE,
    _P.BUDGET_VIEW,
]

ROLE_PERMISSION_PRESETS: dict[str, list[str]] = {
    "admin": list(ALL_PERMISSIONS),
    "finance_head": [
        _P.EXPENSE_READ_OWN,
        _P.EXPENSE_READ_DEPARTMENT,
        _P.EXPENSE_READ_ALL,
        _P.EXPENSE_CREATE,
        _P.EXPENSE_APPROVE,
        _P.EXPENSE_EDIT_APPROVED,
        _P.EXPENSE_PAYMENT_MANAGE,
        _P.EXPENSE_EXPORT,
        _P.REPORT_EXPORT,
        _P.NOTIFICATION_SEND,
        _P.YOUTH_MANAGE,
        _P.BUDGET_MASTER_MANAGE,
        *_MANAGEMENT_PERMS,
    ],
    "accountant": [
        _P.EXPENSE_READ_OWN,
        _P.EXPENSE_READ_DEPARTMENT,
        _P.EXPENSE_READ_ALL,
        _P.EXPENSE_CREATE,
        _P.EXPENSE_APPROVE,
        _P.EXPENSE_EDIT_APPROVED,
        _P.EXPENSE_PAYMENT_MANAGE,
        _P.REPORT_EXPORT,
        _P.NOTIFICATION_SEND,
        _P.YOUTH_MANAGE,
        *_MANAGEMENT_PERMS,
    ],
    "finance_member": [
        _P.EXPENSE_READ_OWN,
        _P.EXPENSE_READ_DEPARTMENT,
        _P.EXPENSE_READ_ALL,
        _P.EXPENSE_CREATE,
        _P.REPORT_EXPORT,
        *_MANAGEMENT_PERMS,
    ],
    "team_leader": [
        _P.EXPENSE_READ_OWN,
        _P.EXPENSE_READ_DEPARTMENT,
        _P.EXPENSE_CREATE,
        _P.EXPENSE_APPROVE,
        _P.YOUTH_MANAGE,
    ],
    "admin_assistant": [
        _P.EXPENSE_READ_OWN,
        _P.EXPENSE_READ_ALL,
        _P.EXPENSE_CREATE,
        _P.EXPENSE_EDIT_APPROVED,
        _P.EXPENSE_PAYMENT_MANAGE,
        _P.EXPENSE_BULK_UPLOAD,
        _P.NOTIFICATION_SEND,
        *_MANAGEMENT_PERMS,
    ],
    "user": [_P.EXPENSE_READ_OWN, _P.EXPENSE_CREATE],
}


def individual_flag_permissions(*, can_register_users: bool = False) -> list[str]:
    """개별 사용자 플래그 → permission 매핑 (User.canRegisterUsers 등)."""
    perms: list[str] = []
    if can_register_users:
        perms.append(_P.USER_REGISTER)
    return perms


# ── 권한 해석(resolve) + 판정(has_permission) ──────────────────────────
# 역할 코드 → permission 목록을 반환하는 resolver 타입
RolePermissionResolver = Callable[[str], Iterable[str]]


def preset_resolver(role_code: str) -> list[str]:
    """기본 resolver: 코드 프리셋 사용."""
    return ROLE_PERMISSION_PRESETS.get(role_code, []) if is_role_code(role_code) else []


def make_db_resolver(role_permissions_by_code: dict[str, list[str]]) -> RolePermissionResolver:
    """DB Role.permissions 기반 resolver. 특정 역할의 목록이 비어 있으면 프리셋으로 폴백.

    (프론트 role-permission-cache 의 "비면 프리셋 폴백" 동작을 이전)
    """

    def _resolve(role_code: str) -> list[str]:
        perms = role_permissions_by_code.get(role_code)
        if perms:  # 비어있지 않으면 DB 정본 사용
            return perms
        return preset_resolver(role_code)  # 폴백

    return _resolve


def resolve_permissions(
    roles: Iterable[str],
    *,
    resolver: RolePermissionResolver | None = None,
    granted: Iterable[str] | None = None,
    revoked: Iterable[str] | None = None,
) -> set[str]:
    """유효 역할 목록으로부터 effective permission 집합 계산 (합집합 − revoked + granted)."""
    resolve = resolver or preset_resolver
    result: set[str] = set()
    for role in roles:
        for perm in resolve(role):
            if is_permission(perm):
                result.add(perm)
    for perm in granted or []:
        if is_permission(perm):
            result.add(perm)
    for perm in revoked or []:
        result.discard(perm)
    return result


def has_permission(
    roles: Iterable[str],
    permission: str,
    *,
    resolver: RolePermissionResolver | None = None,
    granted: Iterable[str] | None = None,
) -> bool:
    """단일 권한 보유 여부 — 인가 판정 단일 진입점."""
    perms = resolve_permissions(roles, resolver=resolver, granted=granted)
    return permission in perms


def has_any_permission(
    roles: Iterable[str],
    permissions: Iterable[str],
    *,
    resolver: RolePermissionResolver | None = None,
    granted: Iterable[str] | None = None,
) -> bool:
    perms = resolve_permissions(roles, resolver=resolver, granted=granted)
    return any(p in perms for p in permissions)


def has_all_permissions(
    roles: Iterable[str],
    permissions: Iterable[str],
    *,
    resolver: RolePermissionResolver | None = None,
    granted: Iterable[str] | None = None,
) -> bool:
    perms = resolve_permissions(roles, resolver=resolver, granted=granted)
    return all(p in perms for p in permissions)


def derive_legacy_flags(roles: Iterable[str], granted: Iterable[str] | None = None) -> dict[str, bool]:
    """유효 역할 + 개별 부여 권한으로부터 레거시 불리언 플래그를 파생.

    (프론트 deriveLegacyFlags 이전 — 하위호환 표시값. 가드는 has_permission 직접 사용)
    """
    roles = list(roles)
    granted_list = list(granted or [])

    def _has(p: str) -> bool:
        return has_permission(roles, p) or p in granted_list

    return {
        "canApprove": _has(_P.EXPENSE_APPROVE),
        "canManageExpense": _has(_P.EXPENSE_PAYMENT_MANAGE),
        "canAccessAdmin": _has(_P.ADMIN_DASHBOARD_READ),
        "canExportData": _has(_P.EXPENSE_EXPORT),
        "canRegisterUsers": _has(_P.USER_REGISTER),
    }
