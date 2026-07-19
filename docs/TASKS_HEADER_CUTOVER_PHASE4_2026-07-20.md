# 구현 태스크: Header 완전 대체 + 폼·보고서 토큰 (Phase 4)

> 스펙(단일 truth): `docs/SPEC_HEADER_CUTOVER_PHASE4_2026-07-20.md`
> 각 태스크 검증 통과 후 체크(`[x]`) + 한글 커밋. 순서대로 진행 (의존성 순).

## 태스크

- [ ] **G1 (M)**: `GlobalShell` 추출
  - Files: `components/layout/GlobalShell.tsx`, `components/layout/__tests__/GlobalShell.test.tsx`, `components/dashboard/DashboardShell.tsx`
  - Description: DashboardShell의 셸 부분(사용자 fetch·전역 사이드바·탑바·SidebarUserCard)을
    `GlobalShell`(props: title, actions?, children)로 일반화. DashboardShell은 GlobalShell을 사용하도록
    리팩터링(동작 무변화 — 기존 테스트 통과 유지).
  - Verify: `pnpm vitest run components/layout/ components/dashboard/ && pnpm run lint`
- [ ] **G2 (L·예외 허용)**: expenses 그룹 7화면 이관
  - Files: `app/expenses/page.tsx`, `app/expenses/new/page.tsx`, `app/expenses/[id]/page.tsx`, `app/expenses/[id]/edit/page.tsx`, `app/expenses/simple/new/page.tsx`, `app/expenses/simple/[id]/page.tsx`, `app/expenses/simple/[id]/edit/page.tsx`
  - Description: 각 페이지에서 `<Header />` 제거하고 GlobalShell로 감싼다. 페이지 내부 데이터 로직·
    필터·무한스크롤·모바일 카드 무변경. 목록 페이지 CTA("+ 작성")는 탑바 actions로.
  - Verify: `pnpm vitest run && pnpm run build`
- [ ] **G3 (M)**: mypage 그룹 6화면 이관
  - Files: `app/mypage/page.tsx`, `password/`, `send-notification/`, `signatures/`, `notifications/`, `kakao/` 각 page.tsx
  - Verify: `pnpm vitest run && pnpm run build`
- [ ] **G4 (M)**: recurring-expenses 4화면 + HomeClient 이관
  - Files: `app/recurring-expenses/{page,new/page,[id]/page,[id]/edit/page}.tsx`, `components/HomeClient.tsx`
  - Description: 정기 지출 4화면 + 일반 사용자 홈(HomeClient — 카드 그리드 유지, 셸만 교체, title "홈").
  - Verify: `pnpm vitest run && pnpm run build`
- [ ] **G5 (M)**: youth-night 5화면 기계적 이관
  - Files: `app/youth-night/**` 의 Header 사용 클라이언트 5개
  - Description: 숨김 기능 — GlobalShell로 기계적 교체만, 기능·내용 무변경.
  - Verify: `pnpm vitest run && pnpm run build`
- [ ] **G6 (S)**: Header.tsx 삭제 + withHeader 옵션 제거
  - Files: `components/Header.tsx`(삭제), `components/layout/AppShell.tsx`, Header 전용 테스트(있으면 삭제)
  - Description: `grep -rln "from '@/components/Header'" app components` **0건 근거를 이 문서에 기록한
    후에만** 삭제. AppShell의 withHeader 옵션·주석 정리.
  - Verify: grep 0건 + `pnpm vitest run && pnpm run build`
- [ ] **G7 (M)**: 작성 폼 토큰 전환 (색상만)
  - Files: `components/expense-form/**`, `components/simple-expense-form/**` 중 blue 사용 파일
  - Description: 주요 액션 버튼 `bg-blue-600/700`→`bg-brand-600/700`, hover·focus·활성 상태 →
    brand 토큰, 상태 뱃지 → StatusPill. 필드 구조·검증·제출 로직 무변경. 변경 파일 목록을 커밋에 명시.
  - Verify: `pnpm vitest run && pnpm run lint`
- [ ] **G8 (S)**: 보고서·차트 토큰 전환 (색상만)
  - Files: `components/reports/**`, `components/charts/**`, `app/reports/financial/**` 중 색상 지정 파일
  - Description: 차트 기본 팔레트·보고서 강조색을 brand 계열로. 라이브러리·데이터 로직 무변경.
  - Verify: `pnpm vitest run && pnpm run lint`
- [ ] **F (S)**: 최종 검증
  - Description: `pnpm vitest run`+`pnpm run build`+`pnpm run lint` 실행. 스펙 4절 Success Criteria를
    **코드 grep/Read로 대조하고 항목별 근거(파일:라인 또는 grep 결과)를 이 문서에 기록**.
    미충족은 그 자리에서 고치고 재검증. 문서 체크만 하고 끝내기 금지.
  - Verify: 세 명령 성공 + 근거 기록
