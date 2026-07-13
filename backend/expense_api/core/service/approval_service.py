"""결재 워크플로우 서비스 — 제출/승인/반려/회수.
(app/api/expenses/[id]/{submit,approve,reject,withdraw} 로직 이전)

Phase 3 골격: 결재선은 명시적 단계로 생성한다. 교회 직제 자동 산출
(lib/services/approval-line-service.ts, 예산담당자·연도별역할 결합)은
§15.3 의 ApprovalPolicy(설정형)로 별도 이전한다.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.domain.approval_engine import (
    calculate_approval_status,
    calculate_next_step,
    can_approve,
)
from expense_api.core.models.approval import ApprovalLine, ApprovalLog, ApprovalStep
from expense_api.core.models.enums import ApprovalAction, ApprovalStatus, StepStatus
from expense_api.core.models.expense import Expense
from expense_api.core.models.ids import utcnow
from expense_api.core.schemas.approval import SubmitRequest


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
        stmt = select(Expense).where(
            Expense.tenantId == self.tenant_id, Expense.id == expense_id
        )
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

    # ── 제출 ──────────────────────────────────────────────────────────
    async def submit(self, expense_id: str, actor, data: SubmitRequest) -> Expense:
        expense = await self._get_expense(expense_id)
        if expense.userId != actor.id:
            raise WorkflowError(403, "작성자만 제출할 수 있습니다.")
        if expense.status != ApprovalStatus.DRAFT.value:
            raise WorkflowError(400, "작성중(DRAFT) 상태만 제출할 수 있습니다.")
        if await self._get_line(expense_id) is not None:
            raise WorkflowError(409, "이미 결재선이 존재합니다.")

        now = utcnow()
        total = len(data.steps)
        line = ApprovalLine(
            expenseId=expense_id,
            currentStep=1,
            totalSteps=total,
            isUrgent=data.isUrgent,
            snapshot={"steps": [s.model_dump() for s in data.steps], "totalSteps": total},
        )
        self.session.add(line)
        await self.session.flush()

        for s in data.steps:
            self.session.add(
                ApprovalStep(
                    approvalLineId=line.id,
                    stepNumber=s.stepNumber,
                    stepName=s.stepName,
                    approverName=s.approverName,
                    approverEmail=s.approverEmail,
                    approverTitle=s.approverTitle,
                    status=StepStatus.PENDING.value,
                )
            )

        prev = expense.status
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

        decision = can_approve(actor.username, current.approverName, line.currentStep, current.stepNumber)
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
            expense_id, ApprovalAction.APPROVE.value, actor, prev, expense.status,
            step_number=completed_step, step_name=current.stepName, comment=comment,
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
        decision = can_approve(actor.username, current.approverName, line.currentStep, current.stepNumber)
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
            expense_id, ApprovalAction.REJECT.value, actor, prev, expense.status,
            step_number=line.currentStep, step_name=current.stepName, comment=comment,
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
