# 구현 태스크: Header 완전 대체 + 폼·보고서 토큰 (Phase 4)

> 스펙(단일 truth): `docs/SPEC_HEADER_CUTOVER_PHASE4_2026-07-20.md`
> 각 태스크 검증 통과 후 체크(`[x]`) + 한글 커밋. 순서대로 진행 (의존성 순).

## 태스크

- [x] **G1 (M)**: `GlobalShell` 추출
  - Files: `components/layout/GlobalShell.tsx`, `components/layout/__tests__/GlobalShell.test.tsx`, `components/dashboard/DashboardShell.tsx`
  - Description: DashboardShell의 셸 부분(사용자 fetch·전역 사이드바·탑바·SidebarUserCard)을
    `GlobalShell`(props: title, actions?, children)로 일반화. DashboardShell은 GlobalShell을 사용하도록
    리팩터링(동작 무변화 — 기존 테스트 통과 유지).
  - Verify: `pnpm vitest run components/layout/ components/dashboard/ && pnpm run lint`
- [x] **G2 (L·예외 허용)**: expenses 그룹 7화면 이관
  - Files: `app/expenses/page.tsx`, `app/expenses/new/page.tsx`, `app/expenses/[id]/page.tsx`, `app/expenses/[id]/edit/page.tsx`, `app/expenses/simple/new/page.tsx`, `app/expenses/simple/[id]/page.tsx`, `app/expenses/simple/[id]/edit/page.tsx`
  - Description: 각 페이지에서 `<Header />` 제거하고 GlobalShell로 감싼다. 페이지 내부 데이터 로직·
    필터·무한스크롤·모바일 카드 무변경. 목록 페이지 CTA("+ 작성")는 탑바 actions로.
  - Verify: `pnpm vitest run && pnpm run build`
- [x] **G3 (M)**: mypage 그룹 6화면 이관
  - Files: `app/mypage/page.tsx`, `password/`, `send-notification/`, `signatures/`, `notifications/`, `kakao/` 각 page.tsx
  - Verify: `pnpm vitest run && pnpm run build`
- [x] **G4 (M)**: recurring-expenses 4화면 + HomeClient 이관
  - Files: `app/recurring-expenses/{page,new/page,[id]/page,[id]/edit/page}.tsx`, `components/HomeClient.tsx`
  - Description: 정기 지출 4화면 + 일반 사용자 홈(HomeClient — 카드 그리드 유지, 셸만 교체, title "홈").
  - Verify: `pnpm vitest run && pnpm run build`
- [x] **G5 (M)**: youth-night 5화면 기계적 이관
  - Files: `app/youth-night/**` 의 Header 사용 클라이언트 5개
  - Description: 숨김 기능 — GlobalShell로 기계적 교체만, 기능·내용 무변경.
  - Verify: `pnpm vitest run && pnpm run build`
  - 결과: `YouthNightClient.tsx`, `curriculum/[curriculumId]/CurriculumDetailClient.tsx`,
    `[ageGroup]/AgeGroupClient.tsx`, `[ageGroup]/lessons/[lessonId]/LessonDetailClient.tsx`,
    `admin/YouthNightAdminClient.tsx` 5개 파일에서 `<Header />`+wrapping div 제거,
    `<GlobalShell title="...">`로 교체(제목: 청나잇/커리큘럼명/연령그룹명/레슨명/청나잇 관리자).
    데이터 fetch·상태·핸들러·기능 무변경. `pnpm vitest run` 2360 tests passed,
    `pnpm run build` 성공.
- [x] **G6 (S)**: Header.tsx 삭제 + withHeader 옵션 제거
  - Files: `components/Header.tsx`(삭제), `components/layout/AppShell.tsx`, Header 전용 테스트(있으면 삭제)
  - Description: `grep -rln "from '@/components/Header'" app components` **0건 근거를 이 문서에 기록한
    후에만** 삭제. AppShell의 withHeader 옵션·주석 정리.
  - Verify: grep 0건 + `pnpm vitest run && pnpm run build`
  - 결과: 삭제 전 `grep -rln "from '@/components/Header'" app components` → 유일한 참조는
    `components/layout/AppShell.tsx` 1건. 그 외 "Header" 텍스트 매치(PrintHeader, tableHeader,
    주석 "// Header" 등)는 무관함을 확인. `AppShell`을 사용하는 모든 콜사이트
    (`app/approvals/page.tsx`, `app/approvals/[id]/page.tsx`, `components/admin/AdminLayout.tsx`)는
    `withHeader`를 전달하지 않아(기본값 `false`) 실제로 `<Header />`가 렌더된 적이 없었음을 확인.
    Header 전용 테스트 파일 없음(`find . -iname "*Header*test*"` 0건). `components/Header.tsx` 삭제,
    `AppShell.tsx`에서 `withHeader` prop·import·조건부 렌더·sticky top 삼항 분기 제거.
    삭제 후 재확인: `grep -rln "from '@/components/Header'" app components` → 0건(exit 1).
    `pnpm vitest run` → 125 test files / 2360 tests passed. `pnpm run build` → exit 0 성공.
- [x] **G7 (M)**: 작성 폼 토큰 전환 (색상만)
  - Files: `components/expense-form/**`, `components/simple-expense-form/**` 중 blue 사용 파일
  - Description: 주요 액션 버튼 `bg-blue-600/700`→`bg-brand-600/700`, hover·focus·활성 상태 →
    brand 토큰, 상태 뱃지 → StatusPill. 필드 구조·검증·제출 로직 무변경. 변경 파일 목록을 커밋에 명시.
  - Verify: `pnpm vitest run && pnpm run lint`
  - 결과: `grep -rl "blue-" components/expense-form components/simple-expense-form` 결과 10개 파일
    (`ApprovalLinePreview.tsx`, `MemoTooltip.tsx`, `ItemsSection.tsx`, `SimpleExpenseWizard.tsx`,
    `WizardStep1.tsx`, `WizardStep2.tsx`, `TemplateSelector.tsx`, `SaveTemplateModal.tsx`,
    `SimpleItemsSection.tsx`, `WizardNavigation.tsx`)에서 `bg-blue-*/text-blue-*/border-blue-*/
    ring-blue-*` → 대응 `brand-*` 토큰으로 전환(50→50, 100/200→100, 300/400→500, 500→500,
    600→600, 700→700, 900→900; `from-blue-50 to-indigo-50` → `from-brand-50 to-brand-100`).
    필드 구조·검증·제출 로직·이벤트 핸들러 무변경(클래스명만 치환). 상태 뱃지는 이 두 디렉터리에서
    green 계열(자동승인 뱃지, `ApprovalLinePreview.tsx:222`) 뿐으로 blue 기반 상태 뱃지 없음 —
    StatusPill 전환 대상 없음 확인. `lib/constants/styles.ts`의 `BTN_PRIMARY` 등 공유 상수는
    `app/admin/**` 등 30여 화면 전역에서 재사용되어 범위 초과이므로 미변경(스펙 2.4의 대상
    디렉터리 한정 해석). 전환 후 `grep -rn "blue-\|indigo-" components/expense-form
    components/simple-expense-form` → 0건. `pnpm vitest run` → 125 test files / 2360 tests
    passed. `pnpm run lint` → 0 errors(기존 warning 111건은 본 변경과 무관).
- [ ] **G8 (S)**: 보고서·차트 토큰 전환 (색상만)
  - Files: `components/reports/**`, `components/charts/**`, `app/reports/financial/**` 중 색상 지정 파일
  - Description: 차트 기본 팔레트·보고서 강조색을 brand 계열로. 라이브러리·데이터 로직 무변경.
  - Verify: `pnpm vitest run && pnpm run lint`
- [ ] **F (S)**: 최종 검증
  - Description: `pnpm vitest run`+`pnpm run build`+`pnpm run lint` 실행. 스펙 4절 Success Criteria를
    **코드 grep/Read로 대조하고 항목별 근거(파일:라인 또는 grep 결과)를 이 문서에 기록**.
    미충족은 그 자리에서 고치고 재검증. 문서 체크만 하고 끝내기 금지.
  - Verify: 세 명령 성공 + 근거 기록
