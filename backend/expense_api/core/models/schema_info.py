"""Phase 0 스캐폴딩용 최소 메타 테이블.

목적: 모델 → Alembic autogenerate → upgrade → (SQLite/PG) 실제 테이블 생성까지
파이프라인이 end-to-end 로 동작함을 검증하기 위한 것.
Phase 1 에서 실제 도메인 모델(Tenant/User/...)이 추가되면 이 파일은 유지하거나 제거한다.
"""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import Field, SQLModel

from expense_api.core.models.ids import utcnow


class SchemaInfo(SQLModel, table=True):
    __tablename__ = "SchemaInfo"

    id: int | None = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    value: str
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now()},
    )
