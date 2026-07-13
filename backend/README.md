# Expense SaaS — 백엔드 (FastAPI)

`spec_python_refactoring.md` **Phase 0 스캐폴딩**. FastAPI + SQLModel + Alembic + uv.
로컬/개발은 SQLite, 운영은 PostgreSQL 을 `RUNNING_ZONE` 으로 스위칭한다.

## 요구사항

- [uv](https://docs.astral.sh/uv/) (Python 3.12 은 uv 가 자동 설치)

## 로컬 실행 (SQLite)

```bash
cd backend
uv sync                                    # 의존성 설치 (최초 1회)
RUNNING_ZONE=local uv run uvicorn main:app --reload --port 8000
```

- `RUNNING_ZONE` 은 **반드시 프로세스 환경변수로** 지정한다 (미설정 시 부팅 거부 — `db/guard.py`).
- 기동 시 `alembic upgrade head` 가 자동 실행되어 `dev.db` 가 생성된다.
- 헬스체크: <http://localhost:8000/health>
- API 문서: <http://localhost:8000/docs>

### DB 초기화

```bash
rm backend/dev.db      # 다음 기동 시 재생성
```

## RUNNING_ZONE / DATABASE_URL 스위칭

| zone | env 파일 | 기본 DATABASE_URL |
|------|----------|-------------------|
| `local` | `.env.local` | `sqlite+aiosqlite:///./dev.db` |
| `prod`  | `.env.prod`  | `postgresql+asyncpg://...` (배포 시 주입) |

3중 폴백: (1) `guard` 가 zone 강제 → (2) zone 이 `.env.{zone}` 선택 → (3) `DATABASE_URL` 미지정 시 zone 조건부 기본값. (`spec §5.1`)

## 마이그레이션 (Alembic)

```bash
RUNNING_ZONE=local uv run alembic revision --autogenerate -m "메시지"
RUNNING_ZONE=local uv run alembic upgrade head
RUNNING_ZONE=local uv run alembic downgrade -1
```

> ⚠️ **이식성 규칙 (spec §5.5)**: Boolean `server_default` 는 `sa.false()`/`sa.true()` 만.
> `sa.text("0"/"1")` 금지 (Postgres 에서 `DatatypeMismatch`). 마이그레이션은 SQLite·PG 양쪽에서 검증 후 커밋.

## 프론트 연동 (개발)

프론트(Next.js)의 `next.config.ts` 에 프록시가 추가되어 있다:

```
/api/py/:path*  →  ${API_ORIGIN:-http://localhost:8000}/api/:path*
```

이전 완료된 도메인만 `/api/py/*` 로 호출한다.

## 구조

```
backend/
├── main.py                     # FastAPI 진입점 (lifespan: 마이그레이션→검증)
├── alembic/                    # env.py(make_sync_url), versions/
├── expense_api/core/
│   ├── config/settings.py      # RUNNING_ZONE 기반 설정
│   ├── db/                     # guard, engine(dialect별), session, migrations
│   ├── models/                 # SQLModel (Phase 0: SchemaInfo 만)
│   ├── security/jwt.py         # 토큰/비밀번호
│   ├── dependencies/auth.py    # get_current_claims
│   ├── schemas/                # Pydantic DTO
│   └── routes/                 # health, auth(스텁)
└── tests/
```

## 현재 상태

**Phase 0 (스캐폴딩) — 완료**
- [x] RUNNING_ZONE / SQLite·PG 스위칭
- [x] Alembic 파이프라인 (자동 upgrade)
- [x] `/health` (DB 연결 확인)
- [x] JWT 골격 + CORS + 프론트 프록시

**Phase 1 (테넌시·사용자·권한) — 완료**
- [x] 도메인 모델: `Tenant`(+`enabledModules`), `SuperAdmin`, `User`, `Role`, `UserYearRole`
- [x] RBAC 포팅 (`core/auth/permissions.py`) — 프리셋 + DB 폴백 resolver
- [x] 멀티테넌시 리포지토리 베이스 (`TenantScopedRepository`, tenant_id 강제)
- [x] 실제 로그인 (`POST /api/auth/login`, bcrypt, subdomain 스코핑)
- [x] `get_current_user`, `require_permission`, `require_module`(§15.3), `get_tenant`
- [x] `GET /api/auth/me`(effective permissions), `/api/tenant/info`(모듈 목록)
- [x] 개발 시드 (`seed_if_needed`): 데모 테넌트 `demo` + `admin/admin123`, `user1/user123`
- [x] 테스트 23건 (RBAC, 테넌트 격리, 스위칭 로직)

**Phase 2 (예산 계층) — 완료**
- [x] 도메인 모델 7종: `Committee`, `Department`, `BudgetCategory`, `BudgetSubcategory`, `BudgetDetail`, `BudgetDetailYear`, `DepartmentBudgetDetail`
- [x] 5단계 캐스케이드 서비스 (부서-세목 링크 `DepartmentBudgetDetail` 기준 필터)
- [x] `GET /api/budget`(hierarchy), `POST /api/budget`(cascade {field, options})
- [x] master CRUD: `/api/committees`, `/departments`, `/budget-categories`, `/budget-subcategories`, `/budget-details` (GET 목록 + POST 생성, 권한 게이팅)
- [x] 데모 테넌트에 예산 트리 시드 (기획본부/사업본부 → 재정팀/영업팀 → 사무행정비·인건비 → ...)
- [x] 테스트 27건 (캐스케이드 5단계, 링크 필터, 테넌트 격리)

### 데모 로그인 & 캐스케이드

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"userid":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
# 캐스케이드: 위원회 → 부서 → 항 → 목 → 세목
curl -X POST localhost:8000/api/budget -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"committee":"기획본부","department":"재정팀"}'
```

**Phase 3 (지출·결재) — 완료**
- [x] enums(ApprovalStatus/PaymentStatus/StepStatus/ApprovalAction) + 모델 6종: `Expense`, `ExpenseItem`, `ExpenseAttachment`, `ApprovalLine`, `ApprovalStep`, `ApprovalLog`
- [x] 금액 계산(`domain/amount.py`: amount=unitPrice×quantity, requestAmount=Σ) — 서버 재계산(조작 방지)
- [x] 결재 엔진(`domain/approval_engine.py`): 상태전이·can_approve·next_step (순수 로직)
- [x] 지출 서비스/라우트: `GET/POST /api/expenses`, `GET /api/expenses/{id}` (생성은 항상 DRAFT, 읽기 권한 스코프)
- [x] 결재 워크플로우: `/{id}/submit·approve·reject·withdraw`, `/{id}/approval` + `ApprovalLog` 감사기록
- [x] 테스트 45건 (금액, 엔진 전이, 워크플로우, 격리, 권한/순서 위반)

> **범위 밖(후속)**: 결재선 **자동 산출**(교회 직제·예산담당자 결합, 482줄)은 §15.3 **ApprovalPolicy(설정형)** 로 별도 이전. 이번 골격은 **명시적 결재 단계**로 라인 생성. `SimpleExpense`/`RecurringExpense`/`ExpenseTemplate`, 지급상태 관리, 첨부(Cloudinary)도 후속.

### 결재 워크플로우 예시

```bash
# 생성(DRAFT) → 제출(PENDING) → 승인(APPROVED_FINAL)
curl -X POST localhost:8000/api/expenses/$EID/submit -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"steps":[{"stepNumber":1,"stepName":"팀장","approverName":"관리자"}]}'
```

**다음 (Phase 4)**: 알림/업로드 — `push`, `upload`(Cloudinary), 알림 로그.
