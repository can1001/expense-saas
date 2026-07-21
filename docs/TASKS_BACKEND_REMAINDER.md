# TASKS — 백엔드 이관 잔여분 상세

PRD: `PRD_BACKEND_REMAINDER.md`. 각 태스크는 **Description / Files / Acceptance / Verify** 로 구성.
문서의 파일 경로는 작성 시점(2026-07-20) 기준 — 반드시 grep 으로 현재 위치를 재확인한다.

---

## 공통 원칙 (모든 태스크에 적용 — 위반 시 Acceptance 불충족)

컷오버 1~3차(커밋 `186b3f1`·`2eb68fb`·`d4a2e98`)에서 정립한 레시피다.

1. **Next 라우트 원본이 계약의 truth.** 응답 JSON 키(camelCase)·상태코드·한국어 에러
   메시지를 그대로 보존한다. 프론트는 건드리지 않고 rewrite 로 투명 전환하는 것이 원칙.
   `lib/api/error-handler.ts`·`response-handler.ts` 의 에러/성공 포맷까지 확인할 것.
   (프론트 `readApiError()` 가 `{detail}`/`{error}` 둘 다 읽으므로 에러 키는 FastAPI
   관례 `detail` 로 통일해도 되지만, **성공 응답의 키·구조는 반드시 동일**해야 한다.)
2. **모든 쿼리에 tenantId 명시 스코프.** Next 는 prisma 미들웨어가 암묵 적용하지만
   FastAPI 는 수동이다. `require_tenant_id` 의존성 + 모든 select/update 에 조건 추가.
   platform/* 만 예외(전 테넌트 조회가 스펙) — 대신 platform 인증을 강제한다.
3. **메서드 패리티 필수.** rewrite 는 HTTP 메서드를 구분하지 못한다. 컷오버할 경로의
   Next 라우트가 export 하는 **모든** 메서드(`grep -E "export (const|async function) (GET|POST|PUT|PATCH|DELETE)"`)
   를 FastAPI 가 전부 구현한 뒤에만 rewrite 를 추가한다. (committees/[id] DELETE 누락 교훈)
4. **동적 세그먼트 rewrite 는 cuid 패턴** `[a-z0-9]{20,}` (Prisma cuid v1 + FastAPI cuid2
   모두 매칭, `c` 접두 가정 금지). 같은 위치에 오는 **고정 세그먼트와의 충돌을 반드시
   점검** — 고정 세그먼트가 20자 미만이거나 하이픈을 포함하면 안전, 아니면 rewrite 를
   고정 경로 나열로 풀어쓴다.
5. **계약 테스트 필수.** `backend/tests/test_budget_query_routes.py` 의 픽스처 패턴
   (인메모리 SQLite + FK ON + httpx ASGITransport + `_login` 헬퍼) 재사용. 정상 1건 +
   에러/권한 1건 이상. 테스트 삭제·`.skip` 금지.
6. **rewrite 추가는 같은 태스크에서.** `next.config.ts` beforeFiles 목록에 항목 추가.
   `API_ORIGIN` 게이트(미설정 시 비활성) 구조는 절대 제거하지 않는다.
7. **외부 서비스는 전부 모킹.** Cloudinary·kapi.kakao.com·FCM·WebPush 실호출 금지.
   허용 의존성(이 목록 외 추가 금지): `openpyxl`(C1), `cloudinary`(B2), `pywebpush`(N1),
   `firebase-admin`(N2). 추가 시 `uv add` 로 pyproject 에 기록.
8. **신규 테이블 접근이 필요하면** 먼저 `prisma/schema.prisma` 에서 해당 모델 정의를
   확인하고 SQLModel 을 `backend/expense_api/core/models/` 에 **컬럼명 camelCase 그대로**
   추가한다. DB 는 이미 존재하므로 alembic 마이그레이션은 **작성하지 않는다**(스키마
   소유권은 Prisma). 테스트는 `create_all` 로 충분.
9. **Excel 은 openpyxl.** ExcelJS 의 셀 스타일은 근사 재현(헤더 굵게·컬럼 폭 수준)이면
   충분 — 컬럼 순서·헤더 텍스트·데이터 정확성이 우선. 파일명·Content-Disposition 은
   Next 와 동일하게.
10. **권한 가드 보존.** Next 라우트의 `withPermissions(PERMISSIONS.X)` / `withAuth` /
    admin 체크를 FastAPI `require_permission` 등가물로 매핑한다. 가드 없는 라우트를
    임의로 강화하지도, 있는 가드를 약화하지도 않는다.

**태스크 공통 Verify** (각 태스크 마지막에 반드시 **포그라운드**로 실행하고 완료까지 기다린다):

전체 스위트(`pytest -q`)는 300+ 테스트로 느려서(≈2분) 백그라운드 실행 유혹이 크다 —
**절대 백그라운드로 돌리지 말 것**. 대신 이 태스크가 새로 만든/수정한 테스트 파일만
포그라운드로 돌린다 (수 초 내 완료). 전체 스위트 회귀 검사는 F1 최종 검증에서 한 번에 한다.

```bash
# 이 태스크의 테스트 파일만 (빠름 — 백그라운드 금지, 그대로 완료까지 대기)
cd backend && RUNNING_ZONE=local uv run pytest tests/test_<이_태스크_파일>.py -q && uv run ruff check
```

`<이_태스크_파일>` 은 이번 태스크에서 추가/수정한 테스트 파일명으로 치환한다(복수면 공백 나열).
파일이 여러 라우터를 건드렸으면 관련 테스트 파일을 모두 나열한다.

---

## Phase A — 계정

### A1. users 목록·생성·상세
- **Description**: `app/api/users/route.ts`(GET 목록·필터·페이지네이션, POST 생성)와
  `app/api/users/[id]/route.ts`(메서드 grep 으로 확인 — GET/PUT/DELETE 예상)를
  `backend/expense_api/core/routes/user_routes.py`(신설) 로 포팅. 비밀번호는 기존
  `hash_password` 사용. 역할/권한 필드(roles, granted)와 `isActive` 처리 보존.
- **Files**: `backend/expense_api/core/routes/user_routes.py`(신설), `backend/main.py`
  (prefix `/api/users`), `backend/tests/test_user_routes.py`(신설), `next.config.ts`
- **Acceptance**: 목록 응답 키·페이지네이션 구조 동일. 생성 시 중복 userid 409.
  [id] 전 메서드 구현 후 rewrite(`/api/users`, `/api/users/:id([a-z0-9]{20,})`) 추가.
- **Verify**: 공통 Verify.

### A2. users 보조
- **Description**: `users/by-role/[role]`, `users/quick-register`, `users/year-roles`
  포팅. year-roles 는 `UserYearRole` 모델 이미 존재.
- **Files**: `user_routes.py`, 테스트, `next.config.ts`
- **Acceptance**: by-role 은 role 이 고정 세그먼트가 아닌 파라미터임에 유의 —
  `/api/users/by-role/:role` rewrite (role 은 cuid 패턴 아님, `:role` 그대로).
  단 `/api/users/:id` rewrite 와 `by-role`·`quick-register`·`year-roles`·`me`(A3)
  고정 세그먼트가 충돌하지 않는지 점검(모두 20자 미만/하이픈 → 안전 확인 기록).
- **Verify**: 공통 Verify.

### A3. 서명 관리
- **Description**: `users/me/signatures`(GET/POST), `[id]`(DELETE 등), `[id]/default`(PUT?)
  포팅. 서명 데이터는 Text 컬럼 — `UserSignature` 모델을 prisma 스키마에서 확인 후 추가.
- **Files**: `user_routes.py` 또는 `signature_routes.py`(신설), models, 테스트, `next.config.ts`
- **Acceptance**: 3개 라우트 전 메서드 패리티 + rewrite. 본인 것만 조작 가능(userId 스코프).
- **Verify**: 공통 Verify.

### A4. 내 설정
- **Description**: `me/config`, `me/memberships` 포팅. memberships 는 Membership 모델
  (prisma 확인) — 복수 소속 조직 목록. config 는 사용자별 설정.
- **Files**: `me_routes.py`(신설, prefix `/api/me`), models(필요시), 테스트, `next.config.ts`
- **Acceptance**: 응답 구조 동일 + rewrite 2건.
- **Verify**: 공통 Verify.

### A5. auth 잔여 — 로컬
- **Description**: `auth/signup`, `auth/change-password`, `auth/switch-tenant`,
  `auth/accept-invitation` 을 `auth_routes.py` 에 추가. switch-tenant 는
  pendingTenantSelection 임시 토큰 계약(`lib/auth/user.ts` B2/B3) 을 정확히 재현 —
  기존 `test_jwt_interop.py` 가 깨지지 않아야 한다. accept-invitation 은 Invitation
  모델(prisma 확인) 필요 — D4(admin/invitations)와 같은 모델을 쓰므로 먼저 추가.
- **Files**: `backend/expense_api/core/routes/auth_routes.py`, models, 테스트, `next.config.ts`
- **Acceptance**: 쿠키 발급/삭제 동작 login/logout 과 동일 패턴. 4개 rewrite 추가.
- **Verify**: 공통 Verify.

### A6. auth 카카오
- **Description**: `auth/kakao`, `auth/link-kakao` 포팅. kapi.kakao.com 호출은
  서비스 함수로 분리하고 테스트에서 모킹. 계정 매칭 정책은
  `docs/AUTH_ACCOUNT_MATCHING_POLICY.md` 참조.
- **Files**: `auth_routes.py`, `core/service/kakao_service.py`(신설), 테스트, `next.config.ts`
- **Acceptance**: 실호출 0 (테스트에서 respx/monkeypatch 로 검증). rewrite 2건.
- **Verify**: 공통 Verify.

---

## Phase B — expenses 잔여 + 주변

### B1. 조회·상태
- **Description**: `expenses/filter-options`(필터 옵션 집계), `expenses/[id]/fix-status`,
  `expenses/[id]/payment-status` 포팅. payment-status 는 지급완료/보류 전이 +
  서명 데이터 저장 — Expense 모델에 컬럼 이미 존재.
- **Files**: `expense_routes.py` 또는 `expense_admin_routes.py`(신설), 테스트, `next.config.ts`
- **Acceptance**: `[id]` 하위 고정 세그먼트 rewrite 는 기존 `:action(...)` 나열에
  `fix-status|payment-status` 를 추가하는 방식. filter-options 는 고정 경로 rewrite.
- **Verify**: 공통 Verify.

### B2. 복제·첨부
- **Description**: `expenses/[id]/duplicate`, `expenses/[id]/attachments`(목록·업로드),
  `expenses/[id]/attachments/[attachmentId]`(삭제), `upload/`, `upload/delete` 포팅.
  Cloudinary 는 `cloudinary` 패키지 사용하되 서비스 계층으로 격리, 테스트는 모킹.
  ExpenseAttachment 모델 이미 존재.
- **Files**: `attachment_routes.py`(신설), `core/service/cloudinary_service.py`(신설),
  테스트, `next.config.ts`
- **Acceptance**: multipart 업로드 계약(필드명·응답 키) 동일. 실호출 0. rewrite 추가
  (attachments 는 2단계 동적 세그먼트 — `:id(...)/attachments`, `:id(...)/attachments/:aid(...)`).
- **Verify**: 공통 Verify.

### B3. 벌크
- **Description**: `expenses/bulk`(일괄 생성/삭제 — 메서드 grep), `expenses/bulk-expense-date`,
  `expenses/bulk-payment-status` 포팅. 트랜잭션 단위 보존(전부 성공 or 전부 실패 여부를
  Next 원본과 동일하게).
- **Files**: `expense_bulk_routes.py`(신설), 테스트, `next.config.ts`
- **Acceptance**: 대상 id 중 타 테넌트 것이 섞이면 해당 건 거부(테넌트 격리 테스트 필수).
- **Verify**: 공통 Verify.

### B4. 간편 지출
- **Description**: `simple-expenses`(GET/POST), `simple-expenses/[id]` 포팅. 간편 결의서는
  결재선 자동 확정 로직이 있음 — `approval` 서비스 재사용 여부를 원본에서 확인.
- **Files**: `simple_expense_routes.py`(신설), 테스트, `next.config.ts`
- **Acceptance**: 응답 구조 동일 + rewrite 2건.
- **Verify**: 공통 Verify.

### B5. 템플릿·계좌
- **Description**: `expense-templates` 2종, `bank-accounts` 2종 포팅. 모델(prisma 확인) 추가.
- **Files**: `misc_routes.py` 또는 도메인별 파일, models, 테스트, `next.config.ts`
- **Acceptance**: 본인 소유만 수정/삭제(userId 스코프) + rewrite 4건.
- **Verify**: 공통 Verify.

### B6. 반복 지출·설정
- **Description**: `recurring-expenses` 4종(`[id]/generate`, `process` 포함), `settings` 포팅.
  process 는 크론성 엔드포인트 — 인증 방식(시크릿 헤더?)을 원본에서 확인해 보존.
- **Files**: `recurring_routes.py`(신설), models, 테스트, `next.config.ts`
- **Acceptance**: generate 가 만드는 Expense 가 기존 expense 계약과 동일. rewrite 5건.
- **Verify**: 공통 Verify.

---

## Phase C — Excel 계열

### C1. openpyxl 도입 + budget/hierarchy/export
- **Description**: `uv add openpyxl`. `core/excel/` 유틸(워크북 생성, 헤더 스타일,
  StreamingResponse 헬퍼) 신설. `budget/hierarchy/export` 포팅 — 데이터 소스는 이미
  포팅된 `budget_query_routes.budget_hierarchy` 로직 재사용(함수 분리).
- **Files**: `backend/pyproject.toml`, `core/excel/__init__.py`(신설),
  `budget_query_routes.py`, 테스트, `next.config.ts`
- **Acceptance**: 응답 Content-Type xlsx + 파일명 패턴 동일. 테스트는 openpyxl 로
  재파싱해 헤더·행 수 검증. rewrite `/api/budget/hierarchy/export` 추가.
- **Verify**: 공통 Verify.

### C2. budget/upload
- **Description**: `lib/budget-upload.ts`(712L — parseExcelFile/uploadBudgetData/
  exportBudgetTemplate) 를 `core/service/budget_upload_service.py` 로 포팅. 대상은
  정규화 테이블(BudgetCategory/Subcategory/Detail/DetailYear/DepartmentBudgetDetail).
  replace/merge/append 모드 + dryRun + 행 단위 검증 오류 리포트 계약 보존.
- **Files**: `budget_upload_service.py`(신설), `budget_query_routes.py`, 테스트, `next.config.ts`
- **Acceptance**: dryRun=true 는 DB 무변경(테스트로 증명). 모드 3종 각 1개 테스트.
  GET(템플릿 다운로드)·POST 모두 구현 후 rewrite.
- **Verify**: 공통 Verify.

### C3. expenses Excel
- **Description**: `expenses/export/excel`, `expenses/bulk-upload`,
  `expenses/bulk-upload-template` 포팅. export 스펙은 `docs/EXCEL_EXPORT_SPEC.md` 참조.
- **Files**: `expense_excel_routes.py`(신설), 테스트, `next.config.ts`
- **Acceptance**: export 컬럼 순서·헤더 동일(스펙 문서 기준). bulk-upload 는 dryRun
  지원 여부 원본 확인. rewrite 3건.
- **Verify**: 공통 Verify.

### C4. 나머지 업로드·연도 설정
- **Description**: `users/upload`, `departments/leaders-upload`,
  `budget-details/year`, `budget-details/year/auto-assign`,
  `budget-details/[id]/description` 포팅.
- **Files**: 해당 라우터들, 테스트, `next.config.ts`
- **Acceptance**: `budget-details/year*` 는 고정 세그먼트 — 기존
  `/api/budget-details/:id` cuid rewrite 와 충돌 없음을 테스트로 확인(`year` 는 4자).
  `[id]/description` 은 2단계 경로 rewrite 별도 추가.
- **Verify**: 공통 Verify.

---

## Phase D — admin

공통: admin 가드(`PERMISSIONS` 매핑) 보존. 라우터는 `admin_routes.py` 계열로 신설,
prefix `/api/admin`. 집계 쿼리는 데이터 시드 기반 계약 테스트로 수치까지 검증.

### D1. 대시보드
- `admin/dashboard`, `admin/year-setup-status` 포팅. rewrite 2건. 공통 Verify.

### D2. 보고서
- `admin/budget-execution`, `admin/cumulative-report`, `admin/quarterly-report`,
  `admin/quarterly-report/export`(C1 의존 — Excel) 포팅. rewrite 4건. 공통 Verify.

### D3. 실행·이력
- `admin/hr-admin-execution`, `admin/manager-exceptions`, `admin/change-history` 포팅.
  change-history 는 감사로그 모델(prisma 확인) 필요할 수 있음. rewrite 3건. 공통 Verify.

### D4. 역할·초대
- `admin/roles`(GET/POST), `admin/roles/[id]`, `admin/invitations` 포팅. Role 모델은
  존재, Invitation 은 A5 에서 추가됨(없으면 여기서). rewrite 3건. 공통 Verify.

### D5. 헌금
- `admin/offerings`, `[id]`, `batch`, `template`(Excel — C1 의존) 포팅. Offering 모델
  prisma 확인 후 추가. rewrite 4건(고정 `batch`/`template` vs `[id]` cuid 충돌 점검). 공통 Verify.

### D6. 알림 관리
- `admin/notifications` 포팅 — 기존 notification_routes 와 모델 공유. rewrite 1건. 공통 Verify.

### D7. 연도 설정 초기화
- **Description**: `app/api/admin/year-config/[year]/route.ts` 포팅. F2 rewrite 전수 대조 감사에서
  Phase A~Y 어느 태스크에도 포함되지 않아 누락되었음이 발견된 라우트 (`docs/BACKEND_SEPARATION_STATUS.md`
  참조). `app/admin/year-setup-status/page.tsx`의 "연도 데이터 초기화" 버튼이 `DELETE`를 실사용 중이므로
  실제 이관 필요(죽은 코드 아님).
  - `GET /api/admin/year-config/[year]`: 해당 연도의 `UserYearRole.count()` + `BudgetDetailYear.count()`
    반환 (`{ year, data: { yearRoles, budgetDetailYears } }`). year 는 2020~2100 범위 검증, 벗어나면
    400 `{ error: '유효하지 않은 연도입니다.' }`.
  - `DELETE /api/admin/year-config/[year]`: 쿼리파라미터 `target`(`all`|`roles`|`budgets`, 기본 `all`)에
    따라 트랜잭션으로 `UserYearRole.deleteMany({year})` / `BudgetDetailYear.deleteMany({year})` 실행,
    `{ success: true, year, target, result: { yearRolesDeleted?, budgetDetailYearsDeleted? }, message }`
    반환. year 검증은 GET과 동일.
  - 권한: Next 원본은 `withPermissions(PERMISSIONS.SETTINGS_MANAGE, ...)` — FastAPI
    `require_permission(PERMISSIONS.SETTINGS_MANAGE)` 로 동일 매핑.
- **Files**: `backend/expense_api/core/routes/admin_routes.py`(또는 동일 계층의 적절한 라우터)에
  엔드포인트 추가, `backend/tests/test_admin_*.py`에 계약 테스트 추가, `next.config.ts` beforeFiles에
  `/api/admin/year-config/:year` rewrite 1건 추가(고정 세그먼트 `year-setup-status`와 충돌 없음 확인).
- **Acceptance**: GET/DELETE 응답 키·상태코드·에러 메시지가 Next 원본과 동일. 모든 쿼리 tenantId 스코프
  (`UserYearRole`/`BudgetDetailYear` 는 tenant 별도 컬럼이 없다면 상위 관계로 스코프 확인 후 반영).
  target 파라미터 3종 분기 동작 일치.
- **Verify**: 공통 Verify(신규/수정 테스트 파일만 포그라운드 실행) + `uv run ruff check`.

---

## Phase P — platform

공통: platform 은 **테넌트 스코프 예외**(전 테넌트 조회가 스펙). 대신 platform 관리자
인증을 별도 의존성으로 강제. `lib` 의 platform 세션 구현(쿠키명·시크릿)을 먼저 읽고
`core/dependencies/platform_auth.py` 를 만든 뒤 라우트를 포팅한다.

### P1. 인증
- `platform/auth/login·logout·me` + PlatformAdmin 모델(prisma 확인). 쿠키명·만료 동일.
  rewrite 3건. 공통 Verify.

### P2. 테넌트
- `platform/tenants`(GET/POST), `[id]`(메서드 grep), `[id]/settings`. rewrite 3건. 공통 Verify.

### P3. 테넌트 사용자·통계
- `[id]/users`, `[id]/users/[userId]`, `[id]/stats`. 2단계 동적 세그먼트 rewrite 주의. 공통 Verify.

### P4. 운영
- `platform/admins` 2종, `platform/activity-logs`, `platform/settings`, `platform/stats`.
  rewrite 5건. 공통 Verify.

### P5. 내보내기
- `platform/export`(C1 의존). rewrite 1건. 공통 Verify.

---

## Phase N — push

### N1. WebPush
- **Description**: `push/vapid-public-key`, `push/subscribe`, `push/unsubscribe`,
  `push/history` 포팅. 기존 notification_routes 의 `POST/DELETE /push/subscribe` 와
  계약 충돌 여부 먼저 확인 — **Next 원본이 truth**(Next 는 `push/unsubscribe` POST).
  기존 FastAPI 라우트가 원본과 다르면 원본에 맞춰 정정(테스트 갱신 포함, 해당 정정은
  이 태스크 범위). `pywebpush` 는 발송 경로만 — 테스트 모킹.
- **Acceptance**: PushSubscription 모델 prisma 대조. rewrite 4건. 공통 Verify.

### N2. FCM·테스트 발송
- `push/fcm-subscribe`, `push/fcm-test`, `push/test` 포팅. firebase-admin 초기화는
  지연 로딩(키 미설정 시 부팅 영향 0). 실발송 모킹. rewrite 3건. 공통 Verify.

---

## Phase Y — youth-night

공통: 독립 모듈. 모델들(Curriculum/Lesson/Question/Attendance/Point/Quiz/Recitation —
prisma 확인) 을 `models/youth_night.py` 로 일괄 추가. 라우터 `youth_night_routes.py`,
prefix `/api/youth-night`.

### Y1. 출석·포인트
- `attendance`, `attendance/stats`, `points`. rewrite 3건. 공통 Verify.

### Y2. 퀴즈·랭킹
- `quiz`, `quiz/stats`, `ranking`, `stats`. rewrite 4건. 공통 Verify.

### Y3. 암송
- `recitation`, `recitation/approve`. rewrite 2건. 공통 Verify.

### Y4. 관리
- `admin/curriculum`, `admin/lesson`, `admin/questions`, `admin/questions/reorder`.
  rewrite 4건. 공통 Verify.

---

## 최종 검증

### F1. 전체 테스트
- `cd backend && RUNNING_ZONE=local uv run pytest -q && uv run ruff check` 전체 통과.

### F2. rewrite 전수 대조표
- 스크립트(일회성, `scripts/` 에 두지 말고 출력만)로 3자 대조:
  ① `app/api/**/route.ts` 경로+메서드 목록, ② FastAPI `app.routes` 목록,
  ③ `next.config.ts` beforeFiles 목록. 결과 표를
  `docs/BACKEND_SEPARATION_STATUS.md` 에 갱신 기록. 누락/메서드 갭 0.

### F3. 빌드·문서
- `pnpm run build` 통과. `BACKEND_SEPARATION_STATUS.md` 에 컷오버 완료 선언 +
  M 게이트 안내 갱신.
