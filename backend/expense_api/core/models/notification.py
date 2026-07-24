"""알림 모델 (Prisma NotificationPreference, NotificationLog, PushSubscription, WebPushLog,
AdminNotification, FcmToken, FcmLog 이전).

컬럼명 camelCase 보존, tenantId 스코프. (spec §4)
"""

from datetime import datetime

from sqlalchemy import Column, Text, UniqueConstraint, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.enums import NotificationStatus, pg_enum
from expense_api.core.models.ids import new_id, utcnow


class NotificationPreference(SQLModel, table=True):
    __tablename__ = "NotificationPreference"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용

    userId: str = Field(foreign_key="User.id", unique=True, index=True)

    # 채널 활성화
    smsEnabled: bool = True
    kakaoEnabled: bool = True
    webPushEnabled: bool = True

    # 이벤트별 알림
    onSubmit: bool = True
    onApprove: bool = True
    onReject: bool = True
    onPaymentComplete: bool = True

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


class NotificationLog(SQLModel, table=True):
    __tablename__ = "NotificationLog"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)

    recipientName: str
    recipientPhone: str = ""

    expenseId: str | None = Field(default=None, index=True)

    channel: str = Field(sa_type=pg_enum("NotificationChannel"))  # NotificationChannel
    eventType: str = Field(index=True, sa_type=pg_enum("NotificationEventType"))
    message: str

    status: str = Field(
        default=NotificationStatus.PENDING.value, index=True, sa_type=pg_enum("NotificationStatus")
    )
    providerMessageId: str | None = None
    errorMessage: str | None = None
    sentAt: datetime | None = None

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True)


class PushSubscription(SQLModel, table=True):
    __tablename__ = "PushSubscription"
    __table_args__ = (UniqueConstraint("userId", "endpoint", name="uq_push_user_endpoint"),)

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)

    userId: str = Field(foreign_key="User.id", index=True)

    endpoint: str = Field(sa_column=Column(Text))
    p256dh: str = Field(sa_column=Column(Text))
    auth: str = Field(sa_column=Column(Text))

    userAgent: str | None = Field(default=None, sa_column=Column(Text))
    deviceName: str | None = None

    isActive: bool = Field(default=True, index=True)
    failedCount: int = 0

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


class WebPushLog(SQLModel, table=True):
    __tablename__ = "WebPushLog"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)

    userId: str | None = Field(default=None, index=True)
    expenseId: str | None = Field(default=None, index=True)

    eventType: str = Field(
        index=True, sa_type=pg_enum("NotificationEventType")
    )  # NotificationEventType 값 문자열
    title: str
    body: str = Field(sa_column=Column(Text))
    url: str | None = None

    status: str = Field(
        default=NotificationStatus.PENDING.value, index=True, sa_type=pg_enum("NotificationStatus")
    )
    errorMessage: str | None = Field(default=None, sa_column=Column(Text))

    sentAt: datetime | None = None
    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True)


# FCM 토큰 (Capacitor 모바일 앱 푸시 알림용)
class FcmToken(SQLModel, table=True):
    __tablename__ = "FcmToken"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)

    userId: str = Field(foreign_key="User.id", index=True)

    token: str = Field(sa_column=Column(Text, unique=True))  # FCM 등록 토큰
    platform: str  # "android" | "ios"

    deviceModel: str | None = Field(default=None, sa_column=Column(Text))
    appVersion: str | None = None

    isActive: bool = Field(default=True, index=True)
    failedCount: int = 0
    lastUsedAt: datetime | None = None

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()})
    updatedAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()})


# FCM 발송 로그
class FcmLog(SQLModel, table=True):
    __tablename__ = "FcmLog"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)

    userId: str | None = Field(default=None, index=True)
    expenseId: str | None = Field(default=None, index=True)

    eventType: str = Field(index=True, sa_type=pg_enum("NotificationEventType"))
    title: str
    body: str = Field(sa_column=Column(Text))
    url: str | None = None

    status: str = Field(
        default=NotificationStatus.PENDING.value, index=True, sa_type=pg_enum("NotificationStatus")
    )
    errorMessage: str | None = Field(default=None, sa_column=Column(Text))

    sentAt: datetime | None = None
    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True)


class AdminNotification(SQLModel, table=True):
    __tablename__ = "AdminNotification"

    id: str = Field(default_factory=new_id, primary_key=True)
    tenantId: str | None = Field(default=None, index=True)

    title: str
    message: str = Field(sa_column=Column(Text))
    targetType: str  # 'ALL' | 'ROLE' | 'USER'
    targetValue: str | None = None
    sentCount: int = 0
    failedCount: int = 0
    status: str = Field(default="SENT", index=True)  # SENT | PARTIAL | FAILED
    createdBy: str = Field(index=True)

    createdAt: datetime = Field(default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True)
