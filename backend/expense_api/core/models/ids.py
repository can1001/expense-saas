"""Prisma cuid() 호환 ID 생성.

Prisma 는 애플리케이션 레벨에서 cuid 를 생성한다. 기존 데이터의 ID 값과
포맷을 맞추기 위해 uuid 대신 cuid2 를 사용한다. (spec §4.2)
"""

from datetime import datetime, timezone

from cuid2 import Cuid

_cuid = Cuid()


def new_id() -> str:
    return _cuid.generate()


def utcnow() -> datetime:
    """naive UTC now (datetime.utcnow() deprecated 대체).

    공유 Neon(dual-run)의 시간 컬럼은 Prisma 가 만든 `timestamp without time zone`(naive)
    이다. tz-aware datetime 을 바인드하면 asyncpg 가 `can't subtract offset-naive and
    offset-aware`(DataError)로 INSERT 를 거부한다. 또한 asyncpg 는 naive 컬럼을 naive 로
    읽으므로, 서비스단 비교(`expiresAt < utcnow()` 등)도 naive 로 맞춰야 TypeError 가 없다.
    UTC 기준 시각을 유지하되 tzinfo 만 제거한다 (구 `datetime.utcnow()` 와 동일 의미).
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
