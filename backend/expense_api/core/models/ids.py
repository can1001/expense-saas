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
    """timezone-aware UTC now (datetime.utcnow() deprecated 대체)."""
    return datetime.now(timezone.utc)
