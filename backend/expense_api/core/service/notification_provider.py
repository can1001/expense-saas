"""알림 발송 어댑터 — 외부 서비스(web-push/FCM/SMS/카카오)를 추상화.

로컬/테스트에서는 MockNotificationProvider 가 외부 호출 없이 성공을 반환한다.
실 SDK 연동(pywebpush, firebase-admin, SMS/카카오 API)은 별도 구현체로 주입한다.
(spec §Phase 4 — 어댑터 패턴, 로컬 완전 테스트 가능)
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass
class SendResult:
    success: bool
    provider_message_id: str | None = None
    error: str | None = None


class NotificationProvider(Protocol):
    async def send(
        self, *, channel: str, recipient_name: str, recipient_contact: str | None, message: str
    ) -> SendResult: ...


class MockNotificationProvider:
    """외부 호출 없이 성공 반환. 발송 내역을 메모리에 기록(테스트 관찰용)."""

    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send(
        self, *, channel: str, recipient_name: str, recipient_contact: str | None, message: str
    ) -> SendResult:
        self.sent.append(
            {"channel": channel, "to": recipient_name, "contact": recipient_contact, "message": message}
        )
        return SendResult(success=True, provider_message_id=f"mock-{len(self.sent)}")


_default_provider = MockNotificationProvider()


def get_provider() -> NotificationProvider:
    """현재 활성 알림 프로바이더. (운영에서는 실 SDK 구현체로 교체)"""
    return _default_provider
