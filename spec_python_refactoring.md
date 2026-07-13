# SPEC: Python 백엔드 분리 & 플랫폼화 리팩토링

> **목표**: `expense-saas`(현재 Next.js 모놀리스 + Prisma/PostgreSQL)를
> `su-member` 프로젝트처럼 **Python(FastAPI) 백엔드 + 프론트엔드 분리** 구조로 전환하고,
> **로컬/개발 DB는 SQLite, 운영 DB는 PostgreSQL**을 `RUNNING_ZONE` 방식으로 스위칭한다.

- **작성일**: 2026-07-13
- **참조 아키텍처**: `/Users/wandosea/Documents/GitHub/su-member/` (FastAPI + SQLModel + Alembic + uv)
- **프론트엔드 전략(결정됨)**: **기존 Next.js 프론트엔드 유지**. Next.js API Routes(`app/api/**`)만 FastAPI로 이전하고, 프론트엔드는 API 클라이언트의 baseURL만 Python 백엔드로 교체한다. PWA·SSR·모바일 자산은 보존한다.
- **상태**: Draft (구현 착수 전 리뷰 대상)

---

## 0. 이 문서를 읽기 전에 (Scope & Reality Check)

이 리팩토링은 **작은 작업이 아니다.** 현재 시스템 규모:

- **Prisma 모델 ~40개**, enum ~15개 (멀티테넌시, 결재, 예산 5단계, 알림, 재정보고서, 청나잇 등)
- **API Route ~110개** (`app/api/**/route.ts`)
- **성숙한 Next.js 프론트엔드**: App Router + PWA(next-pwa) + 모바일(카메라/GPS/음성) + 오프라인(dexie) + PDF(@react-pdf)

따라서 **한 번에 전체를 포팅하는 것은 권장하지 않는다.** 본 스펙은 목표 아키텍처를 정의하되, **도메인 단위 점진 이전(Strangler Fig 패턴)** 을 전제로 한다. 프론트엔드가 Next.js API와 FastAPI를 **병행 호출**할 수 있도록 프록시/라우팅을 구성하고, 도메인별로 하나씩 FastAPI로 옮긴다.

> ⚠️ **핵심 리스크 (SQLite ↔ Postgres 이식성)**: su-member 팀이 실제로 겪은 최대 함정은 "SQLite에서 통과한 마이그레이션이 Postgres에서 깨지는 것"이다. 특히 Boolean `server_default`. 이 문서 §5.5에서 강제 규칙으로 다룬다.

---

## 1. 목표 아키텍처 (Target Architecture)

### 1.1 모노레포 레이아웃

```
expense-saas/
├── backend/                     # 🆕 FastAPI (Python 3.12+) — su-membership-backend 패턴
│   ├── main.py                  # FastAPI 진입점 (lifespan: 마이그레이션 → 검증 → 시드)
│   ├── pyproject.toml           # uv 의존성 (fastapi, sqlmodel, alembic, aiosqlite, asyncpg...)
│   ├── uv.lock
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py               # make_sync_url() 로 async→sync URL 변환
│   │   └── versions/            # 마이그레이션 (0001_baseline 부터)
│   ├── .env.example
│   ├── .env.local               # RUNNING_ZONE=local, SQLite
│   ├── .env.prod                # RUNNING_ZONE=prod, Postgres (배포 시 주입)
│   ├── Dockerfile
│   ├── docker-entrypoint.sh     # alembic upgrade head → uvicorn
│   ├── scripts/                 # seed_*.py (기존 prisma/seeds 이전)
│   ├── tests/                   # pytest
│   └── expense_api/
│       └── core/
│           ├── config/          # settings.py (RUNNING_ZONE 기반 env 선택)
│           ├── db/              # engine.py, session.py, guard.py, migrations.py
│           ├── models/         # SQLModel 엔티티 (Prisma schema 이전)
│           ├── schemas/        # Pydantic 요청/응답 DTO (Zod 스키마 대응)
│           ├── repository/     # 비동기 리포지토리
│           ├── service/        # 비즈니스 로직 (lib/services, lib/approval-engine 이전)
│           ├── routes/         # FastAPI 라우터 (app/api/** 이전)
│           ├── dependencies/   # auth.py(JWT), tenant.py(멀티테넌시), rate_limit.py
│           └── security/       # 비밀번호 해시, JWT
│
├── frontend/                    # 🔁 기존 Next.js 이전 (app/, components/, hooks/, lib/ui...)
│   ├── app/                     # 그대로 (API Route는 제거 or 프록시로 축소)
│   ├── components/              # 그대로
│   ├── lib/
│   │   └── api/                 # baseURL을 Python 백엔드로 교체 (§7)
│   ├── next.config.ts           # rewrites 로 /api → 백엔드 프록시 (선택)
│   └── package.json
│
├── docs/
├── spec_python_refactoring.md   # (이 문서)
└── README.md
```

> **네이밍**: su-member는 `su_membership/core/...` 파이썬 패키지를 쓴다. 여기서는 `expense_api/core/...` 로 통일한다.

### 1.2 통신 방식

두 서비스는 **HTTP/JSON으로만** 통신한다. 공유 코드 없음.

```
[브라우저]
   │  https://app.expense-saas.com   (Next.js, :3000)
   ▼
[Next.js 프론트엔드]  ── fetch(baseURL) ──▶  [FastAPI 백엔드] (:8000)
   │  next.config rewrites (/api/py/* → :8000)          │
   └────────────────────────────────────────────────────┘
                                                         ▼
                                          RUNNING_ZONE=local → SQLite dev.db
                                          RUNNING_ZONE=prod  → Neon Postgres
```

- **로컬**: Next.js `:3000`, FastAPI `:8000`. `next.config.ts`의 `rewrites`로 `/api/py/*` → `http://localhost:8000/*` 프록시 → 개발 중 CORS 회피.
- **운영**: 각각 별도 배포 (Render 웹서비스 2개) 또는 프론트에서 절대 URL(`NEXT_PUBLIC_API_BASE_URL`) 호출. 백엔드 CORS 화이트리스트에 프론트 도메인 추가.

---

## 2. 기술 스택 매핑 (Before → After)

| 관심사 | 현재 (Next.js 모놀리스) | 목표 (분리) |
|---|---|---|
| API 런타임 | Next.js Route Handlers (Node) | **FastAPI (Python 3.12+, async)** |
| ORM | Prisma 7 | **SQLModel** (SQLAlchemy 2.0 async) |
| 마이그레이션 | `prisma migrate` / `db push` | **Alembic** |
| DB (로컬/개발) | PostgreSQL(Neon) 공유 | **SQLite** (`sqlite+aiosqlite:///./dev.db`) |
| DB (운영) | PostgreSQL(Neon) | **PostgreSQL** (`postgresql+asyncpg://...`) |
| 검증 | Zod | **Pydantic v2** (요청/응답), SQLModel |
| 인증 | JWT (jose) + bcryptjs, 쿠키 | **JWT (python-jose) + passlib[bcrypt]** |
| 패키지 관리 | npm | **uv** (백엔드), npm (프론트 유지) |
| 프론트엔드 | Next.js 16 App Router | **유지** (API 클라이언트만 교체) |
| 파일 업로드 | Cloudinary (next-cloudinary) | Cloudinary Python SDK (`cloudinary`) |
| 푸시 | web-push / firebase-admin | `pywebpush` / `firebase-admin` (Python) |
| 엑셀 | exceljs | `openpyxl` |
| PDF | @react-pdf (프론트 유지) | **프론트 유지** (변경 없음) |

---

## 3. 백엔드 상세 설계 (FastAPI)

### 3.1 진입점 `main.py` (su-member lifespan 패턴)

```python
# backend/main.py
from expense_api.core.db.guard import require_running_zone
require_running_zone()  # RUNNING_ZONE 미설정/오류 시 sys.exit(1) — settings 로드보다 먼저!

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from expense_api.core.config.settings import settings
from expense_api.core.db.migrations import run_migrations_async
from expense_api.core.db.session import init_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations_async()          # 1) alembic upgrade head
    _boot_validation()                    # 2) prod에서 약한 SECRET_KEY/localhost URL 차단
    await init_engine()                   # 3) 엔진/세션 초기화
    await seed_if_needed()                # 4) 관리자/테넌트 시드 (idempotent)
    yield

app = FastAPI(title="Expense SaaS API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# 라우터 등록 (§6)
from expense_api.core.routes import (auth_routes, expenses_routes, budget_routes, ...)
app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(expenses_routes.router, prefix="/api/expenses", tags=["expenses"])
# ...
```

### 3.2 레이어링

su-member의 4계층(Route → Service → Repository → Model)을 채택하되, **RService 동적 디스패치는 도입하지 않는다**(과한 추상화). 단순하게:

```
Route(FastAPI, 얇게) → Service(비즈니스 로직) → Repository(비동기 CRUD) → SQLModel
                          └ Pydantic Schema(요청/응답 DTO)
```

기존 `lib/services/`, `lib/approval-engine.ts`, `lib/recurring-expense.ts`, `lib/validators.ts`의 로직이 Service 계층으로 이전된다.

### 3.3 의존성 (`pyproject.toml`)

```toml
[project]
name = "expense-api"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlmodel>=0.0.22",
    "sqlalchemy[asyncio]>=2.0.0",
    "alembic>=1.14.0",
    "asyncpg>=0.30.0",          # Postgres 비동기 (운영)
    "aiosqlite>=0.20.0",        # SQLite 비동기 (로컬/개발)
    "psycopg2-binary>=2.9.0",   # Postgres 동기 (Alembic 마이그레이션)
    "pydantic-settings>=2.0.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "cuid2>=2.0.0",             # cuid 호환 ID (§4.2)
    "cloudinary>=1.40.0",
    "openpyxl>=3.1.0",
    "pywebpush>=2.0.0",
    "firebase-admin>=6.5.0",
    "python-multipart>=0.0.9",  # 파일 업로드
]

[dependency-groups]
dev = ["pytest>=8.0", "pytest-asyncio>=0.24", "ruff>=0.6", "pytest-cov>=5.0", "httpx>=0.27"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

---

## 4. 데이터 모델 이전 (Prisma → SQLModel)

### 4.1 원칙

- Prisma `schema.prisma`의 모든 모델을 `expense_api/core/models/*.py` SQLModel 클래스로 1:1 이전.
- **테이블/컬럼명 보존**: 기존 Postgres 데이터를 그대로 재사용해야 하므로(§9), 테이블명·컬럼명을 Prisma가 생성한 것과 동일하게 매핑한다. Prisma 기본 테이블명 = 모델명(예: `Expense`, `ExpenseItem`). SQLModel `__tablename__`으로 명시 고정.
- 파일 분할: 도메인별(`expense.py`, `budget.py`, `user.py`, `approval.py`, `notification.py`, `account_report.py`, `youth_night.py`, `tenant.py`).

### 4.2 타입 매핑 표 ⚠️ (SQLite 이식성 핵심)

| Prisma | SQLModel / SQLAlchemy | 주의 |
|---|---|---|
| `String @id @default(cuid())` | `str`, `default_factory=cuid_generator` | **`cuid2` 라이브러리로 생성** — uuid로 바꾸면 기존 데이터 ID와 불일치. 애플리케이션 레벨에서 생성 |
| `String` | `str` (`VARCHAR`) | |
| `String? @db.Text` | `str \| None`, `sa_column=Column(Text)` | |
| `Int` | `int` | |
| `Float` | `float` | |
| `Boolean @default(false)` | `bool`, `sa_column_kwargs={"server_default": sa.false()}` | **`sa.false()`/`sa.true()`만 사용. `sa.text("0")` 금지** (§5.5) |
| `DateTime @default(now())` | `datetime`, `server_default=func.now()` | |
| `DateTime? @db.Date` | `date \| None` | |
| `DateTime @updatedAt` | `datetime`, `sa_column_kwargs={"onupdate": func.now()}` | Prisma는 앱 레벨, SQLAlchemy `onupdate`로 대응 |
| `Json?` | `dict \| None`, `sa_column=Column(JSON)` | SQLAlchemy `JSON`은 SQLite/PG 양쪽 지원 |
| `String[] @default([])` | `list[str]`, `sa_column=Column(JSON)` | ⚠️ **SQLite엔 배열 타입 없음.** Postgres `_text[]` → **JSON 컬럼으로 통일**. `Role.permissions`가 해당. 데이터 이전 시 배열→JSON 변환 필요 |
| `enum OrgType {...}` | `str` + Python `Enum` (VARCHAR 저장) | **네이티브 PG enum 금지**. su-member처럼 문자열 컬럼 + 앱 레벨 Enum 검증 (§4.3) |
| `@@index([...])` | `Index(...)` 또는 `index=True` | |
| `@@unique([a,b])` | `UniqueConstraint("a","b")` | |
| `onDelete: Cascade` | `ondelete="CASCADE"` (FK) | SQLite는 `PRAGMA foreign_keys=ON` 필요 — 엔진 연결 시 활성화 |
| relation | SQLModel `Relationship` | |

### 4.3 Enum 전략 (이식성)

Prisma의 PG 네이티브 enum(`ApprovalStatus`, `PaymentStatus`, `OrgType`, `PlanType`, `StepStatus`, `ApprovalAction`, `NotificationChannel`, `OfferingType`, `CurriculumType`, `AgeGroup`, `RecurringFrequency`, `RecurringExpenseStatus` 등)은 **문자열 컬럼 + Python Enum**으로 저장한다.

```python
from enum import Enum
class ApprovalStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED_STEP_1 = "APPROVED_STEP_1"
    # ... 값은 기존 Prisma enum 값과 100% 동일하게

class Expense(SQLModel, table=True):
    __tablename__ = "Expense"
    status: ApprovalStatus = Field(default=ApprovalStatus.DRAFT, sa_column=Column(String))
```

이유: SQLite엔 enum 타입이 없고, PG 네이티브 enum은 `ALTER TYPE ... ADD VALUE` 마이그레이션이 까다롭다. 문자열 저장이 양쪽 이식성을 보장한다.

### 4.4 모델 이전 우선순위 (도메인 그룹)

1. **테넌시/사용자/권한**: `Tenant`, `SuperAdmin`, `User`, `Role`, `UserYearRole`, `UserSignature`, `SavedBankAccount`, `PlatformActivityLog`
2. **예산 계층**: `Committee`, `Department`, `BudgetCategory`, `BudgetSubcategory`, `BudgetDetail`, `BudgetDetailYear`, `DepartmentBudgetDetail`
3. **지출/결재**: `Expense`, `ExpenseItem`, `ExpenseAttachment`, `SimpleExpense`, `SimpleExpenseItem`, `SimpleExpenseAttachment`, `ApprovalLine`, `ApprovalStep`, `ApprovalLog`, `ExpenseTemplate`, `RecurringExpense`
4. **알림**: `NotificationPreference`, `NotificationLog`, `PushSubscription`, `WebPushLog`, `FcmToken`, `FcmLog`, `AdminNotification`
5. **재정보고서**: `AccountReport` + 7개 하위 테이블
6. **청나잇/부가**: `Curriculum`, `Lesson`, `Question`, `Attendance`, `QuizResponse`, `StudentPoints`, `RecitationSubmission`, `Offering`, `SystemSetting`, 변경이력 2종

---

## 5. DB 전략 — SQLite(로컬/개발) ↔ PostgreSQL(운영) ⭐

> 이 섹션이 사용자 요청의 핵심이다. su-member의 `RUNNING_ZONE` 3중 폴백 패턴을 그대로 채택한다.

### 5.1 스위칭 메커니즘 (3-Layer Fallback)

**(1) `RUNNING_ZONE`을 필수로 강제한다** — `core/db/guard.py`:

```python
import os, sys
_VALID_ZONES = {"local", "prod"}

def require_running_zone() -> None:
    zone = os.environ.get("RUNNING_ZONE")
    if zone is None:
        print("FATAL: RUNNING_ZONE 미설정 (local|prod)", file=sys.stderr); sys.exit(1)
    if zone not in _VALID_ZONES:
        print(f"FATAL: 잘못된 RUNNING_ZONE={zone}", file=sys.stderr); sys.exit(1)
```

**(2) zone이 로드할 `.env.{zone}` 파일을 선택한다** — `core/config/settings.py`:

```python
import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

def _env_file() -> str:
    zone = os.getenv("RUNNING_ZONE", "local")
    return f".env.{zone}"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_file(), extra="ignore")

    RUNNING_ZONE: str = "local"
    # (3) DATABASE_URL 기본값 자체가 zone 조건부
    DATABASE_URL: str = (
        "sqlite+aiosqlite:///./dev.db"
        if os.getenv("RUNNING_ZONE", "local") == "local"
        else "postgresql+asyncpg://user:password@localhost:5432/expense"
    )
    SECRET_KEY: str = "dev-only-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    # Cloudinary, VAPID, Firebase 등...

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

**(3) `.env.{zone}`이 `DATABASE_URL`을 최종 오버라이드한다.**

```bash
# backend/.env.local
RUNNING_ZONE=local
DATABASE_URL=sqlite+aiosqlite:///./dev.db
SECRET_KEY=local-dev-secret

# backend/.env.prod  (배포 시 Render 환경변수로 주입, 파일은 커밋 금지)
RUNNING_ZONE=prod
DATABASE_URL=postgresql+asyncpg://<neon-user>:<pw>@<host>/<db>?sslmode=require
SECRET_KEY=<강력한-랜덤-키>
CORS_ORIGINS=["https://app.expense-saas.com"]
```

### 5.2 엔진 생성 (dialect별 kwargs) — `core/db/engine.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import event
from expense_api.core.config.settings import settings

def _engine_kwargs(url: str) -> dict:
    kw = {"echo": False, "future": True}
    if url.startswith("sqlite"):
        kw["connect_args"] = {"check_same_thread": False}
    else:
        kw["pool_pre_ping"] = True
        kw["pool_size"] = 5
        kw["max_overflow"] = 10
    return kw

async_engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs(settings.DATABASE_URL))

# SQLite에서 FK(onDelete Cascade) 활성화
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(async_engine.sync_engine, "connect")
    def _fk_on(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

async_session_maker = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
```

### 5.3 Alembic — async→sync URL 변환 (`make_sync_url`)

Alembic은 동기로 돈다. `alembic/env.py`와 `core/db/migrations.py`에 동일 함수:

```python
def make_sync_url(url: str) -> str:
    if url.startswith("sqlite+aiosqlite"):
        return url.replace("sqlite+aiosqlite", "sqlite", 1)
    if url.startswith("postgresql+asyncpg"):
        return url.replace("postgresql+asyncpg", "postgresql", 1)  # → psycopg2
    return url
```

- `alembic.ini`의 `sqlalchemy.url =` 은 **비워둔다**. URL은 런타임에 settings에서 주입.
- `env.py`는 모든 SQLModel 모델을 import하여 `target_metadata`에 등록 → `--autogenerate` 정확도 확보. `compare_type=True, compare_server_default=True`.
- 앱 기동 시 `run_migrations_async()`가 `asyncio.to_thread`로 `alembic upgrade head` 실행 (su-member와 동일).

### 5.4 dialect별 분기가 필요한 지점

기능이 SQLite에 없으면 명시적으로 분기하고 한 곳에 격리한다.

- **advisory lock / 동시성 락**(예: 자동이체 배치 `recurring-expenses/process`의 리더 락): PG에서만 `pg_advisory_lock`, SQLite에선 no-op. `if engine.dialect.name == "postgresql":` 분기.
- **`ON CONFLICT` / upsert**: SQLModel/SQLAlchemy `sqlite`/`postgresql` dialect별 `insert().on_conflict_do_update()` 사용.
- **부분 유니크 인덱스, 전문 검색**: 필요 시 분기.

### 5.5 ⚠️ 최대 함정: Boolean/서버 기본값 이식성 (강제 규칙)

SQLite는 관대하고 Postgres는 엄격하다. SQLite에서 통과한 마이그레이션이 PG에서 `DatatypeMismatch`로 깨진다.

**규칙:**
1. Boolean 컬럼 `server_default`는 **`sa.false()` / `sa.true()`만** 사용한다.
2. **`sa.text("0")`, `sa.text("1")` 절대 금지** (PG에서 `DEFAULT 0` → boolean 컬럼과 타입 불일치).
3. 마이그레이션은 **로컬 SQLite와 PG(도커) 양쪽에서 모두 `upgrade head` 검증** 후 커밋.
4. 정적 가드 테스트 추가: `tests/test_migration_boolean_defaults.py` — `alembic/versions/*.py`에서 boolean 컬럼에 `sa.text(...)` 기본값 사용 시 실패시킨다.

이 규칙은 `Boolean @default(...)` 컬럼이 많은 이 스키마(`isActive`, `isDefault`, `isUrgent`, `smsEnabled` 등 수십 개)에서 특히 중요하다.

---

## 6. API 라우트 이전 (Next.js Route → FastAPI Router)

### 6.1 매핑 규칙

- `app/api/<domain>/route.ts` → `core/routes/<domain>_routes.py`
- `GET/POST/PUT/DELETE` export → FastAPI `@router.get/post/put/delete`
- `[id]` 동적 세그먼트 → path param `{id}`
- 요청 바디 Zod 스키마 → Pydantic 모델 (`core/schemas/`)
- `NextResponse.json(x, {status})` → return Pydantic 모델 (FastAPI 직렬화) / `HTTPException`
- 인증 미들웨어 → FastAPI `Depends(get_current_user)` (§8)

### 6.2 라우터 그룹 (prefix 기준, ~110 엔드포인트)

| Router 파일 | prefix | 이전 대상 (`app/api/**`) |
|---|---|---|
| `auth_routes.py` | `/api/auth` | login, logout, me, signup, change-password |
| `platform_routes.py` | `/api/platform` | tenants, admins, activity-logs, stats, settings, export, auth/* (슈퍼관리자) |
| `expenses_routes.py` | `/api/expenses` | 목록/CRUD, submit/approve/reject/withdraw, payment-status, attachments, bulk*, export, filter-options, duplicate |
| `simple_expenses_routes.py` | `/api/simple-expenses` | 간편 지출결의서 |
| `approvals_routes.py` | `/api/approvals` | approvals, pending-count, approval-line/calculate |
| `budget_routes.py` | `/api/budget` | budget, hierarchy, search, simple, upload, usage-details, memo-examples |
| `budget_master_routes.py` | `/api` | committees, departments, budget-categories, budget-subcategories, budget-details(+year) |
| `bank_accounts_routes.py` | `/api/bank-accounts` | |
| `users_routes.py` | `/api/users` | users CRUD, by-role, quick-register, upload, year-roles, me/signatures |
| `admin_routes.py` | `/api/admin` | dashboard, budget-execution, roles, offerings, notifications, quarterly-report, year-config, change-history 등 |
| `recurring_routes.py` | `/api/recurring-expenses` | CRUD, generate, process(배치) |
| `expense_templates_routes.py` | `/api/expense-templates` | |
| `push_routes.py` | `/api/push` | subscribe, fcm-*, test, history, vapid-public-key |
| `upload_routes.py` | `/api/upload` | Cloudinary 업로드/삭제 |
| `youth_night_routes.py` | `/api/youth-night` | curriculum, lesson, questions, attendance, quiz, points, ranking, recitation, stats |
| `settings_routes.py` | `/api` | settings, tenant/info |

### 6.3 계약(Contract) 보존

프론트엔드를 유지하므로 **응답 JSON 스키마·상태코드·에러 형식을 기존과 동일**하게 맞춘다. 도메인 이전 시 기존 `route.ts`의 응답 형태를 스냅샷으로 남기고 FastAPI 응답을 대조하는 계약 테스트를 둔다.

---

## 7. 프론트엔드 변경 (최소 침습)

프론트엔드는 **유지**한다. 변경은 API 호출 계층으로 한정.

### 7.1 baseURL 스위치

- `lib/api/` 클라이언트에 `NEXT_PUBLIC_API_BASE_URL` 도입. 기본값은 프록시 경로.
- `next.config.ts`에 개발용 rewrite:

```ts
async rewrites() {
  return [{ source: "/api/py/:path*", destination: `${process.env.API_ORIGIN ?? "http://localhost:8000"}/api/:path*` }];
}
```

- 점진 이전 동안: 이전 완료된 도메인은 `/api/py/*`(FastAPI), 미이전 도메인은 기존 `/api/*`(Next.js Route) 호출. 도메인별로 하나씩 스위치.

### 7.2 인증 토큰

- 현재: JWT 쿠키/헤더. FastAPI가 발급하는 access/refresh 토큰을 프론트가 저장(HttpOnly 쿠키 권장) 후 `Authorization: Bearer`로 전송.
- 로그인/갱신 플로우(`/api/auth/login`, `/api/auth/me`, refresh)를 FastAPI 계약과 동일 필드로 유지.

### 7.3 변경 없는 것

PWA(next-pwa), 오프라인(dexie), 카메라/GPS/음성, @react-pdf PDF 생성 — **모두 프론트에 남는다.** PDF는 클라이언트 렌더이므로 백엔드 이전 불필요.

---

## 8. 인증 & 멀티테넌시 이전

### 8.1 인증 (`core/dependencies/auth.py`)

- `python-jose`(HS256) + `passlib[bcrypt]`. `create_access_token`, `create_refresh_token`, `decode_token`.
- `get_current_user`: `HTTPBearer` → 토큰 검증 → `User` 로드. 비활성 사용자 차단.
- 기존 `lib/auth/permissions.ts`의 RBAC(`PERMISSIONS`, `ROLE_PERMISSION_PRESETS`)를 파이썬으로 이전. `Role.permissions`(JSON 배열) 비면 프리셋 폴백 로직 유지.
- 슈퍼관리자(`SuperAdmin`)는 별도 토큰/의존성(`get_current_super_admin`).

### 8.2 멀티테넌시 (`core/dependencies/tenant.py`)

- 현재 `lib/tenant-context.ts`, `lib/prisma-tenant-extension.ts`가 테넌트 스코프를 강제한다. FastAPI에선:
  - 서브도메인/헤더/토큰 클레임에서 `tenantId` 해석 → `Depends(get_tenant)`.
  - 리포지토리 계층에서 모든 쿼리에 `tenantId` 필터를 강제(공통 `TenantScopedRepository` 베이스). Prisma extension이 하던 자동 필터를 리포지토리 베이스로 대체.
- ⚠️ Prisma extension의 암묵적 필터를 놓치면 테넌트 격리가 깨진다. **리포지토리 베이스에 `tenant_id` 필수 인자**를 두어 컴파일 타임에 가깝게 강제.

---

## 9. 데이터 마이그레이션 (기존 Neon Postgres 보존) ⭐

운영 데이터를 잃으면 안 된다. 스키마 소유권이 Prisma → Alembic으로 바뀐다.

**전략: 기존 스키마를 Alembic baseline으로 채택(adopt).**

1. SQLModel 모델을 기존 Prisma 스키마와 **테이블/컬럼명이 정확히 일치**하도록 작성한다(§4.1).
2. Alembic `0001_baseline` 마이그레이션을 **기존 Postgres 구조 그대로** 생성한다(autogenerate를 빈 DB 대비로 생성 후, 실제 운영 스키마와 diff가 없도록 조정).
3. 운영 DB에는 스키마를 재적용하지 않고 **`alembic stamp head`**로 baseline을 "이미 적용됨" 처리한다(su-member의 `_stamp_if_unversioned` 패턴).
4. `String[]`(`Role.permissions`) → JSON 컬럼 변환은 별도 데이터 마이그레이션 스크립트로 처리(PG `text[]` → JSON). 변환 전/후 검증.
5. `cuid()` ID는 애플리케이션 생성이므로 기존 ID 값 그대로 유효(`cuid2`로 신규 생성만 담당).
6. 로컬/개발은 SQLite `dev.db`를 `alembic upgrade head`로 새로 만들고 시드 스크립트로 채운다.

**시드 이전**: `prisma/seeds/*.ts`(예산 204항목, 슈퍼관리자, 테넌트, 청연컨설팅) → `backend/scripts/seed_*.py`로 포팅. idempotent 유지.

---

## 10. 로컬 개발 실행 방법 (su-member 방식)

```bash
# ── 백엔드 (터미널 1) ─────────────────────────────
cd backend
uv sync                                   # 의존성 설치
cp .env.example .env.local                # RUNNING_ZONE=local, SQLite
RUNNING_ZONE=local uv run uvicorn main:app --reload --port 8000
#   → dev.db 자동 생성, alembic upgrade, 시드

# ── 프론트엔드 (터미널 2) ─────────────────────────
cd frontend        # (기존 루트에서 이전된 Next.js)
npm install
API_ORIGIN=http://localhost:8000 npm run dev   # :3000, /api/py/* → :8000 프록시
```

- 개발 중 DB를 초기화하려면 `rm backend/dev.db` 후 재기동.
- Prisma Studio 대체: `sqlite3 dev.db` 또는 DBeaver로 SQLite 열람.

---

## 11. 배포 (Render)

| 서비스 | 빌드 | 시작 | 환경변수 |
|---|---|---|---|
| **backend** (Python) | `uv sync --frozen --no-dev` | `docker-entrypoint.sh` → `alembic upgrade head` → `uvicorn main:app --host 0.0.0.0 --port $PORT` | `RUNNING_ZONE=prod`, `DATABASE_URL`(Neon), `SECRET_KEY`, `CORS_ORIGINS`, Cloudinary/VAPID/Firebase 키 |
| **frontend** (Node) | `npm install && npm run build` | `npm start` | `NEXT_PUBLIC_API_BASE_URL=https://<backend>.onrender.com/api` |

- `Dockerfile`(백엔드): `python:3.12-slim` + uv, 멀티스테이지. Healthcheck `GET /health`.
- 운영 마이그레이션은 엔트리포인트에서 자동(`alembic upgrade head`). 최초 배포 시 §9의 `stamp head`로 baseline 채택.

---

## 12. 점진 이전 로드맵 (Strangler Fig)

전체 빅뱅 금지. 도메인 슬라이스 단위로 이전하며 매 슬라이스마다 계약 테스트로 검증.

- **Phase 0 — 스캐폴딩**: `backend/` 생성, FastAPI 기동, `RUNNING_ZONE`/SQLite/Alembic 파이프라인, `/health`, JWT 인증 골격, CORS/프록시. **DB 스위칭 검증**(local=SQLite, prod=PG 도커).
- **Phase 1 — 인증/사용자/테넌시**: `auth`, `users`, `platform`, RBAC, 멀티테넌시 리포지토리 베이스. 프론트 로그인 플로우 스위치.
- **Phase 2 — 예산 계층**: `committees`~`budget-details`, `budget` 조회/검색/업로드. `BudgetSelector` 계약 유지.
- **Phase 3 — 지출/결재**: `expenses`, `simple-expenses`, `approvals`, `approval-engine`, `recurring-expenses`. (가장 큼)
- **Phase 4 — 알림/업로드**: `push`, `upload`(Cloudinary), 알림 로그.
- **Phase 5 — 재정보고서 / 청나잇 / 부가**: `admin/*-report`, `youth-night`, `offerings`, `settings`.
- **Phase 6 — 정리**: Next.js `app/api/**` 잔여 라우트 제거, 프록시 정리, 문서화.

각 Phase 완료 기준(DoD): (1) FastAPI 라우터 + 서비스 + 리포지토리 + Pydantic 스키마, (2) pytest 통과, (3) 프론트 계약 동일, (4) SQLite·PG 양쪽 마이그레이션 통과, (5) 해당 Next.js Route 제거 또는 프록시 전환.

---

## 13. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| SQLite↔PG 이식성(Boolean/서버 기본값) | 운영 마이그레이션 파손 | §5.5 강제 규칙 + 정적 가드 테스트 + 양쪽 CI 검증 |
| Prisma `String[]` → JSON 변환 | `Role.permissions` 데이터 손상 | 전용 마이그레이션 스크립트 + 전후 검증 |
| 멀티테넌시 암묵 필터 소실 | 테넌트 데이터 유출 | 리포지토리 베이스에 `tenant_id` 필수화 + 격리 테스트 |
| API 계약 불일치 | 프론트 런타임 오류 | 도메인별 계약 스냅샷 테스트 |
| 결재 엔진 로직 재현 오류 | 잘못된 결재 흐름 | `lib/approval-engine.ts` 단위 테스트를 pytest로 포팅(동일 케이스) |
| 범위 과다(빅뱅) | 장기 미완/롤백 불가 | Strangler Fig 단계 이전(§12), 프록시 병행 |
| PG 전용 기능(advisory lock 등) | 로컬 동작 차이 | dialect 분기 격리(§5.4) |

---

## 14. 체크리스트 (착수 전 합의)

- [ ] 파이썬 패키지명 `expense_api` 확정
- [ ] `RUNNING_ZONE` 값 집합 `{local, prod}` 확정 (staging 필요 여부)
- [ ] cuid 호환 라이브러리(`cuid2`) vs uuid 전환 결정 → 기존 ID 보존 위해 **cuid2 권장**
- [ ] enum 문자열 저장 방식 합의(§4.3)
- [ ] `Role.permissions` JSON 전환 데이터 마이그레이션 계획 승인
- [ ] Alembic baseline `stamp head` 운영 적용 절차 승인(§9)
- [ ] 프론트 인증 토큰 저장 방식(HttpOnly 쿠키 vs 헤더) 결정
- [ ] Render 서비스 2개 분리 배포 승인
- [ ] Phase별 DoD/계약 테스트 도입 합의

---

## 15. 멀티테넌시 세그먼트 전략 (교회 vs 회사)

> **배경 질문**: "교회 지출결의서와 회사 지출결의서가 너무 다른데, 하나의 멀티테넌시 SaaS로 가는 게 맞는가?"
> 이 섹션은 그 판단과, 판단을 코드로 지탱하기 위한 백엔드 설계 방향을 정의한다. (Python 리팩토링과 같은 방향으로 정렬)

### 15.1 차이의 성격 구분 — 표현 차이 vs 도메인 차이

현재 코드가 드러내는 사실(측정치):

| 구분 | 성격 | 규모(현 코드) | 처리 방식 |
|---|---|---|---|
| **(A) 용어 차이** | 표현(presentation) | `orgType`/`useOrgTerms` 참조 **171곳** | `lib/org-terms.ts` 사전(위원회→본부, 사역팀→팀). **DB/API 무변경, 라벨만 치환** |
| **(B) 교회 전용 모듈** | 도메인(feature) | 헌금 **241 참조**, 청나잇 **50 파일**, 재정보고서 **118 참조** | 현재 `orgType==CHURCH` 하드코딩 + 메뉴 숨김 |
| **(C) 회사 전용(미래)** | 도메인(feature) | 아직 없음 | 세금계산서·부가세, 법인카드 정산, 비용센터/프로젝트 회계, 전결규정 결재선, ERP 연동 |
| **(D) 결재선** | 구조(structural) | 교회식 3단계(팀장→회계→재정팀장) 사실상 전제 | 회사는 전결규정별 상이 → **설정형 전환 필요** |

**핵심 판단**: 지금 갈라지는 것은 *지출결의서의 데이터 구조*가 아니라 *그 위에 얹히는 전용 기능 모듈과 회계 의미*다. 공유 코어(인증·테넌시·조직계층·지출결의서 폼·예산·결재 워크플로우)는 **구조가 동일**하다. 이는 버티컬 SaaS의 **"단일 플랫폼 + 세그먼트별 모듈"** 로 푸는 정석 케이스다.

### 15.2 결론 — 지금은 단일 플랫폼 유지 (분리는 시기상조)

**두 제품으로 쪼개지 않는다.** 이유:
- 공유 코어 개선이 이중화되고, 아직 회사 세그먼트 검증(PMF)이 끝나지 않은 상태에서 운영·배포 비용만 2배가 된다.
- 현재 차이는 모듈 on/off와 설정으로 흡수 가능한 수준이다.

**단, 현재의 `if orgType` 분산 처리는 반창고다.** 방향은 "분리하지 마라"가 아니라 **"나중에 쪼갤 권리를 벌기 위해 지금 모듈 경계를 세워라"** 이다. 아래 15.3의 3가지 투자로 이를 실현한다.

### 15.3 지금 세울 3가지 경계 (백엔드 설계에 반영)

FastAPI 이전(§6)과 **같은 작업으로** 처리하면 비용이 거의 추가되지 않는다.

**1) 기능 모듈(Capability) 시스템 — `orgType` 하드코딩 제거**

- 헌금·청나잇·재정보고서 노출을 `orgType==CHURCH`가 아니라 **테넌트별 활성 모듈 플래그**로 게이팅한다.
- `Tenant.settings`(이미 `Json?` 존재) 또는 신규 `enabledModules`(JSON 배열)로 모듈 목록 보유. 예: `["offering","youth_night","account_report"]`(교회 프리셋), `["tax_invoice","corporate_card","cost_center"]`(회사 프리셋).
- FastAPI 라우터를 **팩(pack) 단위로 분리**하고, 미들웨어/의존성에서 모듈 활성 여부를 검사:

```python
# core/dependencies/modules.py
def require_module(module: str):
    async def _dep(tenant = Depends(get_tenant)):
        if module not in tenant.enabled_modules:
            raise HTTPException(404, f"module '{module}' not enabled for this tenant")
        return tenant
    return _dep

# routes/offering_routes.py  (교회팩)
router = APIRouter(dependencies=[Depends(require_module("offering"))])
```

- 라우터 그룹핑(§6.2)을 **`core/routes/shared/`, `core/routes/church_pack/`, `core/routes/company_pack/`** 로 물리적으로 나눈다. → 향후 제품 분리 시 팩 단위로 lift-out 가능.
- 프론트 메뉴 필터링(`lib/constants/admin-menu.ts`, `isChurchOnlyFeatureVisible`)도 orgType 기준 → **모듈 기준**으로 전환한다.

**2) 결재선(ApprovalLine)을 테넌트별 설정형으로**

- 회사 도입의 **가장 큰 구조적 차이**. 교회식 3단계 하드코딩을 탈피한다.
- 이미 `ApprovalLine`/`ApprovalStep` **스냅샷 구조**가 있으므로, 남은 것은 "규칙 → 라인 생성" 단계를 설정 기반으로 만드는 것.
- 테넌트별 **결재 규칙(ApprovalPolicy)** 을 데이터로 보유: 단계 정의, 조건(금액 임계·부서·비용센터), 병렬/전결. `lib/approval-engine.ts` 로직을 `core/service/approval_policy_service.py`로 이전하며 **규칙을 파라미터화**한다.
- 교회 프리셋(팀장→회계→재정팀장)은 기본 정책으로 시드. 회사는 조직별 전결규정을 정책으로 입력.

**3) 용어 사전(org-terms) 유지 + 백엔드 미노출**

- `lib/org-terms.ts`는 **프론트 표현 계층에 그대로 유지**(잘 되어 있음). 백엔드는 필드명(committee/department)만 알고 표시 용어는 모른다 — 관심사 분리 유지.

### 15.4 분리 트리거 (언제 정말 두 제품으로 쪼개나)

명확한 단일 지표를 둔다:

> **`Expense`(지출결의서) 테이블에 회사 전용 nullable 컬럼(세금계산서번호·부가세·비용센터·원가배부 등)과 교회 전용 컬럼이 동시에 쌓이기 시작하면** — 그것이 "지출결의서 데이터 모델 자체가 갈라진" 순간이다.

이 신호가 오면:
1. 공유 코어(인증·테넌시·조직계층·예산·결재 엔진)를 **플랫폼 라이브러리/서비스로 추출**.
2. 그 위에 **교회 제품 / 회사 제품** 두 버티컬을 얇게 구성(각자 자기 팩 + 자기 Expense 확장 스키마).
3. §15.3에서 팩을 물리적으로 분리해 두었으므로 lift-out 비용이 최소화된다.

그 전까지는 단일 플랫폼의 레버리지가 더 크다.

### 15.5 기술 결정이자 사업 결정

이 선택은 기술 결정이기 전에 **사업 결정**이기도 하다. 다음이 성립하면 분리 시점이 앞당겨질 수 있다:
- 교회/회사가 **다른 구매자·다른 가격·다른 계약** 으로 팔린다.
- **컴플라이언스가 근본적으로 다르다**(교단 비영리 회계 vs 기업 세무/K-IFRS·전자세금계산서).
- 한 세그먼트가 매출을 압도해 로드맵 우선순위가 갈린다.

→ 기술적 기본값은 **"단일 유지 + 모듈화(§15.3)"**, 최종 결정권은 **사업 궤적**에 있다. 본 리팩토링은 어느 쪽으로 가든 유리하도록 **모듈 경계를 미리 세우는 것**을 목표로 한다.

### 15.6 §12 로드맵과의 연결

§12 Phase 이전 시 다음을 함께 반영한다:
- **Phase 1**(테넌시): `Tenant.enabledModules` 도입 + `require_module` 의존성 골격.
- **Phase 3**(지출/결재): 결재선 **설정형(ApprovalPolicy)** 전환.
- **Phase 5**(재정보고서/청나잇/부가): 이 모듈들을 **`church_pack` 라우터**로 이전하며 모듈 게이팅 적용.

---

## 16. 리팩토링 vs 재작성 결정 (In-place Strangler vs Greenfield Big-Bang)

> **배경 질문**: "지금 프로젝트를 리팩토링하는 게 나은가, 아니면 참고만 하고 새 프로젝트로 새로 만드는 게 더 빠른가? 어차피 내가 만든 것인데."
> 이 섹션은 그 결정과 근거를 못박는다. **결론: 기존 자산을 살리고 백엔드만 새 구조로 만들되 점진 컷오버(§12 Strangler)한다. 빅뱅 재작성은 채택하지 않는다.**

### 16.1 질문 재정의 — 이건 "리팩토링 vs 재작성"이 아니다

스택 변경(TS→Python)과 프론트 유지(§7) 결정 때문에, 실제 선택지는 통념과 다르다:

- **백엔드는 어느 쪽이든 "새로 짜기"다.** 언어가 바뀌어 코드 복사가 불가능 → `app/api/**`(~110)는 포팅이 불가피. 여기엔 "리팩토링"이란 선택지가 없다.
- **프론트엔드는 어느 쪽이든 "재사용"이다.** 전체 ~127k LOC의 대부분인 `components/`(109)·`app/` 페이지(221)는 스택이 안 바뀐다. 새 프로젝트를 만들어도 그대로 가져와야 한다.

→ 따라서 진짜 축(axis)은 **"이전 방식"** 하나뿐이다:

| | 점진 이전 (In-place Strangler) — **채택** | 빅뱅 (Greenfield, 전체 포팅 후 1회 컷오버) — 기각 |
|---|---|---|
| 백엔드 | 새 FastAPI 구조로 깔끔히 시작 | 동일하게 새로 |
| 프론트 | 재사용 | 재사용 |
| 컷오버 | **도메인별 점진**(프록시 `/api/py/*`) | 100% 패리티 후 전부-아니면-전무 |
| 가치 배포 | 매 Phase마다 | 완성 전까지 0 |

### 16.2 결정을 가르는 사실 — 라이브 서비스

**청연컨설팅(회사)·교회 테넌트가 실제 운영 중이며 실데이터가 있다.** 이것이 판을 정한다.

- **빅뱅**: 라이브를 대체하려면 전 기능 패리티까지 아무 가치도 배포 불가. 40모델·110엔드포인트 이전 몇 달간, 기존 시스템도 계속 변하니 **움직이는 표적을 쫓게** 되고, 컷오버 + 데이터 마이그레이션 리스크를 한 번에 짊어진다 → 전형적 "재작성 죽음의 행군".
- **점진**: 도메인 하나씩 실서비스 검증, 도메인별 롤백, 매 단계 가치 배포.

### 16.3 "새로 짜는 게 빠르다" 직감 — 맞는 부분과 함정

**맞는 부분 (인정, 설계에 반영):**
- **저자가 멘탈 모델을 보유.** 재작성 대참사는 보통 *남의 코드*를 이해 못한 채 다시 짤 때 발생. 저자가 다시 짜면 리스크가 낮다.
- 백엔드는 언어가 바뀌어 재표현이 불가피하니, **깨끗한 FastAPI 구조를 새로 잡는 것**이 TS를 억지 변환하는 것보다 실제로 빠르고 깔끔하다. → 그래서 `backend/`는 "새로 만드는" 접근이 옳다.

**함정 (경계):**
- 새 슬레이트는 기존 복잡도를 **안 보이게** 만든다. 그 복잡도는 몇 달간 발견한 엣지케이스·버그픽스·업무규칙을 담고 있다. **92개 테스트(~1,935 케이스)가 그 지식의 저장고**다. 새로 짜면 발견 비용을 재지불한다.
- "내가 만들어 다 안다"는 느낌에도 멘탈 모델엔 **이미 잊은 엣지케이스**가 빠져 있다 — 금액 절사, 멀티테넌시 격리, 결재 상태 전이, 교회 회계 의미. 재도출하면 버그가 재발한다. 테스트가 이를 붙잡고 있다.

### 16.4 채택안 — 두 장점을 모두 취하는 중간 길

**"깨끗한 새 백엔드 구조를 만들되(=새로 짜는 만족), 빅뱅 컷오버는 하지 않는다."** 이 둘은 양립하며, §7 프록시 + §12 Strangler가 그대로 실현한다.

1. `backend/`를 **완전히 새 FastAPI 구조**로 시작 (직감대로 fresh).
2. 100% 패리티를 기다리지 않고, **도메인이 준비되는 대로** 라이브 프론트에서 그 도메인만 FastAPI로 라우팅 전환(`/api/py/*`).
3. 나머지는 기존 Next.js API가 계속 처리.

레포 위치(새 레포 vs 기존 `backend/` 폴더)는 **무관**하다. 핵심은 **컷오버를 점진적으로 한다**는 것.

### 16.5 재사용 vs 재작성 자산 분류

| 자산 | 규모 | 처리 | 근거 |
|---|---|---|---|
| `components/`, `app/` 페이지, PWA/모바일/PDF | 109 + 221 파일 | **재사용** | 스택 불변. 버리면 순손실 |
| 테스트 | 92 파일 (~1,935 케이스) | **명세로 재사용** (pytest 포팅) | 업무규칙 저장고 → 패리티 검증 도구 |
| Prisma 스키마 | 40 모델 | **명세로 재사용** | SQLModel 매핑 원본(§4), 데이터 보존(§9) |
| 결재엔진·검증·자동이체 | `lib/*` | **로직 이식** | 코드는 새로, 규칙은 그대로 |
| `app/api/**` 런타임 | ~110 | **새로 작성(포팅)** | 언어 변경 — 불가피 |

### 16.6 "빅뱅 재작성이 정답이 되는" 조건 (현재 대부분 거짓)

아래가 **대부분 참**이면 빅뱅이 낫다. 현재 판정:

- [ ] 라이브 사용자·데이터가 없다 → **거짓** (청연컨설팅·교회 운영 중)
- [ ] 기존 아키텍처가 목표를 *구조적으로* 막는다 → **거짓** (잘 구조화·테스트됨)
- [ ] 도메인이 단순해 빠르게 재도출 가능 → **거짓** (40모델·복잡한 결재/회계)
- [ ] 데이터 모델을 근본적으로 갈아엎어야 한다 → **부분적** (§15의 교회/회사 분리는 *미래* 트리거이며, 그때도 코어 추출이지 전면 재작성은 아님)

→ 판정: **기존 자산 보존 + 백엔드만 새 구조 + 점진 컷오버.** "참고해서 새로"의 직감은 **백엔드 구조에 한해 옳고**, 프론트·테스트·업무규칙까지 버리는 순간 몇 달치 축적을 재구매하게 된다.

### 16.7 §0·§12와의 관계

- 본 결정은 §0(Scope & Reality Check)의 "빅뱅 금지, Strangler Fig 전제"를 **명시적 의사결정으로 승격**한 것이다.
- 실행 절차는 §12 로드맵(Phase 0~6)을 그대로 따른다. 새로 추가되는 규율은 없고, "왜 그 방식인가"의 근거를 못박는 역할이다.

---

## 부록 A. su-member 참조 포인트 (실제 파일)

이 스펙이 근거한 su-member 실파일(패턴 복제 대상):

- `su-membership-backend/pyproject.toml` — 드라이버 조합(aiosqlite + asyncpg + psycopg2-binary)
- `core/config/settings.py`, `settings_ext.py` — `RUNNING_ZONE` 기반 env 선택 + zone 조건부 `DATABASE_URL`
- `core/db/guard.py` — `require_running_zone()` fail-fast
- `core/models/base.py` — `_build_engine_kwargs()` dialect별 엔진
- `alembic/env.py`, `core/db/migrations.py` — `make_sync_url()`, 시동 시 자동 `upgrade head`
- `core/dependencies/auth.py` — JWT + bcrypt
- `docker-entrypoint.sh` — `alembic upgrade head` → uvicorn
- 루트 `CLAUDE.md` — Boolean `server_default` 이식성 규칙 + `tests/test_migration_boolean_defaults.py`

## 부록 B. 참고 문서 (이 저장소)

- `SPEC_MULTI_TENANCY.md` — 멀티테넌시 요구사항
- `spec_rbac_refactoring.md` — RBAC/권한 모델
- `APPROVAL_RULES.md`, `APPROVAL_IMPLEMENTATION_GUIDE.md` — 결재 규칙(서비스 계층 이전 근거)
- `DEV_PROD_STRATEGY.md` — 현재 dev/prod 전략(대체 대상)
- `prisma/schema.prisma` — 모델 원본(이전 대상)
```
