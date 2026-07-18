"""비동기 SQLAlchemy 엔진 — dialect(SQLite/Postgres)별 kwargs 분기.

spec_python_refactoring.md §5.2
"""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from expense_api.core.config.settings import settings


def make_async_url(url: str) -> str:
    """DATABASE_URL 을 비동기 드라이버 URL 로 정규화한다.

    Render/Neon 은 표준 `postgresql://` URL 을 주입하므로 그대로 쓰면
    create_async_engine 이 동기 드라이버(psycopg2)를 로드해 기동에 실패한다.
    asyncpg 드라이버를 명시하고, asyncpg 가 모르는 libpq 전용 쿼리 파라미터를
    변환(sslmode → ssl)·제거(channel_binding)한다.
    """
    if url.startswith("sqlite+aiosqlite"):
        return url
    if url.startswith("sqlite"):
        return url.replace("sqlite", "sqlite+aiosqlite", 1)
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    if not url.startswith("postgresql+asyncpg://"):
        return url

    parts = urlsplit(url)
    query = []
    for key, value in parse_qsl(parts.query):
        if key == "sslmode":
            query.append(("ssl", value))  # asyncpg 는 ssl= 로 동일 값을 받는다
        elif key == "channel_binding":
            continue  # asyncpg 미지원
        else:
            query.append((key, value))
    return urlunsplit(parts._replace(query=urlencode(query)))


def _engine_kwargs(url: str) -> dict:
    kw: dict = {"echo": False, "future": True}
    if url.startswith("sqlite"):
        # SQLite: 스레드 공유 허용 (FastAPI async 컨텍스트)
        kw["connect_args"] = {"check_same_thread": False}
    else:
        # Postgres: 실제 커넥션 풀
        kw["pool_pre_ping"] = True
        kw["pool_size"] = 5
        kw["max_overflow"] = 10
    return kw


_ASYNC_URL = make_async_url(settings.DATABASE_URL)
async_engine = create_async_engine(_ASYNC_URL, **_engine_kwargs(_ASYNC_URL))


# SQLite 는 기본적으로 FK 제약을 강제하지 않는다 → onDelete Cascade 를 위해 활성화
if settings.is_sqlite:

    @event.listens_for(async_engine.sync_engine, "connect")
    def _enable_sqlite_fk(dbapi_conn, _connection_record):  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


async_session_maker = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
