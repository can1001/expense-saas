"""RUNNING_ZONE 가드 — settings 로드보다 먼저 실행되어야 한다.

su-membership-backend/core/db/guard.py 패턴.
운영에서 실수로 SQLite/개발 설정으로 부팅하는 것을 원천 차단한다.
zone 은 파일(.env)이 아니라 실제 프로세스 환경변수로 명시해야 한다:

    RUNNING_ZONE=local uv run uvicorn main:app --reload
"""

import os
import sys

_VALID_ZONES = {"local", "prod"}


def require_running_zone() -> str:
    """RUNNING_ZONE 환경변수를 검증한다. 미설정/오류 시 프로세스를 종료한다."""
    zone = os.environ.get("RUNNING_ZONE")
    if zone is None:
        print(
            "FATAL: RUNNING_ZONE 이(가) 설정되지 않았습니다. (local | prod)\n"
            "  예) RUNNING_ZONE=local uv run uvicorn main:app --reload",
            file=sys.stderr,
        )
        sys.exit(1)
    if zone not in _VALID_ZONES:
        print(
            f"FATAL: 잘못된 RUNNING_ZONE={zone!r}. 허용값: {sorted(_VALID_ZONES)}",
            file=sys.stderr,
        )
        sys.exit(1)
    return zone
