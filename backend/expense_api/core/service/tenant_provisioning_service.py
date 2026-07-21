"""테넌트 프로비저닝 서비스.
(lib/services/provision-tenant.ts + lib/tenant/seed-default-data.ts +
lib/tenant/default-chart-of-accounts.ts 이전, app/api/platform/tenants POST 전용)

Prisma `$transaction` 과 달리 명시적 트랜잭션 객체가 없다 — 요청 스코프
AsyncSession 에 flush 만 하고, 라우트가 마지막에 한 번 commit 한다. 예외가
나면 세션이 커밋 없이 닫히며 flush 된 변경도 함께 롤백되어 동일한 원자성을 낸다.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import ROLE_PERMISSION_PRESETS
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetSubcategory,
    Committee,
    Department,
)
from expense_api.core.models.ids import utcnow
from expense_api.core.models.provisioning import (
    AccountCategory,
    AccountCategoryTemplate,
    ApprovalLineTemplate,
    ApprovalStepTemplate,
)
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import Membership, Role, User
from expense_api.core.security.jwt import hash_password

_CHART_OF_ACCOUNTS_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "default_chart_of_accounts.json"
)
_DEFAULT_CHART_OF_ACCOUNTS: dict = json.loads(_CHART_OF_ACCOUNTS_PATH.read_text(encoding="utf-8"))

PLAN_LIMITS: dict[str, dict[str, int]] = {
    "FREE": {"maxUsers": 10, "maxStorageMB": 1024},
    "BASIC": {"maxUsers": 50, "maxStorageMB": 10240},
    "PRO": {"maxUsers": 200, "maxStorageMB": 51200},
    "ENTERPRISE": {"maxUsers": 999999, "maxStorageMB": 999999999},
}

_DEPARTMENT_TERM_BY_ORG_TYPE = {"CHURCH": "사역팀", "COMPANY": "팀"}

DEFAULT_ROLES: list[dict] = [
    {"code": "admin", "name": "관리자", "description": "시스템 전체 관리 권한", "sortOrder": 0},
    {
        "code": "finance_head", "name": "재정팀장", "description": "재정 관리 및 최종 결재 권한",
        "stepNumber": 3, "sortOrder": 1,
    },
    {
        "code": "accountant", "name": "회계", "description": "회계 처리 및 2차 결재 권한",
        "stepNumber": 2, "sortOrder": 2,
    },
    {
        "code": "team_leader", "name": "팀장", "description": "팀 관리 및 1차 결재 권한",
        "stepNumber": 1, "sortOrder": 3,
    },
    {"code": "user", "name": "사용자", "description": "일반 사용자 (지출결의서 작성)", "sortOrder": 4},
]


def default_settings_for_org_type(org_type: str) -> dict:
    """orgType 별 기본 settings (lib/tenant/settings.ts defaultSettingsForOrgType 이전)."""
    is_church = org_type == "CHURCH"
    is_company = org_type == "COMPANY"
    return {
        "labels": {
            "department": _DEPARTMENT_TERM_BY_ORG_TYPE.get(org_type, "부서"),
            "position": "직분" if is_church else "직급",
            "budget": "예산(회계연도)",
        },
        "features": {
            "incomeModule": is_church,
            "budgetModule": True,
            "vat": is_company,
            "taxInvoice": is_company,
            "offeringLink": is_church,
        },
    }


@dataclass
class SeedDefaultDataResult:
    committeesCreated: int = 0
    departmentsCreated: int = 0
    budgetCategoriesCreated: int = 0
    budgetSubcategoriesCreated: int = 0
    budgetDetailsCreated: int = 0


async def seed_default_data(
    session: AsyncSession, tenant_id: str, org_type: str
) -> SeedDefaultDataResult:
    """orgType 기본 위원회/부서/예산 5단계 시딩. (lib/tenant/seed-default-data.ts)"""
    data = _DEFAULT_CHART_OF_ACCOUNTS[org_type]
    result = SeedDefaultDataResult()

    for committee_data in data["committees"]:
        committee = Committee(
            tenantId=tenant_id,
            name=committee_data["name"],
            sortOrder=committee_data["sortOrder"],
            isActive=True,
        )
        session.add(committee)
        await session.flush()
        result.committeesCreated += 1

        for dept_data in committee_data["departments"]:
            session.add(
                Department(
                    tenantId=tenant_id,
                    committeeId=committee.id,
                    name=dept_data["name"],
                    sortOrder=dept_data["sortOrder"],
                    isActive=True,
                )
            )
            result.departmentsCreated += 1
    await session.flush()

    for category_data in data["budgetCategories"]:
        category = BudgetCategory(
            tenantId=tenant_id,
            name=category_data["name"],
            sortOrder=category_data["sortOrder"],
            isActive=True,
        )
        session.add(category)
        await session.flush()
        result.budgetCategoriesCreated += 1

        for subcategory_data in category_data["subcategories"]:
            subcategory = BudgetSubcategory(
                tenantId=tenant_id,
                categoryId=category.id,
                name=subcategory_data["name"],
                sortOrder=subcategory_data["sortOrder"],
                isActive=True,
            )
            session.add(subcategory)
            await session.flush()
            result.budgetSubcategoriesCreated += 1

            for detail_data in subcategory_data["details"]:
                session.add(
                    BudgetDetail(
                        tenantId=tenant_id,
                        subcategoryId=subcategory.id,
                        name=detail_data["name"],
                        accountCode=detail_data.get("accountCode"),
                        description=detail_data.get("description"),
                        sortOrder=detail_data["sortOrder"],
                        isActive=True,
                    )
                )
                result.budgetDetailsCreated += 1

    await session.flush()
    return result


async def create_default_roles(session: AsyncSession, tenant_id: str) -> None:
    """permission 프리셋 기반 기본 역할 5종 생성."""
    for r in DEFAULT_ROLES:
        session.add(
            Role(
                tenantId=tenant_id,
                code=r["code"],
                name=r["name"],
                description=r["description"],
                stepNumber=r.get("stepNumber"),
                sortOrder=r["sortOrder"],
                permissions=list(ROLE_PERMISSION_PRESETS.get(r["code"], [])),
            )
        )
    await session.flush()


@dataclass
class ProvisionTenantResult:
    tenant: Tenant
    admin_user: dict | None
    account_categories_created: int
    approval_lines_cloned: int
    warnings: list[str] = field(default_factory=list)


async def provision_tenant(session: AsyncSession, data: dict) -> ProvisionTenantResult:
    """Tenant + 계정과목 + 결재선 + 어드민 User 를 단일 세션에서 생성.
    (lib/services/provision-tenant.ts provisionTenant 이전)
    """
    warnings: list[str] = []
    limits = PLAN_LIMITS[data["plan"]]
    settings = default_settings_for_org_type(data["orgType"])

    tenant = Tenant(
        name=data["name"],
        subdomain=data["subdomain"],
        customDomain=data.get("customDomain"),
        orgType=data["orgType"],
        description=data.get("description"),
        logoUrl=data.get("logoUrl"),
        plan=data["plan"],
        maxUsers=limits["maxUsers"],
        maxStorageMB=limits["maxStorageMB"],
        planStartAt=utcnow(),
        settings=settings,
    )
    session.add(tenant)
    await session.flush()

    # 2. 계정과목 템플릿 → AccountCategory 복제 (sourceTemplateId 기록)
    category_templates = (
        (
            await session.execute(
                select(AccountCategoryTemplate)
                .where(
                    AccountCategoryTemplate.orgType == data["orgType"],
                    AccountCategoryTemplate.isActive == True,  # noqa: E712
                )
                .order_by(AccountCategoryTemplate.sortOrder)
            )
        )
        .scalars()
        .all()
    )

    account_categories_created = 0
    if not category_templates:
        warnings.append(
            f"orgType {data['orgType']}의 계정과목 템플릿이 없습니다. "
            "계정과목 없이 테넌트를 생성했습니다."
        )
    else:
        for template in category_templates:
            session.add(
                AccountCategory(
                    tenantId=tenant.id,
                    code=template.code,
                    name=template.name,
                    group=template.group,
                    kind=template.kind,
                    sortOrder=template.sortOrder,
                    isActive=template.isActive,
                    sourceTemplateId=template.id,
                )
            )
        account_categories_created = len(category_templates)
        await session.flush()

    # 3. 결재선 템플릿 → settings.approvalLines 스냅샷 복제
    line_templates = (
        (
            await session.execute(
                select(ApprovalLineTemplate)
                .where(ApprovalLineTemplate.orgType == data["orgType"])
                .order_by(ApprovalLineTemplate.sortOrder)
            )
        )
        .scalars()
        .all()
    )

    approval_lines_cloned = 0
    if not line_templates:
        warnings.append(
            f"orgType {data['orgType']}의 결재선 템플릿이 없습니다. "
            "결재선 없이 테넌트를 생성했습니다."
        )
    else:
        has_default = any(t.isDefault for t in line_templates)
        approval_lines = []
        for index, template in enumerate(line_templates):
            steps = (
                (
                    await session.execute(
                        select(ApprovalStepTemplate)
                        .where(ApprovalStepTemplate.templateId == template.id)
                        .order_by(ApprovalStepTemplate.stepOrder)
                    )
                )
                .scalars()
                .all()
            )
            approval_lines.append(
                {
                    "name": template.name,
                    "description": template.description,
                    "isDefault": template.isDefault if has_default else index == 0,
                    "sortOrder": template.sortOrder,
                    "sourceTemplateId": template.id,
                    "steps": [
                        {"stepOrder": s.stepOrder, "roleLabel": s.roleLabel} for s in steps
                    ],
                }
            )
        tenant.settings = {**settings, "approvalLines": approval_lines}
        session.add(tenant)
        await session.flush()
        approval_lines_cloned = len(approval_lines)

    # 4. 테넌트 어드민 User 생성
    admin_user: dict | None = None
    if data.get("adminEmail") and data.get("adminName") and data.get("adminPassword"):
        user = User(
            tenantId=tenant.id,
            userid=data["adminEmail"],
            username=data["adminName"],
            password=hash_password(data["adminPassword"]),
            role="admin",
            isActive=True,
        )
        session.add(user)
        await session.flush()
        admin_user = {"id": user.id, "userid": user.userid, "username": user.username}

        session.add(
            Membership(userId=user.id, tenantId=tenant.id, role="TENANT_ADMIN", isDefault=True)
        )
        tenant.currentUsers = 1
        session.add(tenant)
        await session.flush()
    else:
        warnings.append(
            "어드민 계정 정보(adminEmail/adminName/adminPassword)가 없어 "
            "어드민 User를 생성하지 않았습니다."
        )

    return ProvisionTenantResult(
        tenant=tenant,
        admin_user=admin_user,
        account_categories_created=account_categories_created,
        approval_lines_cloned=approval_lines_cloned,
        warnings=warnings,
    )
