"""알림 라우트 — 선호 조회/수정, 알림 로그, 웹푸시·FCM 구독·발송 이력. (app/api/push, mypage/notifications 이전)"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.config.settings import settings
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.expense import Expense
from expense_api.core.models.ids import utcnow
from expense_api.core.models.notification import (
    FcmLog,
    FcmToken,
    NotificationLog,
    NotificationPreference,
    PushSubscription,
    WebPushLog,
)
from expense_api.core.schemas.notification import (
    FcmSubscribeRequest,
    FcmUnsubscribeRequest,
    NotificationLogOut,
    PreferenceOut,
    PreferenceUpdate,
    PushHistoryExpenseOut,
    PushHistoryLogOut,
    PushSubscribeRequest,
    PushUnsubscribeRequest,
)
from expense_api.core.service import push_provider

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


@router.post("/push/test")
async def push_test(
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not push_provider.is_web_push_configured():
        raise HTTPException(status_code=503, detail="VAPID 키가 설정되지 않아 푸시 알림을 사용할 수 없습니다.")

    subs = (
        await session.execute(
            select(PushSubscription).where(PushSubscription.userId == user.id, PushSubscription.isActive.is_(True))
        )
    ).scalars().all()

    if not subs:
        return JSONResponse(
            {"error": "등록된 푸시 구독이 없습니다. 먼저 알림을 구독해주세요.", "code": "NO_SUBSCRIPTION"},
            status_code=404,
        )

    title = "테스트 알림"
    body_text = "지출결의서 웹 푸시 알림이 정상적으로 작동합니다!"
    payload = {
        "title": title,
        "body": body_text,
        "icon": "/logo.png",
        "badge": "/logo.png",
        "tag": "test-notification",
        "url": "/expenses",
        "actions": [{"action": "open", "title": "열기"}, {"action": "close", "title": "닫기"}],
    }

    results = []
    for sub in subs:
        try:
            await push_provider.send_web_push(sub.endpoint, sub.p256dh, sub.auth, payload)
        except push_provider.WebPushSendError as exc:
            session.add(
                WebPushLog(
                    tenantId=tenant_id, userId=user.id, eventType="SUBMIT",
                    title=title, body=body_text, url="/expenses",
                    status="FAILED", errorMessage=str(exc),
                )
            )
            if exc.expired:
                sub.isActive = False
            else:
                sub.failedCount += 1
                if sub.failedCount >= 5:
                    sub.isActive = False
            await session.commit()
            results.append({"success": False, "subscriptionId": sub.id, "error": str(exc)})
            continue

        session.add(
            WebPushLog(
                tenantId=tenant_id, userId=user.id, eventType="SUBMIT",
                title=title, body=body_text, url="/expenses",
                status="SENT", sentAt=utcnow(),
            )
        )
        sub.failedCount = 0
        await session.commit()
        results.append({"success": True, "subscriptionId": sub.id})

    success_count = sum(1 for r in results if r["success"])
    fail_count = len(results) - success_count

    if success_count == 0:
        return JSONResponse(
            {
                "error": "푸시 알림 발송에 실패했습니다.",
                "details": [r["error"] for r in results if r.get("error")],
            },
            status_code=500,
        )

    return {
        "success": True,
        "message": f"테스트 푸시 알림이 발송되었습니다. (성공: {success_count}, 실패: {fail_count})",
        "results": results,
    }


@router.post("/push/fcm-subscribe")
async def fcm_subscribe(
    body: FcmSubscribeRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not isinstance(body.token, str) or len(body.token) < 32:
        raise HTTPException(status_code=400, detail="유효하지 않은 FCM 토큰입니다.")
    if body.platform not in ("android", "ios"):
        raise HTTPException(status_code=400, detail='platform은 "android" 또는 "ios" 여야 합니다.')

    # 토큰(FcmToken.token)은 기기 식별자로 전역 유일 — 다른 유저 소유 토큰의 재할당은 거부한다.
    existing = (
        await session.execute(select(FcmToken).where(FcmToken.token == body.token))
    ).scalars().first()

    if existing is not None and existing.userId != user.id:
        raise HTTPException(status_code=500, detail="FCM 토큰 등록에 실패했습니다.")

    if existing is not None:
        existing.userId = user.id
        existing.tenantId = user.tenantId
        existing.platform = body.platform
        existing.deviceModel = body.deviceModel
        existing.appVersion = body.appVersion
        existing.isActive = True
        existing.failedCount = 0
        existing.lastUsedAt = utcnow()
        await session.commit()
        token_id = existing.id
    else:
        created = FcmToken(
            tenantId=user.tenantId, userId=user.id, token=body.token, platform=body.platform,
            deviceModel=body.deviceModel, appVersion=body.appVersion,
        )
        session.add(created)
        await session.commit()
        token_id = created.id

    return {"success": True, "tokenId": token_id}


@router.delete("/push/fcm-subscribe")
async def fcm_unsubscribe(
    body: FcmUnsubscribeRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not isinstance(body.token, str):
        raise HTTPException(status_code=400, detail="유효하지 않은 토큰입니다.")

    await session.execute(delete(FcmToken).where(FcmToken.userId == user.id, FcmToken.token == body.token))
    await session.commit()
    return {"success": True}


@router.post("/push/fcm-test")
async def fcm_test(
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not push_provider.is_fcm_configured():
        raise HTTPException(
            status_code=503,
            detail="FIREBASE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않아 FCM을 사용할 수 없습니다.",
        )

    tokens = (
        await session.execute(select(FcmToken).where(FcmToken.userId == user.id, FcmToken.isActive.is_(True)))
    ).scalars().all()

    if not tokens:
        return JSONResponse(
            {
                "error": "등록된 FCM 토큰이 없습니다. 모바일 앱에서 먼저 알림을 등록해주세요.",
                "code": "NO_FCM_TOKEN",
            },
            status_code=404,
        )

    title = "테스트 알림 (앱)"
    body_text = "FCM을 통한 모바일 앱 푸시 알림이 정상 작동합니다!"
    data = {"eventType": "SUBMIT", "url": "/expenses", "tag": "fcm-test"}

    results = []
    for tok in tokens:
        try:
            await push_provider.send_fcm(tok.token, title, body_text, dict(data))
        except push_provider.FcmSendError as exc:
            session.add(
                FcmLog(
                    tenantId=tenant_id, userId=user.id, eventType="SUBMIT",
                    title=title, body=body_text, url="/expenses",
                    status="FAILED", errorMessage=str(exc),
                )
            )
            if exc.invalid_token:
                tok.isActive = False
            else:
                tok.failedCount += 1
                if tok.failedCount >= 5:
                    tok.isActive = False
            await session.commit()
            results.append({"success": False, "tokenId": tok.id, "error": str(exc)})
            continue

        session.add(
            FcmLog(
                tenantId=tenant_id, userId=user.id, eventType="SUBMIT",
                title=title, body=body_text, url="/expenses",
                status="SENT", sentAt=utcnow(),
            )
        )
        tok.failedCount = 0
        tok.lastUsedAt = utcnow()
        await session.commit()
        results.append({"success": True, "tokenId": tok.id})

    success_count = sum(1 for r in results if r["success"])
    fail_count = len(results) - success_count

    if success_count == 0:
        return JSONResponse(
            {
                "error": "FCM 발송에 실패했습니다.",
                "details": [r["error"] for r in results if r.get("error")],
            },
            status_code=500,
        )

    return {
        "success": True,
        "message": f"FCM 테스트 알림이 발송되었습니다. (성공: {success_count}, 실패: {fail_count})",
        "results": results,
    }
