# Spec: Header 완전 대체 + 폼·보고서 토큰 적용 (Phase 4)

> 상위 문서: `docs/DESIGN_SYSTEM_2026-07-18.md` · 선행: Phase 3 (PR #28, main=13740c8 반영 완료)
> 태스크: `docs/TASKS_HEADER_CUTOVER_PHASE4_2026-07-20.md` · 실행: ralph 루프 (`scripts/ralph/CLAUDE_HEADER_CUTOVER_PHASE4.md`)

## 0. 전제 (Assumptions)

1. Header 잔여 사용처는 24곳: expenses 7 · mypage 6 · youth-night 5 · recurring-expenses 4 ·
   HomeClient 1 · AppShell(withHeader 옵션). 전부 이관 후 **Header.tsx를 삭제**한다.
2. 이관 수단은 **`GlobalShell`** — Phase 2의 `DashboardShell`을 일반화한 재사용 셸
   (전역 사이드바 + 탑바 + 사용자 fetch + 결재함 뱃지). 페이지는 데이터·로직 무변경으로 셸만 교체.
3. youth-night는 숨김 기능이므로 **기계적 이관만** (리디자인 없음).
4. 폼·보고서 "리디자인"의 Phase 4 범위: **색상·버튼·상태 표기의 토큰 전환**
   (`bg-blue-*` → `bg-brand-*`, 상태 뱃지 → StatusPill). 레이아웃·필드 구조 변경은 하지 않는다.
5. 모바일 UX: Header의 모바일 드로어가 사라지므로, GlobalShell의 모바일 햄버거 → 전역 Sidebar
   드로어가 그 역할을 대체한다 (Phase 1 Sidebar 드로어 재사용).

## 1. Objective

모든 화면에서 상단 Header를 제거하고 딥그린 AppShell(사이드바+탑바)로 통일한다.
지출결의서 작성 폼과 보고서 화면의 색상을 디자인 토큰으로 전환한다.

## 2. 설계

### 2.1 GlobalShell

```tsx
// components/layout/GlobalShell.tsx — DashboardShell 일반화
<GlobalShell title="지출결의서" actions={<CTA/>}>{children}</GlobalShell>
```
- 내부: `/auth/me` fetch → `getGlobalSidebarMenu(user, {pendingApprovalCount})` 사이드바 +
  탑바(TenantSwitcher 권한자·TopbarBell·TopbarUserMenu) + `SidebarUserCard` footer.
- 미로그인/로딩 처리: 기존 DashboardShell·AdminLayout 패턴 재사용.
- `DashboardShell`은 GlobalShell을 사용하도록 리팩터링 (동작 무변화).

### 2.2 화면 그룹별 이관 (페이지 로직 무변경)

| 그룹 | 파일 수 | 탑바 title | 비고 |
|------|---------|-----------|------|
| expenses | 7 | "지출결의서" 등 페이지별 | 목록의 필터·무한스크롤·모바일 카드 유지 |
| mypage | 6 | "마이페이지" 등 | |
| recurring-expenses | 4 | "정기 지출" | |
| HomeClient(일반 사용자 홈) | 1 | "홈" | 카드 그리드 내용 유지, 셸만 교체 |
| youth-night | 5 | 기존 타이틀 | 기계적 교체만 |

### 2.3 Header 제거

- 사용처 0 확인(grep 근거 기록) 후 `components/Header.tsx` 삭제,
  `AppShell`의 `withHeader` 옵션·Header import 제거.
- Header 전용 테스트가 있으면 함께 삭제, Header가 제공하던 기능(드롭다운·뱃지·테넌트 전환)이
  Topbar 컴포넌트로 모두 대체되었는지 항목별 대조.

### 2.4 폼·보고서 토큰 전환 (색상만)

- `components/expense-form/**`, `components/simple-expense-form/**`: 주요 액션 버튼
  `bg-blue-600/700` → `bg-brand-600/700`, 포커스 링·활성 상태 → brand 토큰,
  상태 뱃지 → `StatusPill`. 필드 구조·검증 로직 무변경.
- `app/reports/financial` + `components/reports/**`, `components/charts/**`:
  차트 기본 색상만 brand 계열 토큰으로, 라이브러리 교체 없음.

## 3. Boundaries

- **Always**: 토큰 유틸리티만 · 권한 파생 함수만 · 페이지 데이터 로직 무변경 ·
  커밋 전 태스크별 Verify · 한글 커밋 · 태스크당 파일 8개 이하(화면 그룹 이관은 예외적으로 허용)
- **Ask first (= ralph에서는 하지 않음)**: 신규 API/DB · 의존성 추가 · 폼 필드/검증 로직 변경 ·
  라우트 이동 · global-menu 항목 변경
- **Never**: 역할 하드코딩 · 테스트 삭제로 통과시키기(단, Header.tsx 삭제 시 Header 전용 테스트
  삭제는 허용) · backend/ 수정 · youth-night 기능 수정

## 4. Success Criteria

- [ ] `grep -rln "from '@/components/Header'" app components` 결과 0건, Header.tsx 삭제됨
- [ ] 모든 화면(로그인·오프라인 제외)이 딥그린 사이드바 + 탑바로 렌더링
- [ ] 지출결의서 목록·작성·상세, 마이페이지, 정기 지출의 기존 기능 회귀 없음 (기존 테스트 전체 통과)
- [ ] 작성 폼·보고서에서 blue 계열 주요 액션이 brand 토큰으로 전환
- [ ] `pnpm vitest run` 전체 통과 · `pnpm run build` 성공 · 신규/수정 파일 lint 0건
