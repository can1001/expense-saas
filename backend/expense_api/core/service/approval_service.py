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
)
from expense_api.core.models.approval import ApprovalLine, ApprovalLog, ApprovalStep
from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.enums import ApprovalAction, ApprovalStatus, StepStatus
from expense_api.core.models.expense import Expense, ExpenseItem
from expense_api.core.models.ids import utcnow
from expense_api.core.schemas.approval import (
    ApprovalListExpenseOut,
    ApprovalListItemOut,
    ApprovalListLineOut,
    ApprovalListMyStepOut,
    ApprovalListOut,
    ApprovalListPaginationOut,
    ApprovalStepOut,
    SubmitRequest,
)
from expense_api.core.schemas.expense import ExpenseItemOut
from expense_api.core.service.approval_policy_engine import (
    ApprovalPolicyEngine,
    ExpenseContext,
    PolicyResolutionError,
)

# 결재 대기 중으로 취급하는 지출결의서 상태 — app/api/approvals(/pending-count) 이전
_IN_PROGRESS_STATUSES = (
    ApprovalStatus.PENDING.value,
    ApprovalStatus.APPROVED_STEP_1.value,
    ApprovalStatus.APPROVED_STEP_2.value,
)


@dataclass
class _PlannedStep:
    stepNumber: int  # 결재 레벨 (병렬 시 여러 스텝이 동일)
    stepName: str
    approverName: str
    approverEmail: str | None
    approverTitle: str | None
    isAutoApproved: bool
    isParallel: bool = False


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

    async def _list_items(self, expense_id: str) -> list[ExpenseItem]:
        stmt = (
            select(ExpenseItem)
            .where(ExpenseItem.expenseId == expense_id)
            .order_by(ExpenseItem.order)
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
            request_amount=expense.requestAmount,
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
                isParallel=s.isParallel,
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

    async def _apply_new_line(self, expense: Expense, actor, data: SubmitRequest, action: str) -> None:
        """결재선 산출 → 생성 + 전결 선완료 + 지출 상태 반영 + 로그. (제출/재제출 공용)"""
        planned, first_pending = await self._plan_steps(expense, data)
        now = utcnow()
        total_levels = max(p.stepNumber for p in planned)  # 병렬은 한 레벨

        line = ApprovalLine(
            expenseId=expense.id,
            currentStep=min(first_pending, total_levels),
            totalSteps=total_levels,
            isUrgent=data.isUrgent,
            snapshot={"steps": [p.__dict__ for p in planned], "totalSteps": total_levels},
        )
        self.session.add(line)
        await self.session.flush()

        # 전결(자동승인) 스텝은 선완료. 단, firstPending 레벨까지만 (뒤 레벨은 순서대로).
        for p in planned:
            pre_approved = p.isAutoApproved and p.stepNumber <= first_pending
            self.session.add(
                ApprovalStep(
                    approvalLineId=line.id,
                    stepNumber=p.stepNumber,
                    stepName=p.stepName,
                    approverName=p.approverName,
                    approverEmail=p.approverEmail,
                    approverTitle=p.approverTitle,
                    isParallel=p.isParallel,
                    status=StepStatus.APPROVED.value if pre_approved else StepStatus.PENDING.value,
                    approvedAt=now if pre_approved else None,
                    comment="전결(자동승인)" if pre_approved else None,
                )
            )

        completed = first_pending - 1  # 선완료된 레벨 수
        prev = expense.status
        if completed >= total_levels:  # 전부 전결 → 최종 승인
            expense.status = ApprovalStatus.APPROVED_FINAL.value
            expense.approvedAt = now
        elif completed > 0:
            expense.status = calculate_approval_status("APPROVE", completed, total_levels)
        else:
            expense.status = calculate_approval_status("SUBMIT", 0, total_levels)  # → PENDING
        expense.submittedAt = now

        await self._log(expense.id, action, actor, prev, expense.status)

    # ── 제출 ──────────────────────────────────────────────────────────
    async def submit(self, expense_id: str, actor, data: SubmitRequest) -> Expense:
        expense = await self._get_expense(expense_id)
        if expense.userId != actor.id:
            raise WorkflowError(403, "작성자만 제출할 수 있습니다.")
        if expense.status != ApprovalStatus.DRAFT.value:
            raise WorkflowError(400, "작성중(DRAFT) 상태만 제출할 수 있습니다.")
        if await self._get_line(expense_id) is not None:
            raise WorkflowError(409, "이미 결재선이 존재합니다.")

        await self._apply_new_line(expense, actor, data, ApprovalAction.SUBMIT.value)
        await self.session.commit()
        await self.session.refresh(expense)
        return expense

    # ── 재제출 (반려 → 재산출 후 재상신) ──────────────────────────────
    async def resubmit(self, expense_id: str, actor, data: SubmitRequest) -> Expense:
        expense = await self._get_expense(expense_id)
        if expense.userId != actor.id:
            raise WorkflowError(403, "작성자만 재제출할 수 있습니다.")
        if expense.status != ApprovalStatus.REJECTED.value:
            raise WorkflowError(400, "반려(REJECTED)된 지출결의서만 재제출할 수 있습니다.")

        # 기존 결재선/단계 삭제 후 재산출
        # (SQLite FK ON: 스텝을 먼저 flush 로 지운 뒤 라인 삭제 — 순서 보장)
        line = await self._get_line(expense_id)
        if line is not None:
            for s in await self._get_steps(line.id):
                await self.session.delete(s)
            await self.session.flush()
            await self.session.delete(line)
            await self.session.flush()
        expense.rejectedAt = None

        await self._apply_new_line(expense, actor, data, ApprovalAction.RESUBMIT.value)
        await self.session.commit()
        await self.session.refresh(expense)
        return expense

    def _actor_pending_step(
        self, level_steps: list[ApprovalStep], actor
    ) -> ApprovalStep | None:
        """현재 레벨에서 actor(결재자 본인 또는 대리인)의 대기 스텝을 찾는다."""
        for s in level_steps:
            if s.status != StepStatus.PENDING.value:
                continue
            if actor.username == s.approverName or (
                s.delegatedTo and actor.username == s.delegatedTo
            ):
                return s
        return None

    def _guard_in_progress(self, expense: Expense) -> None:
        if expense.status in (
            ApprovalStatus.APPROVED_FINAL.value,
            ApprovalStatus.REJECTED.value,
            ApprovalStatus.DRAFT.value,
        ):
            raise WorkflowError(400, "결재 진행 중인 지출결의서가 아닙니다.")

    # ── 승인 (레벨 기반: 병렬 시 레벨 전체 승인돼야 전진) ───────────────
    async def approve(self, expense_id: str, actor, comment: str | None) -> Expense:
        expense = await self._get_expense(expense_id)
        line = await self._get_line(expense_id)
        if line is None:
            raise WorkflowError(400, "결재선이 없습니다.")
        self._guard_in_progress(expense)

        steps = await self._get_steps(line.id)
        level_steps = [s for s in steps if s.stepNumber == line.currentStep]
        mine = self._actor_pending_step(level_steps, actor)
        if mine is None:
            raise WorkflowError(403, "현재 단계의 지정 결재자(또는 대리인)가 아닙니다.")

        now = utcnow()
        mine.status = StepStatus.APPROVED.value
        mine.approvedAt = now
        mine.comment = comment

        prev = expense.status
        still_pending = [s for s in level_steps if s.status == StepStatus.PENDING.value]
        if still_pending:
            # 병렬 레벨 부분 승인 — 레벨 미완료, 전진하지 않음
            await self._log(
                expense_id, ApprovalAction.APPROVE.value, actor, prev, expense.status,
                step_number=line.currentStep, step_name=mine.stepName, comment=comment,
            )
            await self.session.commit()
            await self.session.refresh(expense)
            return expense

        # 레벨 전체 승인 완료 → 전진
        completed_level = line.currentStep
        nxt = calculate_next_step(line.currentStep, line.totalSteps, "APPROVE")
        expense.status = calculate_approval_status("APPROVE", completed_level, line.totalSteps)
        line.currentStep = nxt.next_step
        if nxt.is_complete:
            expense.approvedAt = now

        await self._log(
            expense_id, ApprovalAction.APPROVE.value, actor, prev, expense.status,
            step_number=completed_level, step_name=mine.stepName, comment=comment,
        )
        await self.session.commit()
        await self.session.refresh(expense)
        await self.session.refresh(line)
        return expense

    # ── 반려 (레벨 내 한 명이라도 반려하면 전체 반려) ──────────────────
    async def reject(self, expense_id: str, actor, comment: str) -> Expense:
        expense = await self._get_expense(expense_id)
        line = await self._get_line(expense_id)
        if line is None:
            raise WorkflowError(400, "결재선이 없습니다.")
        self._guard_in_progress(expense)

        steps = await self._get_steps(line.id)
        level_steps = [s for s in steps if s.stepNumber == line.currentStep]
        mine = self._actor_pending_step(level_steps, actor)
        if mine is None:
            raise WorkflowError(403, "현재 단계의 지정 결재자(또는 대리인)가 아닙니다.")

        now = utcnow()
        mine.status = StepStatus.REJECTED.value
        mine.rejectedAt = now
        mine.comment = comment
        prev = expense.status
        expense.status = calculate_approval_status("REJECT", line.currentStep, line.totalSteps)
        expense.rejectedAt = now
        await self._log(
            expense_id, ApprovalAction.REJECT.value, actor, prev, expense.status,
            step_number=line.currentStep, step_name=mine.stepName, comment=comment,
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
        # (SQLite FK ON: 스텝을 먼저 flush 로 지운 뒤 라인 삭제 — 순서 보장)
        line = await self._get_line(expense_id)
        if line is not None:
            for s in await self._get_steps(line.id):
                await self.session.delete(s)
            await self.session.flush()
            await self.session.delete(line)
            await self.session.flush()

        prev = expense.status
        expense.status = calculate_approval_status("WITHDRAW", 0, 0)  # → DRAFT
        expense.submittedAt = None
        await self._log(expense_id, ApprovalAction.WITHDRAW.value, actor, prev, expense.status)
        await self.session.commit()
        await self.session.refresh(expense)
        return expense

    # ── 대리결재 지정 ─────────────────────────────────────────────────
    async def delegate(
        self, expense_id: str, actor, step_number: int, delegated_to: str, reason: str | None
    ) -> ApprovalStep:
        """지정 결재자가 특정 단계를 대리인에게 위임한다. (본인 대기 스텝만)"""
        expense = await self._get_expense(expense_id)
        line = await self._get_line(expense_id)
        if line is None:
            raise WorkflowError(400, "결재선이 없습니다.")
        self._guard_in_progress(expense)

        steps = await self._get_steps(line.id)
        target = next(
            (
                s
                for s in steps
                if s.stepNumber == step_number
                and s.status == StepStatus.PENDING.value
                and s.approverName == actor.username
            ),
            None,
        )
        if target is None:
            raise WorkflowError(403, "본인이 지정된 대기 단계만 위임할 수 있습니다.")

        target.delegatedTo = delegated_to
        target.delegationReason = reason
        await self._log(
            expense_id, ApprovalAction.DELEGATE.value, actor, expense.status, expense.status,
            step_number=step_number, step_name=target.stepName, comment=reason,
        )
        await self.session.commit()
        await self.session.refresh(target)
        return target

    # ── 결재선 수정 (진행 중 잔여 단계 교체 + 감사 스냅샷) ─────────────
    @staticmethod
    def _snapshot_steps(steps: list[ApprovalStep]) -> list[dict]:
        return [
            {"stepNumber": s.stepNumber, "stepName": s.stepName, "approverName": s.approverName,
             "status": s.status, "isParallel": s.isParallel}
            for s in steps
        ]

    async def modify_line(self, expense_id: str, actor, new_steps: list) -> ApprovalLine:
        """currentStep 이상의 미승인 잔여 결재선을 new_steps 로 교체한다. (작성자, 진행 중)"""
        expense = await self._get_expense(expense_id)
        if expense.userId != actor.id:
            raise WorkflowError(403, "작성자만 결재선을 수정할 수 있습니다.")
        line = await self._get_line(expense_id)
        if line is None:
            raise WorkflowError(400, "결재선이 없습니다.")
        self._guard_in_progress(expense)

        steps = await self._get_steps(line.id)
        # 현재 레벨이 이미 부분 승인됐다면 교체 불가 (완료 단계 훼손 방지)
        current_level = [s for s in steps if s.stepNumber == line.currentStep]
        if any(s.status != StepStatus.PENDING.value for s in current_level):
            raise WorkflowError(400, "현재 단계가 이미 진행되어 결재선을 수정할 수 없습니다.")

        kept = [s for s in steps if s.stepNumber < line.currentStep]  # 완료 레벨 보존
        replaced = [s for s in steps if s.stepNumber >= line.currentStep]
        before_snapshot = self._snapshot_steps(replaced)

        # new_steps 를 현재 레벨부터 시작하도록 레벨 재배정 (병렬=동일 stepNumber 보존)
        base = min(s.stepNumber for s in new_steps)
        offset = line.currentStep - base
        for s in replaced:
            await self.session.delete(s)
        await self.session.flush()

        added: list[ApprovalStep] = []
        for s in new_steps:
            lvl = s.stepNumber + offset
            step = ApprovalStep(
                approvalLineId=line.id,
                stepNumber=lvl,
                stepName=s.stepName,
                approverName=s.approverName,
                approverEmail=s.approverEmail,
                approverTitle=s.approverTitle,
                status=StepStatus.PENDING.value,
            )
            self.session.add(step)
            added.append(step)

        new_total = max([s.stepNumber for s in kept] + [st.stepNumber for st in added])
        line.totalSteps = new_total

        # 감사 로그 (before/after 스냅샷)
        self.session.add(
            ApprovalLog(
                tenantId=self.tenant_id,
                expenseId=expense_id,
                action=ApprovalAction.MODIFY_LINE.value,
                actorName=actor.username,
                actorRole=actor.role,
                previousStatus=expense.status,
                newStatus=expense.status,
                stepNumber=line.currentStep,
                beforeSnapshot={"steps": before_snapshot},
                afterSnapshot={"steps": self._snapshot_steps(added)},
            )
        )
        await self.session.commit()
        await self.session.refresh(line)
        return line

    # ── 결재함 목록 (app/api/approvals/route.ts 이전) ──────────────────
    async def _lines_for_approver(
        self, approver_name: str, status_filter: str
    ) -> list[ApprovalLine]:
        step_filters = [ApprovalStep.approverName == approver_name]
        if status_filter == "pending":
            step_filters.append(ApprovalStep.status == StepStatus.PENDING.value)
        elif status_filter == "completed":
            step_filters.append(
                ApprovalStep.status.in_([StepStatus.APPROVED.value, StepStatus.REJECTED.value])
            )

        stmt = (
            select(ApprovalLine)
            .join(ApprovalStep, ApprovalStep.approvalLineId == ApprovalLine.id)
            .join(Expense, Expense.id == ApprovalLine.expenseId)
            .where(Expense.tenantId == self.tenant_id, *step_filters)
        )
        if status_filter == "pending":
            stmt = stmt.where(Expense.status.in_(_IN_PROGRESS_STATUSES))
        stmt = stmt.distinct().order_by(ApprovalLine.createdAt.desc())
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_for_approver(
        self, approver_name: str, status_filter: str, page: int, limit: int
    ) -> ApprovalListOut:
        """결재자 기준 결재함 목록. status: pending(내 차례) | completed(내가 처리함) | all."""
        lines = await self._lines_for_approver(approver_name, status_filter)

        entries: list[ApprovalListItemOut] = []
        for line in lines:
            expense = await self._get_expense(line.expenseId)
            steps = await self._get_steps(line.id)
            current_step = next((s for s in steps if s.stepNumber == line.currentStep), None)
            is_my_turn = bool(current_step and current_step.approverName == approver_name)
            if status_filter == "pending" and not is_my_turn:
                continue

            my_step = next((s for s in steps if s.approverName == approver_name), None)
            items = await self._list_items(expense.id)
            first_item = items[0] if items else None

            entries.append(
                ApprovalListItemOut(
                    id=expense.id,
                    expense=ApprovalListExpenseOut(
                        id=expense.id,
                        committee=expense.committee,
                        department=expense.department,
                        budgetCategory=first_item.budgetCategory if first_item else "",
                        budgetSubcategory=first_item.budgetSubcategory if first_item else "",
                        requestAmount=expense.requestAmount,
                        applicantName=expense.applicantName,
                        status=expense.status,
                        submittedAt=expense.submittedAt,
                        createdAt=expense.createdAt,
                        items=[
                            ExpenseItemOut(
                                id=i.id,
                                budgetCategory=i.budgetCategory,
                                budgetSubcategory=i.budgetSubcategory,
                                budgetDetail=i.budgetDetail,
                                description=i.description,
                                unitPrice=i.unitPrice,
                                quantity=i.quantity,
                                amount=i.amount,
                                order=i.order,
                            )
                            for i in items
                        ],
                    ),
                    approvalLine=ApprovalListLineOut(
                        id=line.id,
                        currentStep=line.currentStep,
                        totalSteps=line.totalSteps,
                        isUrgent=line.isUrgent,
                        steps=[
                            ApprovalStepOut(
                                stepNumber=s.stepNumber,
                                stepName=s.stepName,
                                approverName=s.approverName,
                                status=s.status,
                                approvedAt=s.approvedAt,
                                rejectedAt=s.rejectedAt,
                                comment=s.comment,
                                isParallel=s.isParallel,
                                delegatedTo=s.delegatedTo,
                            )
                            for s in steps
                        ],
                    ),
                    myStep=(
                        ApprovalListMyStepOut(
                            stepNumber=my_step.stepNumber,
                            stepName=my_step.stepName,
                            status=my_step.status,
                            approvedAt=my_step.approvedAt,
                            rejectedAt=my_step.rejectedAt,
                            comment=my_step.comment,
                        )
                        if my_step is not None
                        else None
                    ),
                    isMyTurn=is_my_turn,
                )
            )

        total = len(entries)
        offset = (page - 1) * limit
        paginated = entries[offset : offset + limit]
        total_pages = (total + limit - 1) // limit if limit else 0
        return ApprovalListOut(
            approvals=paginated,
            pagination=ApprovalListPaginationOut(
                page=page, limit=limit, total=total, totalPages=total_pages
            ),
        )

    # ── 결재 대기 건수 (app/api/approvals/pending-count/route.ts 이전) ──
    async def count_pending_for_approver(self, approver_name: str) -> int:
        lines = await self._lines_for_approver(approver_name, "pending")
        count = 0
        for line in lines:
            stmt = (
                select(ApprovalStep)
                .where(
                    ApprovalStep.approvalLineId == line.id,
                    ApprovalStep.approverName == approver_name,
                )
                .order_by(ApprovalStep.stepNumber)
            )
            approver_steps = list((await self.session.execute(stmt)).scalars().all())
            my_pending_step = next(
                (s for s in approver_steps if s.status == StepStatus.PENDING.value), None
            )
            if my_pending_step and my_pending_step.stepNumber == line.currentStep:
                count += 1
        return count
