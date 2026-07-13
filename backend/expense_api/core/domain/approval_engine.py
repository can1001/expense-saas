"""결재 엔진 — 순수 로직 (lib/approval-engine.ts 이전).

상태 전이 계산과 결재 가능 여부 검증. DB 의존 없음.
"""

from dataclasses import dataclass

from expense_api.core.models.enums import ApprovalStatus


@dataclass
class Decision:
    allowed: bool
    reason: str | None = None


# ── 검증 ──────────────────────────────────────────────────────────────
def can_modify_approval_line(current_status: str, actor_name: str, applicant_name: str) -> Decision:
    """결재선 수정 가능 여부. DRAFT + 작성자 본인만."""
    if current_status != ApprovalStatus.DRAFT.value:
        return Decision(False, "제출 후에는 결재선을 수정할 수 없습니다. 반려 후 재제출하세요.")
    if actor_name != applicant_name:
        return Decision(False, "작성자만 결재선을 수정할 수 있습니다.")
    return Decision(True)


def can_approve(
    approver_name: str, expected_approver_name: str, current_step: int, step_number: int
) -> Decision:
    """결재 가능 여부 — 본인 차례 + 지정 결재자."""
    if current_step != step_number:
        return Decision(
            False,
            f"현재 {current_step}차 결재 대기 중입니다. {step_number}차 결재는 아직 불가능합니다.",
        )
    if approver_name != expected_approver_name:
        return Decision(
            False, f"{step_number}차 결재자({expected_approver_name})만 승인할 수 있습니다."
        )
    return Decision(True)


# ── 상태 계산 ─────────────────────────────────────────────────────────
@dataclass
class NextStep:
    next_step: int
    is_complete: bool


def calculate_next_step(current_step: int, total_steps: int, action: str) -> NextStep:
    """다음 결재 단계 계산. action: 'APPROVE' | 'REJECT'."""
    if action == "REJECT":
        return NextStep(current_step, False)
    nxt = current_step + 1
    if nxt > total_steps:
        return NextStep(total_steps, True)
    return NextStep(nxt, False)


def calculate_approval_status(action: str, completed_step: int, total_steps: int) -> str:
    """결재 상태 계산. action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'WITHDRAW'."""
    if action == "SUBMIT":
        return ApprovalStatus.PENDING.value
    if action == "APPROVE":
        if completed_step >= total_steps:
            return ApprovalStatus.APPROVED_FINAL.value
        if completed_step == 2:
            return ApprovalStatus.APPROVED_STEP_2.value
        if completed_step == 1:
            return ApprovalStatus.APPROVED_STEP_1.value
        return ApprovalStatus.PENDING.value
    if action == "REJECT":
        return ApprovalStatus.REJECTED.value
    if action == "WITHDRAW":
        return ApprovalStatus.DRAFT.value
    return ApprovalStatus.DRAFT.value
