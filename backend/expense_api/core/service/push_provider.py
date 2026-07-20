"""웹 푸시/FCM 실발송 어댑터 (Next lib/services/notification/{web-push,fcm}-provider.ts 이전, N2).

pywebpush/firebase-admin 실호출은 라우트에서 직접 하지 않고 이 모듈을 거치게 해
테스트에서 monkeypatch 로 대체하기 쉽게 한다. (cloudinary_service.py 와 동일 패턴)
"""

import json
from asyncio import to_thread

from expense_api.core.config.settings import settings


def is_web_push_configured() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def is_fcm_configured() -> bool:
    return bool(settings.FIREBASE_SERVICE_ACCOUNT_JSON)


class WebPushSendError(Exception):
    """웹 푸시 발송 실패. expired=True 면 구독이 만료(410/404)된 것으로 간주해 비활성화."""

    def __init__(self, message: str, *, expired: bool = False) -> None:
        super().__init__(message)
        self.expired = expired


class FcmSendError(Exception):
    """FCM 발송 실패. invalid_token=True 면 토큰이 무효화된 것으로 간주해 비활성화."""

    def __init__(self, message: str, *, invalid_token: bool = False) -> None:
        super().__init__(message)
        self.invalid_token = invalid_token


def _send_web_push_sync(endpoint: str, p256dh: str, auth: str, payload: dict) -> None:
    from pywebpush import WebPushException, webpush

    subscription_info = {"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}}
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
        )
    except WebPushException as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        raise WebPushSendError(str(exc), expired=status_code in (404, 410)) from exc


async def send_web_push(endpoint: str, p256dh: str, auth: str, payload: dict) -> None:
    await to_thread(_send_web_push_sync, endpoint, p256dh, auth, payload)


_fcm_app = None


def _get_fcm_app():
    global _fcm_app
    if _fcm_app is not None:
        return _fcm_app
    if not is_fcm_configured():
        return None

    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        _fcm_app = firebase_admin.get_app()
    else:
        cred = credentials.Certificate(json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON))
        _fcm_app = firebase_admin.initialize_app(cred)
    return _fcm_app


def _send_fcm_sync(token: str, title: str, body: str, data: dict[str, str]) -> None:
    from firebase_admin import messaging
    from firebase_admin.exceptions import FirebaseError

    app = _get_fcm_app()
    if app is None:
        raise FcmSendError("admin 초기화 실패")

    message = messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body),
        data=data,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id="expense-default", sound="default", click_action="FCM_PLUGIN_ACTIVITY"
            ),
        ),
    )
    try:
        messaging.send(message, app=app)
    except FirebaseError as exc:
        code = getattr(exc, "code", None)
        raise FcmSendError(
            str(exc), invalid_token=code in ("NOT_FOUND", "INVALID_ARGUMENT", "UNREGISTERED")
        ) from exc


async def send_fcm(token: str, title: str, body: str, data: dict[str, str]) -> None:
    await to_thread(_send_fcm_sync, token, title, body, data)
