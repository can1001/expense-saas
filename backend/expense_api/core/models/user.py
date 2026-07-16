"""사용자/역할 모델 (Prisma User, Role, UserYearRole 이전).

- 컬럼명 camelCase 보존 (spec §4.1)
- Role.permissions: Prisma String[] → JSON 컬럼 (SQLite 배열 미지원, spec §4.2)
- FK 는 Phase 1 에 존재하는 테이블(Tenant/Role/User)에만 건다.
  departmentId 등은 Phase 2 모델 도입 시 FK 로 승격.
"""

from datetime import datetime

from sqlalchemy import ARRAY, JSON, Column, Text, UniqueConstraint, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.ids import new_id, utcnow


class Role(SQLModel, table=True):
    __tablename__ = "Role"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, foreign_key="Tenant.id", index=True)

    code: str = Field(index=True)  # admin, finance_head ... (테넌트 내 유니크)
    name: str
    description: str | None = None
    stepNumber: int | None = None
    sortOrder: int = 0
    isActive: bool = True

    # RBAC permission 코드 배열 (비면 코드 프리셋으로 폴백 — permissions.py)
    # dialect-variant: Postgres=text[](Prisma String[] 그대로 읽기), SQLite=JSON.
    # 공유 Neon(dual-run)에서 Prisma 가 만든 text[] 컬럼을 FastAPI 가 읽을 수 있게 한다.
    permissions: list[str] = Field(
        default_factory=list,
        sa_column=Column(
            JSON().with_variant(ARRAY(Text()), "postgresql"),
            nullable=False,
            server_default="[]",
        ),
    )

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class User(SQLModel, table=True):
    __tablename__ = "User"
    __table_args__ = (UniqueConstraint("tenantId", "userid", name="uq_user_tenant_userid"),)

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, foreign_key="Tenant.id", index=True)

    userid: str  # 로그인 아이디 (테넌트 내 유니크)
    username: str  # 표시 이름
    password: str | None = None  # 해시된 비밀번호
    role: str = Field(default="user", index=True)  # 역할 코드 (Role.code 참조)
    roleId: str | None = Field(default=None, foreign_key="Role.id")
    department: str | None = None
    isActive: bool = Field(default=True, index=True)
    phoneNumber: str | None = None

    # 개별 권한 플래그 (역할과 별개)
    canRegisterUsers: bool = False

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class UserYearRole(SQLModel, table=True):
    __tablename__ = "UserYearRole"
    __table_args__ = (
        UniqueConstraint("userId", "year", "departmentId", "role", name="uq_useryearrole"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용 (관계 없음)

    userId: str = Field(foreign_key="User.id", ondelete="CASCADE", index=True)
    year: int = Field(index=True)
    role: str = Field(index=True)  # 역할 코드
    roleId: str | None = Field(default=None, foreign_key="Role.id")
    departmentId: str | None = None  # Phase 2 에서 Department FK 로 승격

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
