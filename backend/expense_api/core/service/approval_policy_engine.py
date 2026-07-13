"""결재 정책 엔진 — 정책 규칙을 구체 결재선으로 resolve. (spec §15.3)

lib/services/approval-line-service.ts 의 교회 하드코딩 로직을 일반화:
- role         → UserYearRole(year, role) 활성 담당자
- budget_manager → BudgetDetailYear(년도) 담당자, 미지정 시 role 폴백
- fixed_user   → 특정 사용자
전결(자동승인): 신청자==결재자(autoApproveWhenSelf) 또는 동일 결재자 중복(collapse).
자동승인은 '선두 연속' 단계만 제출 시 선완료된다(원본 동작 보존, 선형 워크플로우 유지).
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.budget import BudgetDetail, BudgetDetailYear
from expense_api.core.models.user import User, UserYearRole
from expense_api.core.schemas.approval_policy import (
    ApproverType,
    CalculatedLineOut,
    PolicyStepRule,
    ResolvedStepOut,
)


class PolicyResolutionError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class ExpenseContext:
    tenant_id: str
    year: int
    applicant_user_id: str
    budget_detail_name: str | None = None
    request_amount: int = 0  # 조건부 단계(minAmount/maxAmount) 판정용


class ApprovalPolicyEngine:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── resolver ──────────────────────────────────────────────────────
    async def _resolve_year_role(self, tenant_id: str, year: int, role: str) -> User | None:
        stmt = (
            select(User)
            .join(UserYearRole, UserYearRole.userId == User.id)
            .where(
                User.tenantId == tenant_id,
                User.isActive == True,  # noqa: E712
                UserYearRole.year == year,
                UserYearRole.role == role,
            )
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def _resolve_budget_manager(
        self, tenant_id: str, year: int, budget_detail_name: str | None
    ) -> User | None:
        if not budget_detail_name:
            return None
        detail = (
            (
                await self.session.execute(
                    select(BudgetDetail).where(
                        BudgetDetail.tenantId == tenant_id, BudgetDetail.name == budget_detail_name
                    )
                )
            )
            .scalars()
            .first()
        )
        if detail is None:
            return None
        stmt = (
            select(User)
            .join(BudgetDetailYear, BudgetDetailYear.managerId == User.id)
            .where(
                BudgetDetailYear.budgetDetailId == detail.id,
                BudgetDetailYear.year == year,
                User.tenantId == tenant_id,
            )
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def _resolve_fixed_user(self, tenant_id: str, user_id: str | None) -> User | None:
        if not user_id:
            return None
        user = await self.session.get(User, user_id)
        if user and user.tenantId == tenant_id:
            return user
        return None

    async def _resolve_step(self, rule: PolicyStepRule, ctx: ExpenseContext) -> User:
        approver: User | None = None
        if rule.approverType == ApproverType.ROLE:
            approver = await self._resolve_year_role(ctx.tenant_id, ctx.year, rule.role or "")
        elif rule.approverType == ApproverType.BUDGET_MANAGER:
            approver = await self._resolve_budget_manager(
                ctx.tenant_id, ctx.year, ctx.budget_detail_name
            )
            if approver is None and rule.role:  # 담당자 미지정 → 폴백 role
                approver = await self._resolve_year_role(ctx.tenant_id, ctx.year, rule.role)
        elif rule.approverType == ApproverType.FIXED_USER:
            approver = await self._resolve_fixed_user(ctx.tenant_id, rule.userId)

        if approver is None:
            raise PolicyResolutionError(
                f"'{rule.stepName}' 결재자를 확정할 수 없습니다 "
                f"(type={rule.approverType.value}, role={rule.role})."
            )
        return approver

    @staticmethod
    def _matches_condition(rule: PolicyStepRule, amount: int) -> bool:
        if rule.minAmount is not None and amount < rule.minAmount:
            return False
        if rule.maxAmount is not None and amount > rule.maxAmount:
            return False
        return True

    # ── resolve 전체 (레벨 기반: 병렬/조건부 지원) ─────────────────────
    async def resolve(self, policy: ApprovalPolicy, ctx: ExpenseContext) -> CalculatedLineOut:
        all_rules = [PolicyStepRule(**s) for s in (policy.steps or [])]
        if not all_rules:
            raise PolicyResolutionError("정책에 결재 단계가 없습니다.")

        # 1) 조건부 필터 (금액 범위)
        rules = [r for r in all_rules if self._matches_condition(r, ctx.request_amount)]
        if not rules:
            raise PolicyResolutionError("청구금액 조건에 맞는 결재 단계가 없습니다.")

        # 2) 결재자 resolve + 레벨 배정 (parallel 이면 직전과 동일 레벨)
        resolved: list[tuple[PolicyStepRule, User, int]] = []
        level = 0
        for i, rule in enumerate(rules):
            approver = await self._resolve_step(rule, ctx)
            if i == 0 or not rule.parallel:
                level += 1
            resolved.append((rule, approver, level))

        approver_ids = [u.id for _, u, _ in resolved]
        total_levels = level

        # 3) 전결(자동승인) 계산 (스텝 단위)
        steps: list[ResolvedStepOut] = []
        for i, (rule, user, lvl) in enumerate(resolved):
            auto = False
            if rule.autoApproveWhenSelf and user.id == ctx.applicant_user_id:
                auto = True
            if policy.collapseDuplicateApprovers and user.id in approver_ids[i + 1 :]:
                auto = True
            steps.append(
                ResolvedStepOut(
                    stepNumber=lvl,
                    stepName=rule.stepName,
                    approverName=user.username,
                    approverId=user.id,
                    isAutoApproved=auto,
                    isParallel=rule.parallel,
                )
            )

        # 4) 선두 연속 '전원 전결' 레벨 → firstPendingLevel
        #    한 레벨은 그 레벨의 모든 스텝이 자동승인일 때만 완료로 간주.
        first_pending = total_levels + 1
        for lvl in range(1, total_levels + 1):
            lvl_steps = [s for s in steps if s.stepNumber == lvl]
            if all(s.isAutoApproved for s in lvl_steps):
                continue
            first_pending = lvl
            break
        all_auto = first_pending > total_levels

        return CalculatedLineOut(
            totalSteps=total_levels,
            firstPendingStep=first_pending,
            allAutoApproved=all_auto,
            steps=steps,
        )
