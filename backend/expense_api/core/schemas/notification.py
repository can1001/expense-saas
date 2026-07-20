"""알림 요청/응답 스키마."""

from datetime import datetime

from pydantic import BaseModel


class PreferenceOut(BaseModel):
    smsEnabled: bool
    kakaoEnabled: bool
    webPushEnabled: bool
    onSubmit: bool
    onApprove: bool
    onReject: bool
    onPaymentComplete: bool


class PreferenceUpdate(BaseModel):
    smsEnabled: bool | None = None
    kakaoEnabled: bool | None = None
    webPushEnabled: bool | None = None
    onSubmit: bool | None = None
    onApprove: bool | None = None
    onReject: bool | None = None
    onPaymentComplete: bool | None = None


class NotificationLogOut(BaseModel):
    id: str
    recipientName: str
    expenseId: str | None
    channel: str
    eventType: str
    message: str
    status: str
    createdAt: datetime


class PushSubscriptionKeys(BaseModel):
    p256dh: str | None = None
    auth: str | None = None


class PushSubscriptionPayload(BaseModel):
    endpoint: str | None = None
    keys: PushSubscriptionKeys | None = None


class PushSubscribeRequest(BaseModel):
    subscription: PushSubscriptionPayload | None = None
    deviceName: str | None = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str | None = None
    all: bool | None = None


class PushHistoryExpenseOut(BaseModel):
    id: str
    applicantName: str
    requestAmount: int
    status: str


class PushHistoryLogOut(BaseModel):
    id: str
    eventType: str
    title: str
    body: str
    url: str | None
    status: str
    errorMessage: str | None
    sentAt: datetime | None
    createdAt: datetime
    expenseId: str | None
    expense: PushHistoryExpenseOut | None = None
