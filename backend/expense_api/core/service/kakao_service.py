"""카카오 인증 서비스 (Next lib/services/kakao.ts 이전, A6).

클라이언트가 보낸 카카오 토큰을 그대로 신뢰하지 않고, 반드시 서버에서
kapi.kakao.com 으로 검증한다. 검증 후에는 기존 구조 그대로 자체 JWT 를 발급한다
(카카오 토큰은 "누구인지" 확인에만 쓰고 세션으로 쓰지 않는다).

stdlib(urllib) 로 호출한다 — httpx 는 dev 전용 의존성(uv sync --no-dev 로 운영 배포 시
제외)이라 신규 런타임 의존성 추가 없이 kapi 호출을 구현하기 위함.
"""

import json
import urllib.error
import urllib.request
from asyncio import to_thread

from expense_api.core.config.settings import settings

KAPI_USER_ME_URL = "https://kapi.kakao.com/v2/user/me"


class KakaoConfigError(Exception):
    """카카오 연동 미설정(환경변수 없음) — 라우트에서 503으로 매핑."""


class KakaoTokenError(Exception):
    """카카오 토큰 검증 실패(만료·위조·응답 이상) — 라우트에서 401로 매핑."""


def is_kakao_configured() -> bool:
    return bool(settings.KAKAO_REST_API_KEY)


def is_kakao_oidc_enabled() -> bool:
    return settings.KAKAO_USE_OIDC


def _fetch_profile(kakao_access_token: str) -> dict:
    request = urllib.request.Request(
        KAPI_USER_ME_URL,
        headers={"Authorization": f"Bearer {kakao_access_token}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as resp:  # noqa: S310
            return json.loads(resp.read())
    except urllib.error.URLError as e:
        raise KakaoTokenError("카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.") from e


async def verify_kakao_access_token(kakao_access_token: str) -> str:
    """카카오 액세스 토큰을 kapi 에서 검증하고 카카오 회원번호(providerUserId)를 반환한다.

    검증 실패 시 KakaoTokenError — 호출측은 자체 토큰을 발급하면 안 된다.
    """
    if not is_kakao_configured():
        raise KakaoConfigError("카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.")

    profile = await to_thread(_fetch_profile, kakao_access_token)

    provider_user_id = profile.get("id")
    if provider_user_id is None:
        raise KakaoTokenError("카카오 회원 정보를 확인할 수 없습니다.")

    # 카카오 회원번호는 숫자로 오지만 AuthAccount.providerUserId는 String — 문자열로 통일
    return str(provider_user_id)
