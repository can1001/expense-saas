"""헌금 모델 (Prisma Offering 이전, D5).

컬럼명 camelCase 보존, tenantId 스코프. type enum은 String 저장(다른 도메인과 동일 관례).
date 는 Prisma @db.Date(시간 없는 날짜)이므로 SQLAlchemy Date 타입으로 선언한다.
"""

from datetime import date as PyDate
from datetime import datetime

from sqlalchemy import Date, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.enums import OfferingType, pg_enum
from expense_api.core.models.ids import new_id, utcnow


class Offering(SQLModel, table=True):
    __tablename__ = "Offering"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    date: PyDate = Field(sa_type=Date, index=True)
    name: str = Field(index=True)
    type: str = Field(default=OfferingType.OTHER.value, index=True, sa_type=pg_enum("OfferingType"))
    amount: int
    memo: str | None = None

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}, index=True
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
