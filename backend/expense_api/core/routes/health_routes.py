"""헬스체크 — 앱 생존 + DB 연결 확인."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.config.settings import settings
from expense_api.core.db.session import get_session

router = APIRouter()


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)) -> dict:
    """RUNNING_ZONE, DB dialect, DB 연결 상태를 반환한다."""
    db_ok = True
    try:
        await session.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False

    return {
        "status": "ok",
        "running_zone": settings.RUNNING_ZONE,
        "db_dialect": "sqlite" if settings.is_sqlite else "postgresql",
        "db_connected": db_ok,
    }
