"""요청 스코프 DB 세션 의존성."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.engine import async_session_maker


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 의존성: 요청당 하나의 AsyncSession 을 yield 한다."""
    async with async_session_maker() as session:
        yield session
