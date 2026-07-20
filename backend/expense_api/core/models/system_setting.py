"""시스템 설정 모델 (Prisma SystemSetting 이전, B6).

컬럼명 camelCase 보존, tenantId 스코프. value 는 JSON 직렬화된 문자열로 저장.
"""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import Field, SQLModel

from expense_api.core.models.ids import new_id, utcnow


class SystemSetting(SQLModel, table=True):
    __tablename__ = "SystemSetting"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    key: str = Field(index=True)
    value: str
    description: str | None = None

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
