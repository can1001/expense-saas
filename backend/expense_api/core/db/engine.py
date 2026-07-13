"""비동기 SQLAlchemy 엔진 — dialect(SQLite/Postgres)별 kwargs 분기.

spec_python_refactoring.md §5.2
"""

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from expense_api.core.config.settings import settings


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


async_engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs(settings.DATABASE_URL))


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
