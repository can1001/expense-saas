# 구현 태스크: 홈 회계 대시보드 (Phase 2)

> 스펙(단일 truth): `docs/SPEC_DASHBOARD_PHASE2_2026-07-18.md`
> 각 태스크 완료 시 검증 통과 후 체크(`[x]`) + 한글 커밋. 위에서부터 순서대로 진행 (의존성 순).

## 태스크

- [ ] **P1 (M)**: 대시보드 KPI + 최근 결의서 — `DashboardClient` 골격
  - Files: `components/dashboard/DashboardClient.tsx`, `components/dashboard/__tests__/DashboardClient.test.tsx`
  - Description: `'use client'`. `/api/admin/dashboard?year=${getFiscalYear()}` fetch →
    StatCard 4장(대기 결재 `kpi.pendingApprovals`건 / 이번 달 지출 `kpi.monthlyExpense`원 /
    예산 집행률 `kpi.executionRate`% + ProgressBar / 지급 대기 `kpi.pendingPayments`건) +
    최근 지출결의서 테이블(`recentExpenses`: 신청자·부서·금액·StatusPill 상태, 행 클릭 시 `/expenses/{id}`,
    헤더에 "전체 보기 →" 링크 `/expenses`). 로딩은 기존 `components/ui/Skeleton` 사용, 실패 시 한글 에러 문구.
  - Acceptance: 상태 매핑(스펙 3절), 금액 `₩`+toLocaleString+tabular-nums, 아이콘은 lucide-react
  - Verify: `pnpm vitest run components/dashboard/ && pnpm run lint`
- [ ] **P2 (S)**: 부서별 예산 집행 패널
  - Files: `components/dashboard/DepartmentBudgetPanel.tsx`, `components/dashboard/__tests__/DepartmentBudgetPanel.test.tsx`
  - Description: `/api/admin/budget-execution` fetch (응답 구조는 `app/api/admin/budget-execution/route.ts`를
    읽고 확인). 부서별 집행률(사용액/예산액)을 이름+%+ProgressBar 리스트로. 90% 이상 부서가 있으면
    하단에 `bg-status-pending-bg` 경고 배너("⚠ {부서} 예산 90% 초과"). DashboardClient에 패널 배치
    (데스크톱 우측 1/3, 모바일 하단).
  - Acceptance: 90% 임계값에서 ProgressBar 앰버 전환 + 배너, 부서 0곳이면 배너 없음
  - Verify: `pnpm vitest run components/dashboard/ && pnpm run lint`
- [ ] **P3 (M)**: 홈 역할 분기 + 전역 사이드바 적용
  - Files: `app/page.tsx`, `components/dashboard/DashboardShell.tsx` (신규 — AppShell+전역 Sidebar 조립)
  - Description: `app/page.tsx`에서 `canAccessAdminMenuWithRoles(user.roles || [user.role])`이면
    `DashboardShell`(AppShell withHeader + `getGlobalSidebarMenu(user, {pendingApprovalCount})` 기반
    공용 Sidebar + 드로어 상태 관리 + DashboardClient) 렌더, 아니면 **기존 HomeClient 그대로**.
    결재함 뱃지는 `usePendingApprovalCount`. 탑바 title="회계 대시보드",
    actions에 "+ 지출결의서 작성" 버튼(`/expenses/new`, `bg-brand-700`).
  - Acceptance: 일반 사용자 경로는 코드 변경 없음(HomeClient props 동일), 서버 컴포넌트에서 클라이언트로
    user 전달 시 기존 HomeClient 인터페이스 재사용
  - Verify: `pnpm vitest run && pnpm run build`
- [ ] **P4 (S)**: 사이드바 사용자 카드
  - Files: `components/layout/SidebarUserCard.tsx`, `components/layout/__tests__/SidebarUserCard.test.tsx`, `components/dashboard/DashboardShell.tsx`
  - Description: Sidebar `footer` 슬롯용 카드 — 아바타(이름 첫 글자, `bg-brand-500`)·이름·이메일(없으면 userid),
    클릭 시 메뉴(마이페이지 `/mypage`, 로그아웃). 로그아웃은 `Header.tsx`의 기존 패턴
    (`apiBase('auth')/auth/logout` POST 후 `/login` 이동)을 그대로 따른다.
  - Acceptance: ESC/외부 클릭으로 메뉴 닫힘, 텍스트 대비는 사이드바 토큰(`text-side-text` 등) 사용
  - Verify: `pnpm vitest run components/layout/ && pnpm run lint`
- [ ] **P5 (S)**: "자동이체" → "정기 지출" 라벨 통일
  - Files: `grep -rn "자동이체" components app lib --include='*.tsx' --include='*.ts'`로 사용자 노출 라벨만 찾아 변경
    (API 응답 필드·DB 값·주석 내 도메인 설명은 제외, 화면 표시 문자열만)
  - Acceptance: Header 메뉴·recurring-expenses 페이지 타이틀이 "정기 지출"로 표기, 기능 무변화
  - Verify: `pnpm vitest run && pnpm run lint`
- [ ] **P6 (S)**: HomeClient의 `/youth-night` 잔여 링크 제거
  - Files: `components/HomeClient.tsx`
  - Description: Header에서 이미 주석 처리된 청나잇 메뉴의 잔여 카드 링크 제거. 다른 카드는 건드리지 않음.
  - Verify: `pnpm vitest run && pnpm run lint`
- [ ] **P7 (S)**: 최종 검증
  - Description: `pnpm vitest run` 전체 + `pnpm run build` + `pnpm run lint` 실행, 스펙 5절 Success Criteria
    전 항목 대조. 실패 항목 있으면 고치고 재검증. 통과 시 본 문서 상단에 "완료: YYYY-MM-DD" 추기.
  - Verify: 세 명령 모두 성공
