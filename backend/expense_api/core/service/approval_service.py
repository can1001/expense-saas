"""결재 워크플로우 서비스 — 제출/승인/반려/회수.
(app/api/expenses/[id]/{submit,approve,reject,withdraw} 로직 이전)

제출 시 결재선은 (1) 요청에 명시된 단계 또는 (2) 테넌트 결재 정책(§15.3)으로 산출한다.
정책 산출 시 선두 연속 전결(자동승인) 단계는 제출 시점에 선완료된다.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.domain.approval_engine import (
    calculate_approval_status,
    calculate_next_step,
    can_approve,
)
from expense_api.core.models.approval import ApprovalLine, ApprovalLog, ApprovalStep
from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.enums import ApprovalAction, ApprovalStatus, StepStatus
from expense_api.core.models.expense import Expense, ExpenseItem
from expense_api.core.models.ids import utcnow
from expense_api.core.schemas.approval import SubmitRequest
from expense_api.core.service.approval_policy_engine import (
    ApprovalPolicyEngine,
    ExpenseContext,
    PolicyResolutionError,
)


@dataclass
class _PlannedStep:
    stepNumber: int
    stepName: str
    approverName: str
    approverEmail: str | None
    approverTitle: str | None
    isAutoApproved: bool


class WorkflowError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class ApprovalService:
    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id

    async def _get_expense(self, expense_id: str) -> Expense:
        stmt = select(Expense).where(Expense.tenantId == self.tenant_id, Expense.id == expense_id)
        expense = (await self.session.execute(stmt)).scalars().first()
        if expense is None:
            raise WorkflowError(404, "지출결의서를 찾을 수 없습니다.")
        return expense

    async def _get_line(self, expense_id: str) -> ApprovalLine | None:
        stmt = select(ApprovalLine).where(ApprovalLine.expenseId == expense_id)
        return (await self.session.execute(stmt)).scalars().first()

    async def _get_steps(self, line_id: str) -> list[ApprovalStep]:
        stmt = (
            select(ApprovalStep)
            .where(ApprovalStep.approvalLineId == line_id)
            .order_by(ApprovalStep.stepNumber)
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def _log(self, expense_id: str, action: str, actor, prev: str, new: str, **kw) -> None:
        self.session.add(
            ApprovalLog(
                tenantId=self.tenant_id,
                expenseId=expense_id,
                action=action,
                actorName=actor.username,
                actorRole=actor.role,
                previousStatus=prev,
                newStatus=new,
                stepNumber=kw.get("step_number"),
                stepName=kw.get("step_name"),
                comment=kw.get("comment"),
            )
        )

    # ── 결재선 산출 (명시적 or 정책) ──────────────────────────────────
    async def _first_budget_detail_name(self, expense_id: str) -> str | None:
        stmt = (
            select(ExpenseItem.budgetDetail)
            .where(ExpenseItem.expenseId == expense_id)
            .order_by(ExpenseItem.order)
            .limit(1)
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def _plan_steps(
        self, expense: Expense, data: SubmitRequest
    ) -> tuple[list[_PlannedStep], int]:
        """(계획된 단계들, firstPendingStep) 반환."""
        # 1) 명시적 단계
        if data.steps:
            steps = [
                _PlannedStep(
                    stepNumber=s.stepNumber,
                    stepName=s.stepName,
                    approverName=s.approverName,
                    approverEmail=s.approverEmail,
                    approverTitle=s.approverTitle,
                    isAutoApproved=False,
                )
                for s in data.steps
            ]
            return steps, 1

        # 2) 정책 기반 산출
        policy = await self._load_policy(expense.tenantId, data.policyId)
        if policy is None:
            raise WorkflowError(400, "결재 단계가 없고 적용할 결재 정책도 없습니다.")
        ctx = ExpenseContext(
            tenant_id=expense.tenantId,
            year=expense.requestDate.year,
            applicant_user_id=expense.userId,
            budget_detail_name=await self._first_budget_detail_name(expense.id),
        )
        try:
            calc = await ApprovalPolicyEngine(self.session).resolve(policy, ctx)
        except PolicyResolutionError as e:
            raise WorkflowError(400, e.message)
        steps = [
            _PlannedStep(
                stepNumber=s.stepNumber,
                stepName=s.stepName,
                approverName=s.approverName,
                approverEmail=None,
                approverTitle=None,
                isAutoApproved=s.isAutoApproved,
            )
            for s in calc.steps
        ]
        return steps, calc.firstPendingStep

    async def _load_policy(
        self, tenant_id: str | None, policy_id: str | None
    ) -> ApprovalPolicy | None:
        if policy_id:
            p = await self.session.get(ApprovalPolicy, policy_id)
            return p if p and p.tenantId == tenant_id else None
        stmt = select(ApprovalPolicy).where(
            ApprovalPolicy.tenantId == tenant_id,
            ApprovalPolicy.isDefault == True,  # noqa: E712
            ApprovalPolicy.isActive == True,  # noqa: E712
        )
        return (await self.session.execute(stmt)).scalars().first()

    # ── 제출 ──────────────────────────────────────────────────────────
    async def submit(self, expense_id: str, actor, data: SubmitRequest) -> Expense:
        expense = await self._get_expense(expense_id)
        if expense.userId != actor.id:
            raise WorkflowError(403, "작성자만 제출할 수 있습니다.")
        if expense.status != ApprovalStatus.DRAFT.value:
            raise WorkflowError(400, "작성중(DRAFT) 상태만 제출할 수 있습니다.")
        if await self._get_line(expense_id) is not None:
            raise WorkflowError(409, "이미 결재선이 존재합니다.")

        planned, first_pending = await self._plan_steps(expense, data)
        now = utcnow()
        total = len(planned)

        line = ApprovalLine(
            expenseId=expense_id,
            currentStep=min(first_pending, total),
            totalSteps=total,
            isUrgent=data.isUrgent,
            snapshot={"steps": [p.__dict__ for p in planned], "totalSteps": total},
        )
        self.session.add(line)
        await self.session.flush()

        # 선두 연속 자동승인(전결) 단계는 선완료 처리
        for p in planned:
            pre_approved = p.stepNumber < first_pending
            self.session.add(
                ApprovalStep(
                    approvalLineId=line.id,
                    stepNumber=p.stepNumber,
                    stepName=p.stepName,
                    approverName=p.approverName,
                    approverEmail=p.approverEmail,
                    approverTitle=p.approverTitle,
                    status=StepStatus.APPROVED.value if pre_approved else StepStatus.PENDING.value,
                    approvedAt=now if pre_approved else None,
                    comment="전결(자동승인)" if pre_approved else None,
                )
            )

        completed = first_pending - 1  # 선완료된 단계 수
        prev = expense.status
        if completed >= total:  # 전부 전결 → 최종 승인
            expense.status = ApprovalStatus.APPROVED_FINAL.value
            expense.approvedAt = now
        elif completed > 0:
            expense.status = calculate_approval_status("APPROVE", completed, total)
        else:
            expense.status = calculate_approval_status("SUBMIT", 0, total)  # → PENDING
        expense.submittedAt = now

        await self._log(expense_id, ApprovalAction.SUBMIT.value, actor, prev, expense.status)
        await self.session.commit()
        await self.session.refresh(expense)
        return expense

    # ── 승인 ──────────────────────────────────────────────────────────
    async def approve(self, expense_id: str, actor, comment: str | None) -> Expense:
        expense = await self._get_expense(expense_id)
        line = await self._get_line(expense_id)
        if line is None:
            raise WorkflowError(400, "결재선이 없습니다.")
        if expense.status in (
            ApprovalStatus.APPROVED_FINAL.value,
            ApprovalStatus.REJECTED.value,
            ApprovalStatus.DRAFT.value,
        ):
            raise WorkflowError(400, "결재 진행 중인 지출결의서가 아닙니다.")

        steps = await self._get_steps(line.id)
        current = next((s for s in steps if s.stepNumber == line.currentStep), None)
        if current is None:
            raise WorkflowError(400, "현재 결재 단계를 찾을 수 없습니다.")

        decision = can_approve(
            actor.username, current.approverName, line.currentStep, current.stepNumber
        )
        if not decision.allowed:
            raise WorkflowError(403, decision.reason or "결재 권한이 없습니다.")

        now = utcnow()
        current.status = StepStatus.APPROVED.value
        current.approvedAt = now
        current.comment = comment

        completed_step = line.currentStep
        nxt = calculate_next_step(line.currentStep, line.totalSteps, "APPROVE")
        prev = expense.status
        expense.status = calculate_approval_status("APPROVE", completed_step, line.totalSteps)
        line.currentStep = nxt.next_step
        if nxt.is_complete:
            expense.approvedAt = now

        await self._log(
            expense_id,
            ApprovalAction.APPROVE.value,
            actor,
            prev,
            expense.status,
            step_number=completed_step,
            step_name=current.stepName,
            comment=comment,
        )
        await self.session.commit()
        await self.session.refresh(expense)
        await self.session.refresh(line)
        return expense

    # ── 반려 ──────────────────────────────────────────────────────────
    async def reject(self, expense_id: str, actor, comment: str) -> Expense:
        expense = await self._get_expense(expense_id)
        line = await self._get_line(expense_id)
        if line is None:
            raise WorkflowError(400, "결재선이 없습니다.")
        if expense.status in (
            ApprovalStatus.APPROVED_FINAL.value,
            ApprovalStatus.REJECTED.value,
            ApprovalStatus.DRAFT.value,
        ):
            raise WorkflowError(400, "결재 진행 중인 지출결의서가 아닙니다.")

        steps = await self._get_steps(line.id)
        current = next((s for s in steps if s.stepNumber == line.currentStep), None)
        if current is None:
            raise WorkflowError(400, "현재 결재 단계를 찾을 수 없습니다.")
        decision = can_approve(
            actor.username, current.approverName, line.currentStep, current.stepNumber
        )
        if not decision.allowed:
            raise WorkflowError(403, decision.reason or "결재 권한이 없습니다.")

        now = utcnow()
        current.status = StepStatus.REJECTED.value
        current.rejectedAt = now
        current.comment = comment
        prev = expense.status
        expense.status = calculate_approval_status("REJECT", line.currentStep, line.totalSteps)
        expense.rejectedAt = now
        await self._log(
            expense_id,
            ApprovalAction.REJECT.value,
            actor,
            prev,
            expense.status,
            step_number=line.currentStep,
            step_name=current.stepName,
            comment=comment,
        )
        await self.session.commit()
        await self.session.refresh(expense)
        return expense

    # ── 회수 ──────────────────────────────────────────────────────────
    async def withdraw(self, expense_id: str, actor) -> Expense:
        expense = await self._get_expense(expense_id)
        if expense.userId != actor.id:
            raise WorkflowError(403, "작성자만 회수할 수 있습니다.")
        if expense.status in (ApprovalStatus.APPROVED_FINAL.value, ApprovalStatus.DRAFT.value):
            raise WorkflowError(400, "회수할 수 없는 상태입니다.")

        # 결재선/단계 삭제 후 DRAFT 로 되돌림 (engine: WITHDRAW → DRAFT)
        line = await self._get_line(expense_id)
        if line is not None:
            for s in await self._get_steps(line.id):
                await self.session.delete(s)
            await self.session.delete(line)

        prev = expense.status
        expense.status = calculate_approval_status("WITHDRAW", 0, 0)  # → DRAFT
        expense.submittedAt = None
        await self._log(expense_id, ApprovalAction.WITHDRAW.value, actor, prev, expense.status)
        await self.session.commit()
        await self.session.refresh(expense)
        return expense
