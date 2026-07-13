"""로그인 브루트포스 방지 — IP+userid 기준 인메모리 실패 카운터.
(lib/rate-limit.ts 이전)

⚠️ 인메모리 = 단일 프로세스 스코프. 멀티 인스턴스 배포에서는 Redis 백엔드로 교체 필요
(spec §Environment 의 REDIS_URL 참조). 스켈레톤 단계 구현.
"""

import time
from dataclasses import dataclass, field

_MAX_ATTEMPTS = 5  # 이 횟수 이상 실패 시 차단
_WINDOW_SECONDS = 15 * 60  # 실패 집계 창 (15분)


@dataclass
class _Bucket:
    fails: list[float] = field(default_factory=list)


_store: dict[str, _Bucket] = {}


def _now() -> float:
    return time.time()


def get_rate_limit_key(ip: str, userid: str) -> str:
    return f"{ip}:{userid.lower()}"


def check_login_rate_limit(key: str) -> tuple[bool, int]:
    """(허용여부, retry_after_seconds). 차단이면 (False, N)."""
    bucket = _store.get(key)
    if not bucket:
        return True, 0
    cutoff = _now() - _WINDOW_SECONDS
    bucket.fails = [t for t in bucket.fails if t > cutoff]
    if len(bucket.fails) >= _MAX_ATTEMPTS:
        retry = int(bucket.fails[0] + _WINDOW_SECONDS - _now())
        return False, max(retry, 1)
    return True, 0


def record_login_failure(key: str) -> None:
    _store.setdefault(key, _Bucket()).fails.append(_now())


def clear_login_attempts(key: str) -> None:
    _store.pop(key, None)


def _reset_all() -> None:
    """테스트 전용 — 상태 초기화."""
    _store.clear()
