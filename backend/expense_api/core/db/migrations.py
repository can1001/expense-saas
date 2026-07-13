"""Alembic 마이그레이션 유틸.

- make_sync_url(): async 드라이버 URL → 동기 드라이버 URL 변환 (Alembic 은 동기 실행)
- run_migrations_async(): 앱 기동 시 `alembic upgrade head` 를 스레드에서 실행
(spec_python_refactoring.md §5.3)
"""

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config

# backend/ 루트 (이 파일: backend/expense_api/core/db/migrations.py → parents[3])
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"


def make_sync_url(url: str) -> str:
    """비동기 드라이버 URL 을 Alembic 용 동기 드라이버 URL 로 변환한다."""
    if url.startswith("sqlite+aiosqlite"):
        return url.replace("sqlite+aiosqlite", "sqlite", 1)
    if url.startswith("postgresql+asyncpg"):
        return url.replace("postgresql+asyncpg", "postgresql", 1)  # → psycopg2
    return url


def _alembic_config() -> Config:
    cfg = Config(str(_ALEMBIC_INI))
    # 스크립트 위치를 절대경로로 고정 (CWD 무관하게 동작)
    cfg.set_main_option("script_location", str(_BACKEND_ROOT / "alembic"))
    return cfg


def run_migrations_sync() -> None:
    """동기 컨텍스트에서 alembic upgrade head."""
    command.upgrade(_alembic_config(), "head")


async def run_migrations_async() -> None:
    """앱 lifespan 에서 호출. 블로킹 Alembic 을 스레드로 위임한다."""
    await asyncio.to_thread(run_migrations_sync)
