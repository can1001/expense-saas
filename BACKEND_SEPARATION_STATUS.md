# 백엔드 분리(Python/FastAPI) 작업 현황 정리

> **작성일**: 2026-07-17
> **목적**: Next.js 모놀리스(Prisma/Neon)에서 Python(FastAPI) 백엔드를 분리하는 작업의
> **완료 내역**과 **남은 작업**을 한눈에 정리한다.
> **정본 로드맵**: `spec_python_refactoring.md` §12 (Strangler Fig, Phase 0~6)
> **실행 기록**: `backend/README.md`(Phase 체크리스트), `backend/DEPLOY.md`(배포 런북)

---

## 1. 한 줄 요약

**Phase 0~4(스캐폴딩·인증/테넌시·예산·지출/결재·알림) 백엔드 구현 완료. 배포 인프라(Dockerfile·render.yaml·런북)까지 준비됨.**
다만 **실제 운영 배포와 프론트 전면 커토버는 미실행**(로그인만 플래그 토글로 전환 가능한 PoC 단계)이며, **Phase 5(교회 전용 모듈)·Phase 6(정리)는 미착수**.

```
전략: Strangler Fig — 프론트(Next.js)는 유지, app/api/** 만 도메인 단위로 FastAPI 이전
경로: 브라우저 → Next.js(:3000) → /api/py/* rewrites → FastAPI(:8000) → SQLite(local)/Neon PG(prod)
```

---

## 2. 작업 타임라인 (git 히스토리 기준)

| 날짜 | PR/커밋 | 내용 |
|---|---|---|
| 07-13 | PR #4 | (선행 정지작업) 풀 RBAC 리팩터링 — 인가를 permission 단일 출처로 통합 |
| 07-13 | PR #5 (`c1f1da4`, `9f3693c`) | **Phase 0~2**: FastAPI 스캐폴딩 + 테넌시/인증 + 예산 계층. 리뷰 4건(rate limit·테넌트 격리·Secure 쿠키·통합테스트) 반영 |
| 07-13 | `f8d274b` | **Phase 3**: 지출결의서 CRUD + 결재 워크플로우 |
| 07-13 | `0f28c2f` | **Phase 3.x**: 설정형 결재선(ApprovalPolicy) — 교회 하드코딩 일반화 |
| 07-13 | PR #7 | CI에 FastAPI lint·단위테스트 job 추가 |
| 07-14/16 | PR #8 (`0be58dc`) | 결재선 조건부·병렬·대리결재 확장 |
| 07-16 | PR #10 (`7bdf816`) | **Phase 4**: 알림 — 어댑터 패턴 + 결재 이벤트 연동 |
| 07-16 | PR #11 (`4c0173e`) | FK 하드닝 — 테스트 FK 강제 + `ondelete=CASCADE`(Prisma 대응) |
| 07-16 | PR #13 (`802e08e`) | FastAPI JWT를 Next.js와 **상호호환** — 로그인 커토버 관문 |
| 07-16 | PR #12 (`c8ddddf`) | 프론트 연동 PoC — `/api/py` 프록시 경유 로그인·me·예산 (`py-demo` 페이지) |
| 07-16 | PR #14 (`ab5beec`) | 로그인 FastAPI 커토버 플래그(`NEXT_PUBLIC_USE_PY_AUTH`) + 다중 alembic head 수정 |
| 07-16 | PR #15 (`91cadcd`) | 결재 재제출(RESUBMIT) + 결재선 수정(MODIFY_LINE) |
| 07-16 | PR #17 (`49fbebe`) | **배포 준비** — Render 설정(backend/render.yaml) + 배포 런북(DEPLOY.md, §9 데이터 채택) |
| 07-16 | PR #18 (`5aef879`) | `Role.permissions` dialect-variant — 공유 Neon `text[]` 무변환 읽기 |
| 07-17 | PR #19, `50aaac2` | 프론트 CI 초록화(lint/build/e2e/coverage) + e2e 시드 스크립트 수정·재활성화 |

---

## 3. 완료된 작업 (Phase별)

### Phase 0 — 스캐폴딩 ✅
- `backend/` FastAPI(Python 3.12) + SQLModel + Alembic + uv 구조 생성 (`expense_api/core/` 패키지, routes/service/repository/models/schemas/domain 계층 분리)
- `RUNNING_ZONE` 기반 DB 스위칭: local=SQLite, prod=Neon PostgreSQL (+ zone guard, prod 부팅 검증 — SQLite/기본 SECRET_KEY 차단)
- lifespan에서 alembic 자동 마이그레이션 → 검증 → (local) 데모 시드
- `/health`, JWT 인증 골격, CORS, Next.js `/api/py/*` rewrites 프록시

### Phase 1 — 인증/사용자/테넌시 ✅
- `Tenant`/`SuperAdmin`/`User`/`Role`/`UserYearRole` 모델, 서브도메인 스코핑 로그인(bcrypt), `/api/auth/login·me·logout`
- RBAC: 프리셋 + DB `Role.permissions` 폴백 resolver, `require_permission` 의존성
- 멀티테넌시: `TenantScopedRepository` 베이스로 테넌트 격리 강제, rate limit
- `Tenant.enabledModules` + 모듈 게이팅(`/api/tenant/info`) — 교회/회사 세그먼트 대비

### Phase 2 — 예산 계층 ✅
- 예산 7개 모델(Committee ~ BudgetDetailYear, DepartmentBudgetDetail)
- 5단계 캐스케이드 `POST /api/budget`(기존 `BudgetSelector` 계약 유지), 예산 마스터 목록/생성 API

### Phase 3 — 지출/결재 ✅ (일부 도메인 잔여 — §5 참고)
- `Expense`/`ExpenseItem`/`ExpenseAttachment` + 결재 3모델(ApprovalLine/Step/Log)
- 지출결의서 CRUD(생성은 항상 DRAFT), 금액 서버 재계산(10원 절사)
- 결재 엔진(순수 상태전이): submit/approve/reject/withdraw + **재제출(RESUBMIT)·결재선 수정(MODIFY_LINE)·조건부·병렬·대리결재(delegate)**
- **Phase 3.x**: 설정형 결재선 `ApprovalPolicy` — 교회 직제 하드코딩(482줄)을 테넌트별 설정으로 일반화, 결재선 미리보기 API

### Phase 4 — 알림 ✅ (실 SDK 잔여)
- `NotificationPreference`/`NotificationLog`/`PushSubscription` + 어댑터 패턴(채널 추상화)
- 결재 이벤트(제출/승인/반려 등) → 알림 발행 연동, 선호 설정·구독 API

### 횡단 작업 ✅
- **JWT 상호호환**: FastAPI 발급 토큰을 Next.js가 검증(issuer=`expense-saas`, audience=`tenant-user`, 공유 시크릿) — 로그인 커토버의 전제 (PR #13, `test_jwt_interop.py`)
- **공유 Neon 호환**: `Role.permissions`를 dialect-variant(PG=`TEXT[]`/SQLite=JSON)로 처리해 기존 Prisma `text[]` 데이터를 변환 없이 읽음 (PR #18)
- FK 하드닝(`ondelete=CASCADE`, 테스트에서 FK 강제), 다중 alembic head 병합 수정
- Alembic 이식성 규칙 문서화(SQLite↔PG, Boolean `server_default`는 `sa.false()/sa.true()`만)
- CI: 백엔드 lint·pytest job(PR #7) + 프론트 lint/build/e2e/coverage 초록화(PR #19)
- 테스트: pytest 11개 파일, **75개 테스트 함수** (phase0~4, 결재 확장, JWT interop 등)

### 배포 준비 ✅ (실행은 미완)
- `backend/Dockerfile`(python:3.12-slim 멀티스테이지 + uv), `docker-entrypoint.sh`(`alembic upgrade head` → uvicorn)
- `backend/render.yaml`: Render Docker 웹서비스 `expense-api`, healthCheck `/health`, `RUNNING_ZONE=prod`
- `backend/DEPLOY.md` 런북: (a) 독립 DB — 즉시 배포 가능 / (b) 공유 Neon DB — 델타 반영 + `alembic stamp head` + 로그인 커토버. 롤백은 `NEXT_PUBLIC_USE_PY_AUTH=false` 토글

### 프론트 연동 (PoC 단계) ✅
- `next.config.ts` rewrites: `/api/py/:path*` → `${API_ORIGIN}/api/:path*`
- `lib/api/py-client.ts`: FastAPI 클라이언트(login/me/budgetCascade, `{detail}` 에러 파싱)
- `app/login/page.tsx`: `NEXT_PUBLIC_USE_PY_AUTH=true`면 FastAPI 로그인, 아니면 기존 Next.js — **플래그 한 개로 커토버/롤백**
- `app/py-demo/page.tsx`: 브라우저에서 FastAPI 왕복 검증용 데모 페이지

---

## 4. 현재 아키텍처 상태

```
[브라우저]
   │
[Next.js :3000] ─── 대부분의 화면 ──▶ 기존 app/api/** (Prisma → Neon)   ← 현재 프로덕션 경로
   │
   └── /api/py/* rewrites ──▶ [FastAPI :8000] ──▶ SQLite(local) / Neon(prod)
         └ 로그인(플래그 off 상태) · py-demo 페이지만 사용 중
```

즉 **백엔드 구현 폭은 넓지만(인증~알림), 실제 트래픽 전환은 아직 0** — 로그인 커토버 플래그는 배선만 완료.

---

## 5. 남은 작업

### A. 운영 배포/커토버 (최우선 관문)
- [ ] Render에 `expense-api` 서비스 실제 생성(대시보드 수동) + env 입력(`DATABASE_URL`, `SECRET_KEY`(=Next.js `USER_JWT_SECRET`), `CORS_ORIGINS`)
- [ ] **Neon 브랜치(복제본)에서 리허설** (DEPLOY.md 요구사항)
- [ ] 공유 Neon DB 델타 반영: `SchemaInfo`·`ApprovalPolicy` 테이블 생성, `Tenant.enabledModules` 컬럼 추가(가산적, 무파괴)
- [ ] `alembic stamp head`로 기존 스키마 baseline 채택
- [ ] 로그인 커토버: `API_ORIGIN` 지정 + `NEXT_PUBLIC_USE_PY_AUTH=true` (롤백 = 플래그 off)
- [ ] (별건, RBAC Phase 5) 운영 Neon의 Role 불리언 5컬럼 물리 제거 — 신 코드 배포와 같은 릴리스에서 `npm run deploy:migrate` 1회 (`docs/RBAC_PHASE5_MIGRATION.md`)

### B. Phase 3/4 잔여 도메인 (FastAPI 미이전)
- [ ] **SimpleExpense**(간편지출), **RecurringExpense**(정기지출/자동이체 배치), **ExpenseTemplate**
- [ ] 지급상태(PaymentStatus) 관리 API
- [ ] 첨부/업로드 — Cloudinary 어댑터 구현
- [ ] 알림 실 SDK 주입 — web-push/FCM/SMS/카카오 구현체 + WebPushLog

### C. Phase 5 — 재정보고서/청나잇/부가 (미착수)
- [ ] `admin/*-report`(재정보고서), `youth-night`(청나잇), `offerings`(헌금), `settings`
- [ ] 스펙 §15.6에 따라 `church_pack` 라우터로 이전 + `enabledModules` 게이팅 적용

### D. Phase 6 — 정리 (미착수)
- [ ] 이전 완료된 Next.js `app/api/**` 라우트 제거
- [ ] 프록시/rewrites 정리, `py-demo`·PoC 코드 정리
- [ ] 문서화 마무리 (CLAUDE.md·README의 아키텍처 반영 포함)

### E. 프론트 전면 전환
- [x] 인증(로그인 유지)·예산(캐스케이드/마스터 CRUD)·지출(목록/상세/쓰기)·결재(액션/목록/카운트/결재선)
      화면 트래픽을 `NEXT_PUBLIC_PY_DOMAINS` 도메인별 피처 플래그로 FastAPI 경유 전환 완료
      (`docs/TASKS_FRONTEND_CUTOVER.md` C0~C10, `PRD_FRONTEND_CUTOVER.md` F1~F3 그린)
- [ ] 알림(push/FCM) 도메인은 범위 제외 — 미전환
- [ ] 스펙 §14 착수 전 합의 체크리스트 잔여 항목 확정(Render 2서비스 분리 배포, ID 전략(cuid2), 토큰 저장 방식 등)

---

## 6. 참고 문서 지도

| 문서 | 내용 |
|---|---|
| `spec_python_refactoring.md` | 정본 스펙 — 목표 아키텍처, Phase 0~6 로드맵, SQLite↔PG 이식성 규칙, 멀티테넌시 세그먼트 전략 |
| `backend/README.md` | Phase별 완료 체크리스트, 로컬 실행법, 데모 계정 |
| `backend/DEPLOY.md` | 배포 런북 — 독립 DB vs 공유 Neon 두 모드, 델타 표, 커토버/롤백 절차 |
| `status.md` + `docs/RBAC_PHASE5_MIGRATION.md` | 선행 RBAC 리팩터링 기록 + 운영 DB 컬럼 제거 런북 |
| `backend/render.yaml` | FastAPI Render 배포 정의 |

> 참고: `progress.txt`, `work-logs/`, `tasks/`, `docs/remaining-tasks.md`는 백엔드 분리 이전 시기(Next.js/Prisma)의 레거시 기록으로, 이 작업과 무관.
