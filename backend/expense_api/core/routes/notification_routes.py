"""알림 라우트 — 선호 조회/수정, 알림 로그, 웹푸시 구독. (app/api/push, mypage/notifications 이전)"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.notification import (
    NotificationLog,
    NotificationPreference,
    PushSubscription,
)
from expense_api.core.schemas.notification import (
    NotificationLogOut,
    PreferenceOut,
    PreferenceUpdate,
    PushSubscribeRequest,
)

router = APIRouter()

_PREF_FIELDS = [
    "smsEnabled", "kakaoEnabled", "webPushEnabled",
    "onSubmit", "onApprove", "onReject", "onPaymentComplete",
]


def _pref_out(pref: NotificationPreference | None) -> PreferenceOut:
    if pref is None:  # 기본값 (모두 활성)
        return PreferenceOut(**{f: True for f in _PREF_FIELDS})
    return PreferenceOut(**{f: getattr(pref, f) for f in _PREF_FIELDS})


@router.get("/notifications/preferences", response_model=PreferenceOut)
async def get_preferences(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PreferenceOut:
    pref = (
        await session.execute(
            select(NotificationPreference).where(NotificationPreference.userId == user.id)
        )
    ).scalars().first()
    return _pref_out(pref)


@router.put("/notifications/preferences", response_model=PreferenceOut)
async def update_preferences(
    body: PreferenceUpdate,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> PreferenceOut:
    pref = (
        await session.execute(
            select(NotificationPreference).where(NotificationPreference.userId == user.id)
        )
    ).scalars().first()
    if pref is None:
        pref = NotificationPreference(tenantId=tenant_id, userId=user.id)
        session.add(pref)
    for f in _PREF_FIELDS:
        val = getattr(body, f)
        if val is not None:
            setattr(pref, f, val)
    await session.commit()
    await session.refresh(pref)
    return _pref_out(pref)


@router.get("/notifications/logs")
async def list_logs(
    tenant_id: str = Depends(require_tenant_id),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    # 본인 수신 알림만
    stmt = (
        select(NotificationLog)
        .where(NotificationLog.tenantId == tenant_id, NotificationLog.recipientName == user.username)
        .order_by(NotificationLog.createdAt.desc())
        .limit(100)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return {
        "logs": [
            NotificationLogOut(
                id=r.id, recipientName=r.recipientName, expenseId=r.expenseId,
                channel=r.channel, eventType=r.eventType, message=r.message,
                status=r.status, createdAt=r.createdAt,
            ).model_dump()
            for r in rows
        ]
    }


@router.post("/push/subscribe")
async def push_subscribe(
    body: PushSubscribeRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    # (userId, endpoint) 유니크 — 있으면 갱신
    existing = (
        await session.execute(
            select(PushSubscription).where(
                PushSubscription.userId == user.id, PushSubscription.endpoint == body.endpoint
            )
        )
    ).scalars().first()
    if existing is not None:
        existing.p256dh = body.p256dh
        existing.auth = body.auth
        existing.isActive = True
        existing.failedCount = 0
    else:
        session.add(
            PushSubscription(
                tenantId=tenant_id, userId=user.id, endpoint=body.endpoint,
                p256dh=body.p256dh, auth=body.auth,
                userAgent=body.userAgent, deviceName=body.deviceName,
            )
        )
    await session.commit()
    return {"success": True}


@router.delete("/push/subscribe")
async def push_unsubscribe(
    endpoint: str,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    sub = (
        await session.execute(
            select(PushSubscription).where(
                PushSubscription.userId == user.id, PushSubscription.endpoint == endpoint
            )
        )
    ).scalars().first()
    if sub is not None:
        sub.isActive = False
        await session.commit()
    return {"success": True}
