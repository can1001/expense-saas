# 구현 태스크: 영수증 관리 (Phase 5)

> 스펙(단일 truth): `docs/SPEC_RECEIPTS_PHASE5_2026-07-20.md`
> 각 태스크 검증 통과 후 체크(`[x]`) + 한글 커밋. 순서대로 진행 (의존성 순).

## 태스크

- [x] **R1 (S)**: `RECEIPT_READ` permission 신설
  - Files: `lib/auth/permissions.ts`, `lib/constants/menu-permissions.ts`, 관련 테스트
  - Description: `PERMISSIONS.RECEIPT_READ = 'receipt:read'` 추가, `PERMISSION_LABELS`에 '영수증 조회'
    등록, `ROLE_PERMISSION_PRESETS`의 admin·finance_head·accountant에 부여. `MENU_PERMISSIONS`에
    `{ path: '/receipts', permission: RECEIPT_READ }` 추가. ALL_PERMISSIONS 파생이 자동 반영되는지 확인.
  - Acceptance: accountant/finance_head/admin은 보유, user/team_leader는 미보유 (테스트로 대조)
  - Verify: `pnpm vitest run lib/ && pnpm run lint`
- [x] **R2 (M)**: `GET /api/receipts` — 영수증 목록 API
  - Files: `app/api/receipts/route.ts`, `app/api/receipts/__tests__/route.test.ts`
  - Description: RECEIPT_READ 가드(기존 `lib/auth/user.ts` 가드 헬퍼 패턴 grep 후 사용). `ExpenseAttachment`를
    `Expense`와 join해 썸네일 url·secureUrl·fileName·금액·부서·결의번호·status·expenseId 반환.
    기간(월)·부서·결재상태 필터. 테넌트 격리·페이지네이션은 기존 admin API 관례 따름.
  - Acceptance: 권한 없는 역할 403, 필터 동작
  - Verify: `pnpm vitest run app/api/receipts && pnpm run lint`
- [x] **R3 (M)**: `GET /api/receipts/missing` — 미첨부 현황 API
  - Files: `app/api/receipts/missing/route.ts`, 테스트
  - Description: RECEIPT_READ 가드. attachments 0건인 Expense 중 `areAllItemsReceiptExempt(items)`가
    true인 건은 제외. 신청자·부서·금액·status·작성일·expenseId 반환. 기간·부서 필터.
  - Acceptance: 예외 세목만인 결의서가 결과에서 빠지는 것을 테스트로 확인
  - Verify: `pnpm vitest run app/api/receipts && pnpm run lint`
- [x] **R4 (M)**: `/receipts` 화면 — 갤러리 + 미첨부 현황
  - Files: `app/receipts/page.tsx`, `components/receipts/ReceiptGallery.tsx`, `components/receipts/MissingReceiptList.tsx`, 테스트
  - Description: GlobalShell(title="영수증 관리"). 필터 바(월·부서·상태) + 세그먼트 탭(갤러리/미첨부).
    갤러리: 썸네일 그리드(부서·금액·결의번호·StatusPill), 클릭 시 원본 모달(secureUrl "원본 열기").
    미첨부: 리스트(행 클릭 → /expenses/{id}). 빈 상태 처리. 모바일 2열.
  - Verify: `pnpm vitest run components/receipts && pnpm run build`
- [x] **R5 (S)**: 사이드바 메뉴 노출
  - Files: `lib/constants/global-menu.ts`, 테스트
  - Description: 예약된 위치(보고서 위)에 "영수증 관리"(`/receipts`, Receipt 아이콘) 항목 추가.
    노출 조건은 `canAccessAdminMenuPathWithRoles(roles, '/receipts')`(RECEIPT_READ 파생). 하드코딩 금지.
  - Acceptance: RECEIPT_READ 보유 역할만 메뉴 노출 (테스트)
  - Verify: `pnpm vitest run lib/ components/ && pnpm run lint`
- [x] **F (S)**: 최종 검증
  - Description: `pnpm vitest run`+`pnpm run build`+`pnpm run lint` 실행. 스펙 5절 Success Criteria를
    **코드 grep/Read로 대조하고 항목별 근거(파일:라인)를 이 문서에 기록**. 미충족은 그 자리에서 고치고
    재검증. 문서 체크만 하고 끝내기 금지. SimpleExpense 포함 여부 결정도 기록.
  - Verify: 세 명령 성공 + 근거 기록

  ### 검증 결과 (2026-07-20)

  - `pnpm vitest run`: **130 files / 2392 tests 전부 통과**
  - `pnpm run build`: `✓ Compiled successfully` — `/api/receipts`, `/api/receipts/missing`,
    `/receipts` 라우트 모두 정상 생성 확인
  - `pnpm run lint`: **0 errors** (기존 111 warnings는 전부 Phase 5 이전 파일; `pnpm run lint 2>&1 |
    grep -i receipt` 결과 0건으로 신규 파일 lint 이슈 없음 확인)

  ### 스펙 5절 Success Criteria 대조

  - [x] `RECEIPT_READ` permission 신설, admin·finance_head·accountant 프리셋에 부여, 라벨 등록
    - `lib/auth/permissions.ts:80` `RECEIPT_READ: 'receipt:read'`
    - `lib/auth/permissions.ts:131` `[PERMISSIONS.RECEIPT_READ]: '영수증 조회'` (라벨)
    - `lib/auth/permissions.ts:259` `admin: [...ALL_PERMISSIONS]` (전체 파생 포함)
    - `lib/auth/permissions.ts:274` finance_head 프리셋에 `P.RECEIPT_READ`
    - `lib/auth/permissions.ts:289` accountant 프리셋에 `P.RECEIPT_READ`
  - [x] `GET /api/receipts` — 필터 동작, RECEIPT_READ 없는 역할은 403 (테스트로 확인)
    - `app/api/receipts/route.ts:94` `withPermissions(PERMISSIONS.RECEIPT_READ, handleGet)` 가드
    - `app/api/receipts/route.ts:18-33` month/department/status 필터
    - `app/api/receipts/__tests__/route.test.ts:68,77` user/team_leader 403 테스트
  - [x] `GET /api/receipts/missing` — 예외 세목만인 결의서는 결과에서 제외 (테스트로 확인)
    - `app/api/receipts/missing/route.ts:79` `withPermissions(PERMISSIONS.RECEIPT_READ, handleGet)` 가드
    - `app/api/receipts/missing/route.ts:6,49` `areAllItemsReceiptExempt` 재사용해 필터
    - `app/api/receipts/missing/__tests__/route.test.ts:97` "예외 세목만인 결의서는 결과에서 제외된다" 테스트
  - [x] `/receipts` 화면: 딥그린 GlobalShell + 갤러리 + 미첨부 현황, 사이드바에 "영수증 관리" 노출
    (RECEIPT_READ 보유 시에만)
    - `app/receipts/page.tsx:4,80` `GlobalShell title="영수증 관리"`
    - `components/receipts/ExpenseStatusPill.tsx:1` 기존 `components/ui/StatusPill` 재사용(래퍼)
    - `lib/constants/global-menu.ts:70-71` `canAccessAdminMenuPathWithRoles(roles, '/receipts')` 파생 노출
      (역할 하드코딩 없음)
    - `lib/constants/__tests__/global-menu.test.ts:21,28` 보유/미보유 역할 노출 대조 테스트
  - [x] 원본 열기(secureUrl) 동작, 빈 상태 처리
    - `components/receipts/ReceiptGallery.tsx:107,112` `href={selected.secureUrl}` "원본 열기" 링크
    - `components/receipts/ReceiptGallery.tsx:32` / `MissingReceiptList.tsx:24` `length === 0` 빈 상태 분기
  - [x] `pnpm vitest run` 전체 통과 · `pnpm run build` 성공 · 신규 파일 lint 0건
    - 위 검증 결과 참조

  ### SimpleExpense 포함 여부 결정

  - `app/api/receipts/`, `components/receipts/`에 `SimpleExpenseAttachment` 참조 **없음**
    (grep 결과 0건) — 스펙 6절 Open Questions 대로 **1차 범위는 `ExpenseAttachment`만** 포함,
    SimpleExpense 영수증은 백로그로 남김 (별도 태스크 필요 시 분리)
