"""AuthAccount 서비스 (Next lib/services/auth-account.ts 이전, A6).

인증("누구인지")과 소속(Membership)의 분리 — AuthAccount는 인증 수단 연결만 담당한다.
조회는 테넌트를 가로지르므로 tenantId 스코프를 적용하지 않는다(공통 원칙 2 예외 — 인증 자체는
테넌트 컨텍스트 이전 단계).

원칙: 카카오 이메일 기반 자동 병합 금지 — 연결은 본인 증명(로그인 세션 또는 초대 토큰)이
있는 경로에서만 link_auth_account 로 수행한다.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.models.user import AuthAccount, User

AUTH_PROVIDERS = ("email", "kakao", "naver", "google")


class AuthAccountNotLinkedError(Exception):
    """해제 대상 연결이 없음 — 라우트에서 404로 매핑."""


class LastAuthMethodError(Exception):
    """마지막 로그인 수단 해제 시도 — 라우트에서 400으로 매핑."""


class AuthAccountConflictError(Exception):
    """인증 수단 연결 충돌 — 라우트에서 409로 매핑.

    이미 다른 유저에 연결됐거나(계정 탈취 방지) 같은 provider가 이미 연결된 경우.
    """


async def find_user_by_provider(
    session: AsyncSession, provider: str, provider_user_id: str
) -> User | None:
    """(provider, providerUserId)로 연결된 유저 조회 — 연결이 없으면 None."""
    account = (
        await session.execute(
            select(AuthAccount).where(
                AuthAccount.provider == provider, AuthAccount.providerUserId == provider_user_id
            )
        )
    ).scalars().first()
    if account is None:
        return None
    return await session.get(User, account.userId)


async def get_auth_account(
    session: AsyncSession, user_id: str, provider: str
) -> AuthAccount | None:
    """유저의 특정 provider 연결 조회 — 연결 상태 표시와 해제 검증에 사용."""
    return (
        await session.execute(
            select(AuthAccount).where(
                AuthAccount.userId == user_id, AuthAccount.provider == provider
            )
        )
    ).scalars().first()


async def link_auth_account(
    session: AsyncSession, user_id: str, provider: str, provider_user_id: str
) -> AuthAccount:
    """유저에 인증 수단 연결 — 이미 같은 유저에 연결돼 있으면 기존 연결 반환(멱등),
    다른 유저에 연결돼 있으면 거부한다(계정 탈취 방지)."""
    existing = (
        await session.execute(
            select(AuthAccount).where(
                AuthAccount.provider == provider, AuthAccount.providerUserId == provider_user_id
            )
        )
    ).scalars().first()
    if existing:
        if existing.userId != user_id:
            raise AuthAccountConflictError("이미 다른 계정에 연결된 인증 수단입니다.")
        return existing

    # provider당 1개만 연결 — 같은 provider의 다른 계정이 이미 있으면 거부한다.
    provider_linked = (
        await session.execute(
            select(AuthAccount).where(
                AuthAccount.userId == user_id, AuthAccount.provider == provider
            )
        )
    ).scalars().first()
    if provider_linked:
        raise AuthAccountConflictError(
            "이미 연결된 인증 수단이 있습니다. 기존 연결을 해제한 후 다시 시도해주세요."
        )

    account = AuthAccount(userId=user_id, provider=provider, providerUserId=provider_user_id)
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return account


async def unlink_auth_account(session: AsyncSession, user_id: str, provider: str) -> None:
    """인증 수단 연결 해제 — 마지막 로그인 수단이면 거부한다.

    "마지막 수단" 판정: 비밀번호(이메일 로그인)도 없고 다른 provider 연결도 없는 경우.
    """
    account = await get_auth_account(session, user_id, provider)
    if account is None:
        raise AuthAccountNotLinkedError("연결된 인증 수단이 없습니다.")

    user = await session.get(User, user_id)
    other_account_count = (
        await session.execute(
            select(func.count())
            .select_from(AuthAccount)
            .where(AuthAccount.userId == user_id, AuthAccount.id != account.id)
        )
    ).scalar_one()

    if not (user and user.password) and other_account_count == 0:
        raise LastAuthMethodError(
            "마지막 로그인 수단은 해제할 수 없습니다. 비밀번호를 먼저 설정해주세요."
        )

    await session.delete(account)
    await session.commit()
