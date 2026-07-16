"""공용 테스트 픽스처.

session: 인메모리 SQLite + **FK 강제(PRAGMA foreign_keys=ON)**.
실앱과 동일하게 FK를 강제해, 삭제 순서/CASCADE 관련 버그를 테스트가 잡도록 한다.
(리뷰에서 발견된 FK 미강제로 인한 잠복 버그 재발 방지)
"""

import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401  (모든 모델 로드 → metadata)


def _make_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _fk_on(dbapi_conn, _rec):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    return engine


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = _make_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()
