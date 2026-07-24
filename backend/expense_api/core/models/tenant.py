"""테넌트/슈퍼관리자 모델 (Prisma Tenant, SuperAdmin 이전).

컬럼명은 Prisma 스키마와 동일하게 camelCase 로 보존한다 (기존 데이터 호환, spec §4.1).
"""

from datetime import datetime

from sqlalchemy import JSON, Column, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.enums import OrgType, PlanType, pg_enum
from expense_api.core.models.ids import new_id, utcnow


class Tenant(SQLModel, table=True):
    __tablename__ = "Tenant"

    id: str = Field(default_factory=new_id, primary_key=True)

    # 기본 정보
    name: str
    subdomain: str = Field(index=True, unique=True)
    customDomain: str | None = Field(default=None, unique=True)

    # 조직 정보 (enum → String 저장, spec §4.3)
    orgType: str = Field(
        default=OrgType.CHURCH.value,
        sa_column=Column(pg_enum("OrgType"), nullable=False, server_default=OrgType.CHURCH.value),
    )
    description: str | None = None
    logoUrl: str | None = None

    # 요금제
    plan: str = Field(
        default=PlanType.FREE.value,
        sa_column=Column(pg_enum("PlanType"), nullable=False, server_default=PlanType.FREE.value),
    )
    planStartAt: datetime | None = None
    planEndAt: datetime | None = None

    # 사용량 제한
    maxUsers: int = 10
    maxStorageMB: int = 1024
    currentUsers: int = 0
    currentStorage: int = 0

    # 설정 (JSON)
    settings: dict | None = Field(default=None, sa_column=Column(JSON))

    # 🆕 기능 모듈 (spec §15.3) — 비어 있으면 orgType 프리셋으로 폴백
    enabledModules: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]")
    )

    # 상태
    isActive: bool = Field(default=True, index=True)
    suspendedAt: datetime | None = None
    suspendReason: str | None = None

    # 메타
    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class SuperAdmin(SQLModel, table=True):
    __tablename__ = "SuperAdmin"

    id: str = Field(default_factory=new_id, primary_key=True)
    email: str = Field(index=True, unique=True)
    password: str
    name: str
    isActive: bool = True

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class PlatformActivityLog(SQLModel, table=True):
    """플랫폼 관리 활동 로그 (lib/platform/activity-log.ts logPlatformActivity 이전)."""

    __tablename__ = "PlatformActivityLog"

    id: str = Field(default_factory=new_id, primary_key=True)

    superAdminId: str = Field(index=True)
    superAdminEmail: str  # 조회 편의를 위해 저장

    tenantId: str | None = Field(default=None, index=True)
    tenantName: str | None = None

    action: str = Field(index=True)  # CREATE_TENANT, UPDATE_TENANT, ...
    entityType: str
    entityId: str | None = None

    details: dict | None = Field(default=None, sa_column=Column(JSON))
    ipAddress: str | None = None
    userAgent: str | None = None

    createdAt: datetime = Field(
        default_factory=utcnow, index=True, sa_column_kwargs={"server_default": func.now()}
    )
