"""개발 시드 — 데모 테넌트 + 관리자/사용자 (idempotent). Phase 1 골격 검증용.

운영에서는 실행하지 않는다 (RUNNING_ZONE=local 에서만 호출).
"""

from sqlalchemy import select

from expense_api.core.config.settings import settings
from expense_api.core.db.engine import async_session_maker
from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetDetailYear,
    BudgetSubcategory,
    Committee,
    Department,
    DepartmentBudgetDetail,
)
from expense_api.core.models.enums import OrgType
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import Role, User, UserYearRole
from expense_api.core.schemas.approval_policy import ApproverType, PolicyStepRule
from expense_api.core.security.jwt import hash_password

_POLICY_YEAR = 2026  # 데모 결재 정책 연도 (UserYearRole/BudgetDetailYear 기준)

_DEMO_SUBDOMAIN = "demo"


async def seed_if_needed() -> None:
    """local zone 에서만, 데모 테넌트가 없으면 생성."""
    if settings.is_prod:
        return
    async with async_session_maker() as session:
        existing = (
            (await session.execute(select(Tenant).where(Tenant.subdomain == _DEMO_SUBDOMAIN)))
            .scalars()
            .first()
        )
        if existing is not None:
            return

        # 데모 테넌트 (회사형 — §15 세그먼트 확인용)
        tenant = Tenant(
            name="데모 컨설팅",
            subdomain=_DEMO_SUBDOMAIN,
            orgType=OrgType.COMPANY.value,
            enabledModules=[],  # 비움 → orgType 프리셋 폴백 (COMPANY 팩)
        )
        session.add(tenant)
        await session.flush()

        # 역할 (permissions 비움 → 코드 프리셋 폴백)
        session.add(Role(tenantId=tenant.id, code="admin", name="관리자", permissions=[]))
        session.add(Role(tenantId=tenant.id, code="user", name="사용자", permissions=[]))

        # 사용자
        session.add(
            User(
                tenantId=tenant.id,
                userid="admin",
                username="관리자",
                password=hash_password("admin123"),
                role="admin",
                canRegisterUsers=True,
            )
        )
        session.add(
            User(
                tenantId=tenant.id,
                userid="user1",
                username="일반사용자",
                password=hash_password("user123"),
                role="user",
            )
        )

        # ── 예산 계층 트리 (캐스케이드 검증용) ──────────────────────────
        tid = tenant.id
        # 위원회 2개
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        c2 = Committee(tenantId=tid, name="사업본부", sortOrder=2)
        session.add(c1)
        session.add(c2)
        await session.flush()
        # 부서
        d_fin = Department(tenantId=tid, committeeId=c1.id, name="재정팀", sortOrder=1)
        d_sales = Department(tenantId=tid, committeeId=c2.id, name="영업팀", sortOrder=2)
        session.add(d_fin)
        session.add(d_sales)
        # 항 → 목 → 세목
        cat_admin = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
        cat_hr = BudgetCategory(tenantId=tid, name="인건비", sortOrder=2)
        session.add(cat_admin)
        session.add(cat_hr)
        await session.flush()
        sub_meeting = BudgetSubcategory(
            tenantId=tid, categoryId=cat_admin.id, name="회의비", sortOrder=1
        )
        sub_salary = BudgetSubcategory(tenantId=tid, categoryId=cat_hr.id, name="급여", sortOrder=1)
        session.add(sub_meeting)
        session.add(sub_salary)
        await session.flush()
        det_snack = BudgetDetail(
            tenantId=tid, subcategoryId=sub_meeting.id, name="간식비", sortOrder=1
        )
        det_tea = BudgetDetail(
            tenantId=tid, subcategoryId=sub_meeting.id, name="다과비", sortOrder=2
        )
        det_reg = BudgetDetail(
            tenantId=tid, subcategoryId=sub_salary.id, name="정규직급여", sortOrder=1
        )
        session.add(det_snack)
        session.add(det_tea)
        session.add(det_reg)
        await session.flush()
        # 부서-세목 연결: 재정팀 ↔ (간식비, 다과비, 정규직급여), 영업팀 ↔ 정규직급여
        for det in (det_snack, det_tea, det_reg):
            session.add(
                DepartmentBudgetDetail(tenantId=tid, departmentId=d_fin.id, budgetDetailId=det.id)
            )
        session.add(
            DepartmentBudgetDetail(tenantId=tid, departmentId=d_sales.id, budgetDetailId=det_reg.id)
        )

        # ── 결재 담당자/역할 + 기본 정책 (§15.3 설정형 결재선) ────────────
        leader = User(
            tenantId=tid,
            userid="leader",
            username="김팀장",
            password=hash_password("pw123"),
            role="team_leader",
        )
        acc = User(
            tenantId=tid,
            userid="acc",
            username="이회계",
            password=hash_password("pw123"),
            role="accountant",
        )
        fin = User(
            tenantId=tid,
            userid="fin",
            username="박재정",
            password=hash_password("pw123"),
            role="finance_head",
        )
        session.add_all([leader, acc, fin])
        await session.flush()
        # 연도별 역할 (회계/재정팀장)
        session.add(UserYearRole(tenantId=tid, userId=acc.id, year=_POLICY_YEAR, role="accountant"))
        session.add(
            UserYearRole(tenantId=tid, userId=fin.id, year=_POLICY_YEAR, role="finance_head")
        )
        # 간식비 세목의 연도별 담당자 = 김팀장
        session.add(
            BudgetDetailYear(
                tenantId=tid,
                budgetDetailId=det_snack.id,
                year=_POLICY_YEAR,
                managerId=leader.id,
                budgetAmount=1_000_000,
            )
        )

        # 교회식 기본 결재 정책: 담당자 → 회계 → 재정팀장 (전결 collapse 활성)
        session.add(
            ApprovalPolicy(
                tenantId=tid,
                name="기본 결재선 (담당자→회계→재정팀장)",
                isDefault=True,
                collapseDuplicateApprovers=True,
                steps=[
                    PolicyStepRule(
                        stepName="담당자",
                        approverType=ApproverType.BUDGET_MANAGER,
                        role="finance_head",
                    ).model_dump(),
                    PolicyStepRule(
                        stepName="회계",
                        approverType=ApproverType.ROLE,
                        role="accountant",
                        autoApproveWhenSelf=False,
                    ).model_dump(),
                    PolicyStepRule(
                        stepName="재정팀장",
                        approverType=ApproverType.ROLE,
                        role="finance_head",
                        autoApproveWhenSelf=False,
                    ).model_dump(),
                ],
            )
        )

        await session.commit()
