"""알림 요청/응답 스키마."""

from datetime import datetime

from pydantic import BaseModel, Field


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


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=1)
    p256dh: str = Field(min_length=1)
    auth: str = Field(min_length=1)
    userAgent: str | None = None
    deviceName: str | None = None


class NotificationLogOut(BaseModel):
    id: str
    recipientName: str
    expenseId: str | None
    channel: str
    eventType: str
    message: str
    status: str
    createdAt: datetime
