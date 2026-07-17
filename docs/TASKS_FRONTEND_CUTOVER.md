# TASKS — 프론트 전면 전환 (FastAPI 커토버) 태스크 상세

> 진행 상태는 `PRD_FRONTEND_CUTOVER.md` 체크박스가 정본.
> 각 태스크의 Description / Files / Acceptance / Verify 가 단일 truth.

## 공통 원칙 (모든 태스크에 적용)

1. **레거시 계약 우선**: FastAPI 응답이 기존 Next.js 라우트의 JSON 형태(필드명·중첩·에러 `{error}` vs `{detail}`)와 다르면, **화면 코드를 고치지 말고 FastAPI 스키마를 레거시 계약에 맞춘다**. 화면 쪽은 URL 프리픽스 전환만 하는 것이 원칙. (에러 처리는 C1 헬퍼가 `{detail}`→`{error}` 정규화 가능)
2. **플래그 off = 무변경**: `NEXT_PUBLIC_PY_DOMAINS` 미설정 시 모든 fetch가 기존 `/api/*` 그대로 나가야 한다. 기존 vitest 스위트(2,000+)가 무변경 통과하는 것이 그 증거다.
3. **인증은 쿠키**: 화면은 Authorization 헤더를 만들지 않는다. `/api/py/*` rewrites 프록시가 `user_token` 쿠키를 그대로 전달하고, FastAPI가 쿠키 폴백(C0)으로 인증한다.
4. **테넌트 스코핑**: FastAPI 리포지토리는 `TenantScopedRepository` 경유 — 신규 엔드포인트도 반드시 이 베이스를 쓴다.
5. 백엔드 파일 수정 시 반드시 `cd backend && RUNNING_ZONE=local uv run pytest -q`도 Verify에 포함한다.

---

## C0. FastAPI 인증 쿠키 폴백

**Description**: `backend/expense_api/core/dependencies/auth.py`의 `get_current_user`는 현재 `HTTPBearer(auto_error=True)` 전용. Bearer 헤더가 없으면 `user_token` 쿠키(이름은 Next.js `lib/auth/user.ts`의 `COOKIE_NAME`과 동일)에서 토큰을 읽도록 폴백을 추가한다. `HTTPBearer(auto_error=False)`로 바꾸고, 헤더·쿠키 둘 다 없으면 기존과 동일한 401. FastAPI 로그인이 굽는 쿠키(`auth_routes.py` `_COOKIE_NAME = "user_token"`)와 이미 이름이 같으므로 상수를 공유 위치로 옮겨도 좋다(선택).

**Files**: `backend/expense_api/core/dependencies/auth.py`, (필요시) `backend/expense_api/core/routes/auth_routes.py`, 테스트 `backend/tests/test_auth_routes.py` 또는 신규 `backend/tests/test_cookie_auth.py`

**Acceptance**:
- Bearer 헤더 인증 기존 동작 불변 (기존 pytest 전부 통과)
- Bearer 없이 `user_token` 쿠키만으로 보호 엔드포인트(예: `/api/auth/me`) 200
- 둘 다 없으면 401, 만료/위조 쿠키면 401

**Verify**: `cd backend && RUNNING_ZONE=local uv run pytest -q`

---

## C1. 프론트 도메인 스위치 헬퍼

**Description**: `lib/api/api-base.ts` 신규. `NEXT_PUBLIC_PY_DOMAINS`(쉼표 구분, 예: `"auth,budget,expenses,approvals"`)를 파싱해 두 함수를 노출:
- `pyEnabled(domain: string): boolean`
- `apiBase(domain: string): string` — 켜져 있으면 `"/api/py"`, 아니면 `"/api"`
추가로 응답 에러 정규화 유틸 `readApiError(res, data): string` — FastAPI `{detail}`·레거시 `{error}` 모두에서 메시지를 꺼낸다(기존 `py-client.ts`의 패턴 재사용). 화면 전환 태스크(C2~C10)는 이 헬퍼만 사용한다.

**Files**: `lib/api/api-base.ts`(신규), `lib/api/__tests__/api-base.test.ts`(신규), `.env.example`(변수 문서화 1줄)

**Acceptance**:
- 미설정/빈 값 → 모든 도메인 off, `apiBase()`가 `"/api"` 반환
- `"auth, budget"`처럼 공백 섞인 입력도 정상 파싱
- vitest로 위 케이스 + `readApiError` 양쪽 형식 검증

**Verify**: `pnpm exec vitest run lib/api && pnpm run lint`

---

## C2. 인증 전환 (me / logout)

**Description**: `/api/auth/me` 호출처를 `apiBase('auth')` 경유로 전환. 호출처(그때 grep으로 재확인): `lib/hooks/useFetchCurrentUser.ts`(공용 훅), `components/Header.tsx`(me L296·logout L342), `components/admin/AdminSidebar.tsx`, `components/admin/AdminLayout.tsx`, `app/expenses/page.tsx`, `app/expenses/[id]/page.tsx`, `app/expenses/[id]/edit/page.tsx`, `app/approvals/page.tsx`, `app/approvals/[id]/page.tsx`, `app/mypage/page.tsx`, `app/mypage/send-notification/page.tsx`.
**선행 확인**: FastAPI `/api/auth/me` 응답(`MeResponse`)과 레거시 `/api/auth/me` 응답 형태를 비교해 차이가 있으면 FastAPI 스키마를 레거시에 맞춘다(공통 원칙 1). logout은 FastAPI가 `user_token` delete_cookie를 수행하는지 확인하고, Next.js와 쿠키 속성(path 등)이 일치해야 실제 로그아웃된다.

**Files**: 위 호출처 + `backend/expense_api/core/routes/auth_routes.py`·`schemas`(계약 정합 필요 시) + 영향받는 기존 테스트 갱신

**Acceptance**:
- 플래그 off: 기존 테스트 무변경 통과
- 플래그 on(`auth`): me·logout이 `/api/py/auth/*`로 나가고 응답 필드가 레거시와 동일 (훅/컴포넌트 코드 로직 무수정)

**Verify**: `pnpm exec vitest run && pnpm run lint` (+백엔드 수정 시 `cd backend && RUNNING_ZONE=local uv run pytest -q`)

---

## C3. 예산 캐스케이드 전환

**Description**: `components/BudgetSelector.tsx`(POST `/api/budget`), `app/admin/year-roles/page.tsx`·`app/admin/year-roles-summary/page.tsx`(GET `/api/budget`)를 `apiBase('budget')` 경유로 전환. FastAPI `POST /api/budget` 응답 `{field, options}` 및 `GET /api/budget` 응답이 레거시와 같은지 비교, 다르면 FastAPI를 맞춘다. (`/api/budget/search` 등 서브 경로는 FastAPI 미구현 — 레거시 유지, 건드리지 않음)

**Files**: `components/BudgetSelector.tsx`, `app/admin/year-roles/page.tsx`, `app/admin/year-roles-summary/page.tsx` (+백엔드 계약 정합 필요 시 `backend/expense_api/core/routes/budget_routes.py`·schemas)

**Acceptance**: 플래그 off 무변경 / on 시 `/api/py/budget` 경유로 5단계 캐스케이드 동작(기존 BudgetSelector 테스트가 계약을 증명)

**Verify**: `pnpm exec vitest run && pnpm run lint` (+백엔드 수정 시 pytest)

---

## C4. 예산 마스터 조회 전환

**Description**: committees / departments / budget-categories / budget-subcategories / budget-details **GET 목록**을 `apiBase('budget-master')` 경유로 전환. 주 호출처: `app/admin/budget-wizard/page.tsx`, `app/admin/budget-items/page.tsx`, `app/admin/committees/page.tsx`, `app/admin/departments/page.tsx`, `app/admin/memo-examples/page.tsx`(GET 부분), `app/admin/budget-managers/page.tsx`(`/api/budget-details/year`는 FastAPI 미구현 — 레거시 유지). FastAPI 목록 응답 형태를 레거시와 비교·정합.

**Files**: 위 admin 페이지들의 GET fetch + (정합 필요 시) `backend/expense_api/core/routes/budget_master_routes.py`·schemas

**Acceptance**: 플래그 off 무변경 / on 시 5종 목록이 `/api/py/*` 경유. 레거시 전용 서브 경로(leaders-upload, budget-details/year, upload)는 그대로 `/api/*`.

**Verify**: `pnpm exec vitest run && pnpm run lint` (+백엔드 수정 시 pytest)

---

## C5. 예산 마스터 쓰기 보강 + 전환

**Description**: 두 부분.
(1) **백엔드 보강**: 프론트는 수정에 PUT이 아닌 **PATCH `/{id}`**(부분 수정 + `isActive` 소프트 삭제 토글)를 쓰고, 하드 DELETE는 **departments만** 쓴다. FastAPI `budget_master_routes.py`에 5개 리소스의 `PATCH /{id}`와 `DELETE /departments/{id}`를 레거시 라우트(`app/api/committees/[id]/route.ts` 등)의 계약(요청 body·응답·에러코드)에 맞춰 구현. 권한 게이팅은 기존 POST와 동일 패턴. pytest 추가.
(2) **프론트 전환**: `app/admin/committees/page.tsx`(POST/PATCH), `app/admin/departments/page.tsx`(POST/PATCH/DELETE), `app/admin/budget-items/page.tsx`(PATCH 토글), `app/admin/budget-wizard/page.tsx`(POST 5종)를 `apiBase('budget-master')` 경유로 전환. (`memo-examples`의 `/api/budget-details/{id}/description` PATCH는 FastAPI 미구현이면 이번 범위에서 구현하거나 레거시 유지 중 택일 — 구현 시 계약 일치 필수)

**Files**: `backend/expense_api/core/routes/budget_master_routes.py`, `backend/expense_api/core/schemas/**`, `backend/tests/`(신규 테스트), 위 admin 페이지 4~5개

**Acceptance**:
- pytest: PATCH 부분수정·isActive 토글·타테넌트 404/403, departments DELETE 정상+참조 무결성
- 플래그 on 시 마스터 생성/수정/토글/삭제가 FastAPI 경유로 동작, off 시 무변경

**Verify**: `cd backend && RUNNING_ZONE=local uv run pytest -q && cd .. && pnpm exec vitest run && pnpm run lint`

---

## C6. 지출 목록/상세 조회 전환

**Description**: `app/expenses/page.tsx`의 목록 GET(`/api/expenses?...`)과 `app/expenses/[id]/page.tsx`·`[id]/edit/page.tsx`·`components/ExpenseForm.tsx`(L187)의 상세 GET을 `apiBase('expenses')` 경유로 전환. **선행 확인**: 레거시 목록 라우트(`app/api/expenses/route.ts`)의 쿼리 파라미터(페이지네이션·상태·기간·검색 필터)와 응답 형태를 FastAPI `expense_routes.py` `GET ""`(`ExpenseListOut`)과 비교, 부족한 필터·필드를 FastAPI에 보강한다. 목록 화면이 쓰는 레거시 전용 경로(filter-options, export/excel, duplicate, bulk-*)는 레거시 유지.

**Files**: `app/expenses/page.tsx`, `app/expenses/[id]/page.tsx`, `app/expenses/[id]/edit/page.tsx`, `components/ExpenseForm.tsx`(GET 부분), `backend/expense_api/core/routes/expense_routes.py`·`repository`·schemas(필터 보강), `backend/tests/`(필터 테스트)

**Acceptance**: pytest 필터 케이스 통과. 플래그 on 시 목록/상세/편집 로드가 FastAPI 경유, off 무변경.

**Verify**: `cd backend && RUNNING_ZONE=local uv run pytest -q && cd .. && pnpm exec vitest run && pnpm run lint`

---

## C7. 지출 쓰기 보강 + 전환

**Description**:
(1) **백엔드 보강**: FastAPI에 `PUT /api/expenses/{id}`(전체 교체 — 레거시 `app/api/expenses/[id]/route.ts` PUT 계약: items 재작성, 금액 서버 재계산 10원 절사, DRAFT/REJECTED만 수정 허용 등 레거시 규칙 확인 후 동일하게)와 `DELETE /api/expenses/{id}`(레거시 삭제 규칙 동일) 구현 + pytest.
(2) **프론트 전환**: `components/ExpenseForm.tsx`(POST L313 / PUT L274 — `apiEndpoint` prop 주입부는 expenses 도메인일 때만 전환, simple-expenses는 레거시 유지), `app/expenses/[id]/page.tsx`(DELETE L134). `useExpenseFormSubmit`/`useOfflineExpense`/`lib/sync/**`의 오프라인 경로는 **건드리지 않는다**(범위 제외 — 온라인 제출 경로만 전환).

**Files**: `backend/expense_api/core/routes/expense_routes.py`, `service/repository/schemas`, `backend/tests/`, `components/ExpenseForm.tsx`, `app/expenses/[id]/page.tsx`

**Acceptance**: pytest — PUT 항목 교체·금액 재계산·상태 규칙·테넌트 격리, DELETE 규칙. 플래그 on 시 생성/수정/삭제 FastAPI 경유, off 무변경.

**Verify**: `cd backend && RUNNING_ZONE=local uv run pytest -q && cd .. && pnpm exec vitest run && pnpm run lint`

---

## C8. 결재 액션 전환

**Description**: `components/approval/ApprovalActionButtons.tsx`의 submit(L74·재제출 L124)/withdraw(L158)/approve·reject(L207-211), `components/ExpenseForm.tsx`의 생성 직후 submit(L368·L418), 상세 화면의 `/api/expenses/{id}/approval` GET을 `apiBase('approvals')` 경유로 전환. FastAPI `approval_routes.py`에 전부 존재 — 요청 body(반려 사유 등)·응답(`WorkflowResult`·`ApprovalLineOut`)을 레거시 계약과 비교·정합. 재제출은 레거시처럼 submit 재사용이 프론트 계약 — FastAPI submit이 REJECTED 상태에서 재제출을 허용하는지 확인(전용 `/resubmit`이 필요한 경우 FastAPI 쪽 submit에서 위임 처리).

**Files**: `components/approval/ApprovalActionButtons.tsx`, `components/ExpenseForm.tsx`, `app/expenses/[id]/page.tsx`(approval GET), (정합 필요 시) `backend/expense_api/core/routes/approval_routes.py`·schemas

**Acceptance**: 플래그 on 시 제출/승인/반려/회수/재제출·결재 진행 조회가 FastAPI 경유, off 무변경. 관련 기존 vitest(ApprovalActionButtons 등) 통과.

**Verify**: `pnpm exec vitest run && pnpm run lint` (+백엔드 수정 시 pytest)

---

## C9. 결재 목록/카운트 보강 + 전환

**Description**:
(1) **백엔드 보강**: 레거시 `app/api/approvals/route.ts`(GET — `approverName`/`status` 쿼리로 내 결재 대기/처리 목록)와 `app/api/approvals/pending-count/route.ts`(GET)를 FastAPI에 구현(`approval_routes.py` 또는 신규 `approvals_list_routes.py`, 레거시 응답 계약 동일) + pytest.
(2) **프론트 전환**: `app/approvals/page.tsx`(L94), `hooks/usePendingApprovalCount.ts`를 `apiBase('approvals')` 경유로 전환. `app/approvals/[id]/page.tsx`의 조회도 같은 도메인 플래그로 전환(사용 엔드포인트를 grep으로 확인 후 FastAPI에 있는 것만).

**Files**: `backend/expense_api/core/routes/`(신규/확장), `backend/tests/`, `app/approvals/page.tsx`, `app/approvals/[id]/page.tsx`, `hooks/usePendingApprovalCount.ts`

**Acceptance**: pytest — 결재자 기준 목록·상태 필터·카운트·테넌트 격리. 플래그 on 시 결재함 화면 FastAPI 경유, off 무변경.

**Verify**: `cd backend && RUNNING_ZONE=local uv run pytest -q && cd .. && pnpm exec vitest run && pnpm run lint`

---

## C10. 결재선 계산 전환

**Description**: `components/expense-form/ApprovalLinePreview.tsx`(L79)의 POST `/api/approval-line/calculate`를 `apiBase('approvals')` 경유로 전환. FastAPI `approval_policy_routes.py`의 `POST /approval-line/calculate`(`CalculatedLineOut`) 응답을 레거시 계약과 비교·정합.

**Files**: `components/expense-form/ApprovalLinePreview.tsx`, (정합 필요 시) `backend/expense_api/core/routes/approval_policy_routes.py`·schemas

**Acceptance**: 플래그 on 시 결재선 미리보기 FastAPI 경유, off 무변경. 기존 ApprovalLinePreview 테스트 통과.

**Verify**: `pnpm exec vitest run && pnpm run lint` (+백엔드 수정 시 pytest)

---

## F1. 프론트 전체 그린

**Verify**: `pnpm run lint && pnpm exec vitest run` — 전체 통과. 실패 시 원인 수정(테스트 삭제·skip 금지).

## F2. 백엔드 전체 그린

**Verify**: `cd backend && RUNNING_ZONE=local uv run pytest -q` — 전체 통과.

## F3. 빌드·회귀

**Verify**: `pnpm run build` 통과. 플래그 관련 env가 기본 미설정 상태에서 전체 vitest 통과(레거시 경로 회귀 없음의 증거). `.env.example`에 `NEXT_PUBLIC_PY_DOMAINS` 문서화 확인. `BACKEND_SEPARATION_STATUS.md` §5-E에 전환 완료 도메인 목록 반영(문서 갱신).
