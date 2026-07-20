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

    # 공유 기본 비밀번호(quick-register·대량 업로드·관리자 배정)로 생성된 계정은 true
    mustChangePassword: bool = False

    # 개별 권한 플래그 (역할과 별개)
    canRegisterUsers: bool = False

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class Membership(SQLModel, table=True):
    """사용자-테넌트 소속 (ARC-002 §2.2). User.tenantId(홈 테넌트)와 별개로 유지."""

    __tablename__ = "Membership"
    __table_args__ = (UniqueConstraint("userId", "tenantId", name="uq_membership_user_tenant"),)

    id: str = Field(default_factory=new_id, primary_key=True)

    userId: str = Field(foreign_key="User.id", ondelete="CASCADE", index=True)
    tenantId: str = Field(foreign_key="Tenant.id", index=True)

    role: str  # TENANT_ADMIN / MEMBER
    isDefault: bool = False

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class AuthAccount(SQLModel, table=True):
    """인증 수단 연결 (prisma AuthAccount 이전). 하나의 User에 복수 연결 가능(이메일+카카오)."""

    __tablename__ = "AuthAccount"
    __table_args__ = (
        UniqueConstraint("provider", "providerUserId", name="uq_authaccount_provider"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    userId: str = Field(foreign_key="User.id", ondelete="CASCADE", index=True)

    provider: str  # "kakao" | "email" | ...
    providerUserId: str  # 카카오 회원번호 또는 이메일 로그인 userid

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )


class Invitation(SQLModel, table=True):
    """초대 (prisma Invitation 이전). 초대 토큰이 본인 증명 — 계정 매칭에 email 을 쓰지 않는다."""

    __tablename__ = "Invitation"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str = Field(foreign_key="Tenant.id", index=True)

    email: str | None = None
    role: str = Field(default="MEMBER")  # 수락 시 Membership.role 로 복사
    token: str = Field(unique=True, index=True)
    expiresAt: datetime
    acceptedAt: datetime | None = None
    invitedById: str | None = None

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )


class UserSignature(SQLModel, table=True):
    """사용자 서명/도장 (prisma UserSignature 이전)."""

    __tablename__ = "UserSignature"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)  # 쿼리 최적화용 (관계 없음)

    userId: str = Field(foreign_key="User.id", ondelete="CASCADE", index=True)

    type: str  # "signature" | "stamp"
    name: str
    imageData: str = Field(sa_column=Column(Text()))  # base64 인코딩 이미지 (PNG)
    isDefault: bool = False

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
