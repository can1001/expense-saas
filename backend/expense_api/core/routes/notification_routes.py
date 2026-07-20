"""알림 라우트 — 선호 조회/수정, 알림 로그, 웹푸시 구독·발송 이력. (app/api/push, mypage/notifications 이전)"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.config.settings import settings
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.expense import Expense
from expense_api.core.models.notification import (
    NotificationLog,
    NotificationPreference,
    PushSubscription,
    WebPushLog,
)
from expense_api.core.schemas.notification import (
    NotificationLogOut,
    PreferenceOut,
    PreferenceUpdate,
    PushHistoryExpenseOut,
    PushHistoryLogOut,
    PushSubscribeRequest,
    PushUnsubscribeRequest,
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


@router.get("/push/vapid-public-key")
async def get_vapid_public_key() -> dict:
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="VAPID 키가 설정되지 않았습니다.")
    return {"publicKey": settings.VAPID_PUBLIC_KEY}


@router.post("/push/subscribe")
async def push_subscribe(
    body: PushSubscribeRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    sub = body.subscription
    if sub is None or not sub.endpoint or sub.keys is None or not sub.keys.p256dh or not sub.keys.auth:
        raise HTTPException(status_code=400, detail="유효하지 않은 구독 정보입니다.")

    user_agent = request.headers.get("user-agent")

    existing = (
        await session.execute(
            select(PushSubscription).where(
                PushSubscription.userId == user.id, PushSubscription.endpoint == sub.endpoint
            )
        )
    ).scalars().first()
    if existing is not None:
        existing.p256dh = sub.keys.p256dh
        existing.auth = sub.keys.auth
        existing.userAgent = user_agent
        existing.deviceName = body.deviceName
        existing.isActive = True
        existing.failedCount = 0
        await session.commit()
        subscription_id = existing.id
    else:
        created = PushSubscription(
            tenantId=tenant_id, userId=user.id, endpoint=sub.endpoint,
            p256dh=sub.keys.p256dh, auth=sub.keys.auth,
            userAgent=user_agent, deviceName=body.deviceName,
        )
        session.add(created)
        await session.commit()
        subscription_id = created.id

    return {"success": True, "subscriptionId": subscription_id}


@router.post("/push/unsubscribe")
async def push_unsubscribe(
    body: PushUnsubscribeRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.all:
        await session.execute(delete(PushSubscription).where(PushSubscription.userId == user.id))
        await session.commit()
        return {"success": True, "message": "모든 구독이 해제되었습니다."}

    if not body.endpoint:
        raise HTTPException(status_code=400, detail="endpoint가 필요합니다.")

    await session.execute(
        delete(PushSubscription).where(
            PushSubscription.userId == user.id, PushSubscription.endpoint == body.endpoint
        )
    )
    await session.commit()
    return {"success": True, "message": "구독이 해제되었습니다."}


@router.get("/push/history")
async def push_history(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    eventType: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    page = max(1, page)
    limit = min(100, max(1, limit))

    conditions = [WebPushLog.userId == user.id]
    if eventType:
        conditions.append(WebPushLog.eventType == eventType)
    if status:
        conditions.append(WebPushLog.status == status)

    total = (
        await session.execute(select(func.count()).select_from(WebPushLog).where(*conditions))
    ).scalar_one()

    rows = (
        await session.execute(
            select(WebPushLog)
            .where(*conditions)
            .order_by(WebPushLog.createdAt.desc())
            .limit(limit)
            .offset((page - 1) * limit)
        )
    ).scalars().all()

    expense_ids = [r.expenseId for r in rows if r.expenseId]
    expenses: dict[str, Expense] = {}
    if expense_ids:
        expense_rows = (
            await session.execute(select(Expense).where(Expense.id.in_(expense_ids)))
        ).scalars().all()
        expenses = {e.id: e for e in expense_rows}

    data = [
        PushHistoryLogOut(
            id=r.id, eventType=r.eventType, title=r.title, body=r.body, url=r.url,
            status=r.status, errorMessage=r.errorMessage, sentAt=r.sentAt, createdAt=r.createdAt,
            expenseId=r.expenseId,
            expense=(
                PushHistoryExpenseOut(
                    id=expenses[r.expenseId].id,
                    applicantName=expenses[r.expenseId].applicantName,
                    requestAmount=expenses[r.expenseId].requestAmount,
                    status=expenses[r.expenseId].status,
                )
                if r.expenseId and r.expenseId in expenses
                else None
            ),
        ).model_dump()
        for r in rows
    ]

    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": (total + limit - 1) // limit if limit else 0,
    }
