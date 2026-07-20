"""테넌트 설정(theme/notifications/expense/approval/security) 스키마.
(app/api/platform/tenants/[id]/settings/route.ts 의 로컬 tenantSettingsSchema 이전)
"""

import re

from pydantic import BaseModel

_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

DEFAULT_SETTINGS: dict = {
    "theme": {
        "primaryColor": "#4f46e5",
        "accentColor": "#6366f1",
        "logoPosition": "left",
        "darkModeEnabled": False,
    },
    "notifications": {
        "emailEnabled": True,
        "emailOnNewExpense": True,
        "emailOnApproval": True,
        "emailOnRejection": True,
        "pushEnabled": True,
        "pushOnNewExpense": True,
        "pushOnApproval": True,
    },
    "expense": {
        "requireAttachment": False,
        "requireDescription": True,
        "allowDraftSave": True,
        "maxItemsPerExpense": 20,
        "defaultCurrency": "KRW",
    },
    "approval": {
        "autoApproveUnderAmount": 0,
        "requireAllApprovers": True,
        "allowSelfApproval": False,
    },
    "security": {
        "sessionTimeoutMinutes": 60,
        "requirePasswordChange": False,
        "passwordChangeIntervalDays": 90,
        "twoFactorEnabled": False,
    },
}


class TenantSettingsBody(BaseModel):
    theme: dict | None = None
    notifications: dict | None = None
    expense: dict | None = None
    approval: dict | None = None
    security: dict | None = None


def validate_tenant_settings(body: TenantSettingsBody) -> dict:
    """tenantSettingsSchema.parse() 등가 — 위반 시 ValueError(한국어 메시지)."""
    result: dict = {}

    if body.theme is not None:
        theme = dict(body.theme)
        for key in ("primaryColor", "accentColor"):
            if key in theme and theme[key] is not None and not _HEX_COLOR_RE.match(theme[key]):
                raise ValueError(f"{key} 는 #RRGGBB 형식이어야 합니다")
        if "logoPosition" in theme and theme["logoPosition"] not in (None, "left", "center"):
            raise ValueError("logoPosition 은 left 또는 center 여야 합니다")
        result["theme"] = theme

    if body.notifications is not None:
        result["notifications"] = dict(body.notifications)

    if body.expense is not None:
        expense = dict(body.expense)
        max_items = expense.get("maxItemsPerExpense")
        if max_items is not None and not (1 <= max_items <= 50):
            raise ValueError("maxItemsPerExpense 는 1~50 사이여야 합니다")
        result["expense"] = expense

    if body.approval is not None:
        approval = dict(body.approval)
        auto_approve = approval.get("autoApproveUnderAmount")
        if auto_approve is not None and auto_approve < 0:
            raise ValueError("autoApproveUnderAmount 는 0 이상이어야 합니다")
        result["approval"] = approval

    if body.security is not None:
        security = dict(body.security)
        timeout = security.get("sessionTimeoutMinutes")
        if timeout is not None and not (5 <= timeout <= 1440):
            raise ValueError("sessionTimeoutMinutes 는 5~1440 사이여야 합니다")
        interval = security.get("passwordChangeIntervalDays")
        if interval is not None and not (0 <= interval <= 365):
            raise ValueError("passwordChangeIntervalDays 는 0~365 사이여야 합니다")
        result["security"] = security

    return result


def merge_deep(target: dict, source: dict) -> dict:
    """mergeDeep() 이전 — source 의 각 최상위 섹션을 target 위에 얕게 병합(섹션 내부는 깊게)."""
    output = dict(target)
    for key, source_value in source.items():
        target_value = output.get(key)
        if (
            isinstance(source_value, dict)
            and isinstance(target_value, dict)
        ):
            output[key] = merge_deep(target_value, source_value)
        elif source_value is not None:
            output[key] = source_value
    return output
