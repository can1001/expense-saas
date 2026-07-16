# FastAPI 백엔드 배포 런북

`spec_python_refactoring.md` §9(데이터 이전)·§11(배포) 실행 가이드. Render + Docker 기준.

---

## 배포 모드

| 모드 | DB | 언제 | 스키마 채택 |
|---|---|---|---|
| **(a) 독립 DB** | FastAPI 전용 Postgres | 서비스 검증·스테이징 | 불필요 (Alembic 이 생성) |
| **(b) 공유 DB** | Next.js 와 동일 Neon | **실 로그인 커토버** | **필요 (§9, 아래)** |

- 로그인 커토버(`NEXT_PUBLIC_USE_PY_AUTH=true`)는 **(b) + 공유 시크릿**이 전제다. 실 사용자·테넌트가 Neon 에 있기 때문.

---

## (a) 독립 DB 배포 — 지금 바로 가능

1. Render 에서 Docker 웹 서비스 생성 (Root Directory = `backend`, `backend/render.yaml` 참조).
2. 전용 Postgres 프로비저닝 → `DATABASE_URL` 주입 (`postgresql+asyncpg://...`).
3. 환경변수: `RUNNING_ZONE=prod`, `SECRET_KEY`(랜덤), `CORS_ORIGINS`.
4. 배포 → `docker-entrypoint.sh` 가 `alembic upgrade head` 후 uvicorn 기동. `/health` 확인.
5. 시드는 실행되지 않음(prod). 필요 시 `scripts/`의 시드를 수동 실행.

---

## (b) 공유 Neon DB 채택 (§9) — 로그인 커토버 전제

기존 Neon 은 **Prisma 가 만든 스키마**다. FastAPI 의 Alembic `upgrade head` 를 그대로 돌리면
이미 있는 테이블을 다시 만들려다 충돌한다. 대신 **델타만 반영 후 `stamp`** 한다.

> ⚠️ **반드시 Neon 브랜치(복제본)에서 먼저 리허설**하고, 신 코드 배포와 같은 릴리스에서 수행.

### FastAPI 스키마 vs Prisma Neon — 실제 델타

| 항목 | Prisma(Neon 현재) | FastAPI 기대 | 조치 |
|---|---|---|---|
| `SchemaInfo` 테이블 | 없음 | 있음(Phase 0) | 생성 |
| `ApprovalPolicy` 테이블 | 없음 | 있음(§15.3) | 생성 |
| `Tenant.enabledModules` | **없음** | JSON | 컬럼 추가(가산적, 안전) |
| `Role.permissions` | `text[]` | dialect-variant | ✅ 해결됨 — 모델이 PG=`TEXT[]`/SQLite=JSON (아래) |
| enum 컬럼(status 등) | 네이티브 PG enum | String 취급 | 변경 불필요(값 호환, 문자열로 read/write) |
| CASCADE FK | `onDelete: Cascade` | `ondelete=CASCADE` | 이미 일치 |
| NotificationPreference/Log/PushSubscription | 있음 | 있음 | 일치 |

### `Role.permissions` — dual-run 호환 (해결됨)

전환기에는 **Next.js(Prisma, `text[]`)와 FastAPI 가 같은 Neon 을 동시 사용**한다.
DB 를 `jsonb` 로 바꾸면 Prisma 읽기가 깨지므로 **DB 는 그대로 두고 FastAPI 모델을 맞춘다**:

- `Role.permissions` 컬럼이 **dialect-variant** 로 정의돼 있다 (`models/user.py`):
  `JSON().with_variant(ARRAY(Text()), "postgresql")` → **Postgres=`TEXT[]`**(Prisma `String[]` 그대로 읽기), **SQLite=JSON**.
- 따라서 공유 Neon 의 기존 `text[]` 컬럼을 **변환 없이** 읽는다. DB 마이그레이션 불필요.
- (완전 `jsonb` 전환은 Next.js/Prisma 은퇴 후에만 — 그때도 선택사항.)

### 가산적 델타 (안전 — Prisma 무영향)

```sql
-- Tenant.enabledModules 컬럼 추가 (비면 orgType 프리셋 폴백)
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "enabledModules" jsonb NOT NULL DEFAULT '[]'::jsonb;
```

`SchemaInfo`, `ApprovalPolicy` 테이블 생성은 두 방법 중 택1:
- **간단**: 아래 alembic 을 한시적으로 `include`/부분 적용하기 번거로우므로, 해당 두 테이블의 `CREATE TABLE` DDL만 직접 실행(모델 정의 참조: `models/schema_info.py`, `models/approval_policy.py`).
- **권장**: FastAPI 를 **일시적으로 (a) 독립 DB** 로 띄워 생성된 두 테이블의 DDL 을 추출해 Neon 에 적용.

### stamp

델타 반영 후, Alembic 이력을 현재 스키마에 맞춰 고정한다:

```bash
cd backend
RUNNING_ZONE=prod DATABASE_URL="postgresql+asyncpg://...neon..." \
  uv run alembic stamp head
```

이후 FastAPI 부팅 시 `upgrade head` 는 이미 head 라 no-op → 안전.

> 참고: `migrations.py` 의 `make_sync_url()` 이 asyncpg→psycopg2 로 바꿔 Alembic 이 동작한다.

---

## 로그인 커토버 켜기

(b) 채택 완료 + FastAPI 배포 후:

1. **공유 시크릿**: FastAPI `SECRET_KEY` == Next.js `USER_JWT_SECRET` (양쪽 동일 값).
2. 프론트: `API_ORIGIN`(rewrites 대상) = FastAPI URL, `NEXT_PUBLIC_USE_PY_AUTH=true`.
3. 실 사용자로 로그인 → FastAPI 가 `user_token` 쿠키 발급 → Next.js API 가 검증(JWT 상호호환, PR #13에서 jose 로 확인).
4. 문제 시 즉시 `NEXT_PUBLIC_USE_PY_AUTH=false` 로 롤백(Strangler 토글).

---

## 롤백

- 로그인: `NEXT_PUBLIC_USE_PY_AUTH=false` → 기존 Next.js 로그인으로 즉시 복귀.
- (b) 스키마 델타는 **가산적**(컬럼/테이블 추가, permissions 타입 변경)이라 Next.js/Prisma 동작에 영향 없음.
  단, `Role.permissions` 타입 변경(text[]→jsonb)은 Prisma 클라이언트가 `String[]` 로 기대하므로,
  커토버를 되돌릴 계획이면 이 변경은 **리허설에서 Prisma 읽기 호환성**을 반드시 확인할 것.
