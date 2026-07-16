"""알림 서비스 — 선호(preference) 게이팅 + 발송(어댑터) + 로그 기록 + 결재 이벤트 연동.

결재 이벤트(제출/승인/반려)를 수신해 관련자에게 알림을 만든다.
발송 자체는 NotificationProvider(로컬=mock)에 위임하고, 결과를 NotificationLog에 남긴다.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.approval import ApprovalLine, ApprovalStep
from expense_api.core.models.enums import (
    ApprovalStatus,
    NotificationChannel,
    NotificationEventType,
    NotificationStatus,
    StepStatus,
)
from expense_api.core.models.expense import Expense
from expense_api.core.models.ids import utcnow
from expense_api.core.models.notification import NotificationLog, NotificationPreference
from expense_api.core.models.user import User
from expense_api.core.service.notification_provider import NotificationProvider, get_provider

# 이벤트 → preference 필드
_EVENT_PREF_FIELD = {
    NotificationEventType.SUBMIT.value: "onSubmit",
    NotificationEventType.APPROVE.value: "onApprove",
    NotificationEventType.REJECT.value: "onReject",
    NotificationEventType.PAYMENT_COMPLETE.value: "onPaymentComplete",
}

# preference 채널 필드 → 채널값
_CHANNEL_PREF_FIELD = {
    NotificationChannel.WEB_PUSH.value: "webPushEnabled",
    NotificationChannel.SMS.value: "smsEnabled",
    NotificationChannel.KAKAO.value: "kakaoEnabled",
}


class NotificationService:
    def __init__(self, session: AsyncSession, tenant_id: str, provider: NotificationProvider | None = None):
        self.session = session
        self.tenant_id = tenant_id
        self.provider = provider or get_provider()

    async def _get_preference(self, user_id: str) -> NotificationPreference | None:
        stmt = select(NotificationPreference).where(NotificationPreference.userId == user_id)
        return (await self.session.execute(stmt)).scalars().first()

    async def _resolve_user_by_name(self, username: str) -> User | None:
        stmt = select(User).where(User.tenantId == self.tenant_id, User.username == username)
        return (await self.session.execute(stmt)).scalars().first()

    @staticmethod
    def _event_enabled(pref: NotificationPreference | None, event: str) -> bool:
        if pref is None:
            return True  # 설정 없으면 기본 활성
        field = _EVENT_PREF_FIELD.get(event)
        return getattr(pref, field, True) if field else True

    @staticmethod
    def _enabled_channels(pref: NotificationPreference | None) -> list[str]:
        if pref is None:
            return [NotificationChannel.WEB_PUSH.value]  # 기본: 웹푸시
        channels = []
        for channel, pref_field in _CHANNEL_PREF_FIELD.items():
            if getattr(pref, pref_field, False):
                channels.append(channel)
        return channels

    async def notify(
        self,
        *,
        recipient: User,
        event: str,
        message: str,
        expense_id: str | None = None,
    ) -> list[NotificationLog]:
        """한 수신자에게 이벤트 알림. 선호 게이팅 후 활성 채널로 발송·로그."""
        pref = await self._get_preference(recipient.id)
        if not self._event_enabled(pref, event):
            return []  # 이 이벤트 알림 꺼짐

        logs: list[NotificationLog] = []
        for channel in self._enabled_channels(pref):
            result = await self.provider.send(
                channel=channel,
                recipient_name=recipient.username,
                recipient_contact=recipient.phoneNumber,
                message=message,
            )
            log = NotificationLog(
                tenantId=self.tenant_id,
                recipientName=recipient.username,
                recipientPhone=recipient.phoneNumber or "",
                expenseId=expense_id,
                channel=channel,
                eventType=event,
                message=message,
                status=NotificationStatus.SENT.value if result.success else NotificationStatus.FAILED.value,
                providerMessageId=result.provider_message_id,
                errorMessage=result.error,
                sentAt=utcnow() if result.success else None,
            )
            self.session.add(log)
            logs.append(log)
        return logs

    # ── 결재 이벤트 연동 ──────────────────────────────────────────────
    async def _pending_approvers_at_current(self, expense_id: str) -> list[User]:
        line = (
            await self.session.execute(select(ApprovalLine).where(ApprovalLine.expenseId == expense_id))
        ).scalars().first()
        if line is None:
            return []
        steps = (
            await self.session.execute(
                select(ApprovalStep).where(
                    ApprovalStep.approvalLineId == line.id,
                    ApprovalStep.stepNumber == line.currentStep,
                    ApprovalStep.status == StepStatus.PENDING.value,
                )
            )
        ).scalars().all()
        approvers: list[User] = []
        for s in steps:
            name = s.delegatedTo or s.approverName
            u = await self._resolve_user_by_name(name)
            if u:
                approvers.append(u)
        return approvers

    async def notify_approval_event(
        self, expense: Expense, event: str, comment: str | None = None
    ) -> list[NotificationLog]:
        """결재 이벤트에 따라 관련자에게 알림."""
        logs: list[NotificationLog] = []
        applicant = await self.session.get(User, expense.userId)
        amount = f"{expense.requestAmount:,}원"

        if event == NotificationEventType.SUBMIT.value:
            # 현재 대기 결재자에게 결재 요청
            for approver in await self._pending_approvers_at_current(expense.id):
                logs += await self.notify(
                    recipient=approver, event=NotificationEventType.SUBMIT.value,
                    message=f"[결재요청] {expense.applicantName}님의 지출결의서 ({amount})",
                    expense_id=expense.id,
                )
        elif event == NotificationEventType.APPROVE.value:
            # 작성자에게 승인 알림
            if applicant:
                is_final = expense.status == ApprovalStatus.APPROVED_FINAL.value
                msg = "[최종승인] 지출결의서가 최종 승인되었습니다." if is_final else "[승인] 결재가 진행되었습니다."
                logs += await self.notify(
                    recipient=applicant, event=NotificationEventType.APPROVE.value,
                    message=f"{msg} ({amount})", expense_id=expense.id,
                )
            # 최종이 아니면 다음 대기 결재자에게 결재 요청
            if expense.status != ApprovalStatus.APPROVED_FINAL.value:
                for approver in await self._pending_approvers_at_current(expense.id):
                    logs += await self.notify(
                        recipient=approver, event=NotificationEventType.SUBMIT.value,
                        message=f"[결재요청] {expense.applicantName}님의 지출결의서 ({amount})",
                        expense_id=expense.id,
                    )
        elif event == NotificationEventType.REJECT.value:
            if applicant:
                reason = f" 사유: {comment}" if comment else ""
                logs += await self.notify(
                    recipient=applicant, event=NotificationEventType.REJECT.value,
                    message=f"[반려] 지출결의서가 반려되었습니다.{reason}", expense_id=expense.id,
                )
        return logs
