"""Phase 0 스캐폴딩 검증 테스트.

- SQLite ↔ Postgres 스위칭 로직 (make_sync_url, zone별 기본 URL, dialect별 엔진 kwargs)
- JWT 발급/검증 라운드트립
라이브 PG 없이 스위칭 '코드 경로'를 커버한다. (라이브 PG 통합은 Docker 기동 시 별도)
"""

import os

from expense_api.core.db.migrations import make_sync_url


# ── make_sync_url: async 드라이버 → 동기 드라이버 (Alembic용) ──────────
def test_make_sync_url_sqlite():
    assert make_sync_url("sqlite+aiosqlite:///./dev.db") == "sqlite:///./dev.db"


def test_make_sync_url_postgres():
    # prod 경로: asyncpg → psycopg2 (postgresql)
    assert make_sync_url("postgresql+asyncpg://u:p@h:5432/db") == "postgresql://u:p@h:5432/db"


def test_make_sync_url_passthrough():
    assert make_sync_url("sqlite:///./x.db") == "sqlite:///./x.db"


# ── make_async_url: 표준 URL → 비동기 드라이버 (앱 엔진용) ──────────────
def test_make_async_url_plain_postgres():
    from expense_api.core.db.engine import make_async_url

    # prod 경로: Render/Neon 이 주입하는 표준 URL → asyncpg 명시
    assert (
        make_async_url("postgresql://u:p@h:5432/db")
        == "postgresql+asyncpg://u:p@h:5432/db"
    )
    # postgres:// 단축 스킴도 동일 처리
    assert make_async_url("postgres://u:p@h/db") == "postgresql+asyncpg://u:p@h/db"


def test_make_async_url_neon_query_params():
    from expense_api.core.db.engine import make_async_url

    # Neon URL: sslmode → ssl 변환, channel_binding 제거 (asyncpg 미지원)
    url = "postgresql://u:p@h/db?sslmode=require&channel_binding=require"
    assert make_async_url(url) == "postgresql+asyncpg://u:p@h/db?ssl=require"


def test_make_async_url_passthrough():
    from expense_api.core.db.engine import make_async_url

    assert make_async_url("sqlite+aiosqlite:///./dev.db") == "sqlite+aiosqlite:///./dev.db"
    assert (
        make_async_url("postgresql+asyncpg://u:p@h/db") == "postgresql+asyncpg://u:p@h/db"
    )


def test_make_async_url_sqlite_plain():
    from expense_api.core.db.engine import make_async_url

    assert make_async_url("sqlite:///./x.db") == "sqlite+aiosqlite:///./x.db"


# ── zone 조건부 기본 DATABASE_URL ────────────────────────────────────
def test_zone_conditional_default_url(monkeypatch):
    from expense_api.core.config.settings import _default_database_url

    monkeypatch.setenv("RUNNING_ZONE", "local")
    assert _default_database_url().startswith("sqlite+aiosqlite")

    monkeypatch.setenv("RUNNING_ZONE", "prod")
    assert _default_database_url().startswith("postgresql+asyncpg")


def test_env_file_selection(monkeypatch):
    from expense_api.core.config.settings import _env_file

    monkeypatch.setenv("RUNNING_ZONE", "local")
    assert _env_file() == ".env.local"
    monkeypatch.setenv("RUNNING_ZONE", "prod")
    assert _env_file() == ".env.prod"


# ── dialect별 엔진 kwargs ────────────────────────────────────────────
def test_engine_kwargs_branch():
    from expense_api.core.db.engine import _engine_kwargs

    sqlite_kw = _engine_kwargs("sqlite+aiosqlite:///./dev.db")
    assert sqlite_kw["connect_args"] == {"check_same_thread": False}
    assert "pool_size" not in sqlite_kw

    pg_kw = _engine_kwargs("postgresql+asyncpg://u:p@h/db")
    assert pg_kw["pool_pre_ping"] is True
    assert pg_kw["pool_size"] == 5
    assert "connect_args" not in pg_kw


# ── guard ────────────────────────────────────────────────────────────
def test_guard_rejects_missing_zone(monkeypatch):
    import pytest

    from expense_api.core.db.guard import require_running_zone

    monkeypatch.delenv("RUNNING_ZONE", raising=False)
    with pytest.raises(SystemExit):
        require_running_zone()


def test_guard_rejects_invalid_zone(monkeypatch):
    import pytest

    from expense_api.core.db.guard import require_running_zone

    monkeypatch.setenv("RUNNING_ZONE", "staging")
    with pytest.raises(SystemExit):
        require_running_zone()


def test_guard_accepts_valid_zone(monkeypatch):
    from expense_api.core.db.guard import require_running_zone

    monkeypatch.setenv("RUNNING_ZONE", "local")
    assert require_running_zone() == "local"


# ── JWT 라운드트립 ───────────────────────────────────────────────────
def test_jwt_roundtrip():
    os.environ.setdefault("RUNNING_ZONE", "local")
    from expense_api.core.security.jwt import create_access_token, decode_token

    token = create_access_token("alice", extra={"role": "admin"})
    claims = decode_token(token)
    assert claims["sub"] == "alice"
    assert claims["type"] == "access"
    assert claims["role"] == "admin"
