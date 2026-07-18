# Spec: 결재함 리디자인 + Header 탑바 이관 (Phase 3)

> 상위 문서: `docs/DESIGN_SYSTEM_2026-07-18.md` · 선행: Phase 2 (브랜치 `20260718-dashboard-phase2`, **main 머지 필수**)
> 태스크: `docs/TASKS_APPROVALS_HEADER_PHASE3_2026-07-19.md` · 실행: ralph 루프 (`scripts/ralph/CLAUDE_APPROVALS_PHASE3.md`)

## 0. 전제 (Assumptions)

1. **Phase 2가 main에 머지된 후 시작한다** — DashboardShell·SidebarUserCard·global-menu를 재사용.
2. **"Header 완전 대체"의 Phase 3 범위**: Header는 현재 27개 파일에서 사용 중이므로 전면 제거는
   하지 않는다. 탑바 대체 컴포넌트(사용자 메뉴·알림·테넌트 전환)를 완성하고,
   **AppShell 채택 화면(홈 대시보드·admin·결재함)에서만 `withHeader`를 제거**한다.
   나머지 26곳은 Phase 4에서 화면 단위 이관.
3. **결재함은 UI만 변경** — 결재 로직·API·권한 판정 무변경. 기존
   `ApprovalActionButtons`(승인/반려 액션)의 동작을 그대로 유지한다.
4. 결재선 스테퍼 데이터는 기존 `ApprovalLineDisplay`의 props(ApprovalLine.steps:
   stepNumber/stepName/approverName/status/approvedAt/comment)를 그대로 사용 — 신규 API 없음.

## 1. Objective

- **A. Header 탑바 이관**: Header의 사용자 드롭다운(마이페이지 4종·사용자 등록·테넌트 전환·로그아웃)과
  결재 대기 뱃지를 AppShell 탑바용 컴포넌트로 이관하고, AppShell 채택 화면에서 Header 제거.
- **B. 결재함 리디자인**: 목록(`/approvals`)과 상세(`/approvals/[id]`)를 딥그린 토큰·StatusPill·
  스테퍼(목업 v0.3 "결재 진행 현황" 스타일)로 재구성. AppShell 적용.

## 2. 현재 구조 (구현 시 반드시 재확인)

| 대상 | 위치 | 비고 |
|------|------|------|
| Header 드롭다운 | `components/Header.tsx` (637줄) | 서명 관리·비밀번호·알림 설정/발송/히스토리·사용자 등록(`canShowUserRegisterMenu`)·테넌트 전환(`TenantSwitcher`)·로그아웃(`apiBase('auth')/auth/logout` POST → `/login`) |
| 결재함 목록 | `app/approvals/page.tsx` (340줄) | 자체 Header 렌더링 |
| 결재함 상세 | `app/approvals/[id]/page.tsx` (493줄) | `ApprovalLineDisplay`·`ApprovalActionButtons`·`BudgetInfoPanel` 사용 |
| 결재선 표시 | `components/approval/ApprovalLineDisplay.tsx` | 스테퍼로 재스타일할 대상 |
| 상태 뱃지 | `components/approval/ApprovalStatusBadge.tsx` | `StatusPill`로 통합 |

## 3. 설계

### 3.1 파트 A — 탑바 컴포넌트

- `components/layout/TopbarUserMenu.tsx`: 아바타 버튼 → 드롭다운.
  항목·노출 조건은 **Header.tsx 드롭다운과 1:1 동일**하게 이관 (권한 함수 재사용:
  `canShowUserRegisterMenu` 등). `SidebarUserCard`(Phase 2)와 로그아웃 로직 공유 — 중복 구현 금지,
  공통 훅으로 추출(`lib/hooks/` 또는 기존 위치 관례).
- `components/layout/TopbarBell.tsx`: 벨 아이콘 + 미확인 표시 dot,
  클릭 시 `/mypage/notification-history`. 데이터는 기존 훅/API 범위 내에서만 (신규 API 금지 —
  없으면 dot 없이 링크만).
- `AppShell`: `actions` 옆에 벨·아바타 슬롯 반영, `withHeader` 기본 유지하되
  **홈 대시보드(DashboardShell)·AdminLayout·결재함에서 withHeader 제거** + 탑바에
  TenantSwitcher(권한자)·TopbarBell·TopbarUserMenu 배치.
- Header.tsx 자체는 수정 최소화(삭제 금지) — 다른 26개 화면이 계속 사용.

### 3.2 파트 B — 결재함

- 목록: AppShell(전역 사이드바) 적용, 행/카드 상태를 `StatusPill`로 통일, 각 건에
  "현재 단계 n/총 m" 요약 표시(목록 API에 있는 필드만 사용 — 없으면 상태 필만).
  모바일 카드 레이아웃·스와이프 등 기존 동작 유지.
- 상세: `ApprovalLineDisplay`를 목업 스테퍼 스타일로 재작성 —
  완료 단계 `bg-brand-500` 체크 노드 + 그린 연결선, 대기 단계 `status-pending-bar` 링 노드,
  반려 `status-rejected`. 승인 시각·서명·코멘트 표기는 기존 정보량 유지.
  `ApprovalStatusBadge` 사용처를 `StatusPill`로 교체하고 파일은 deprecated 주석 후 유지
  (다른 사용처가 있으면 그대로 둠 — grep으로 확인).

## 4. Boundaries

- **Always**: 토큰 유틸리티만 사용 · 권한은 파생 함수만 · 결재 API·로직 무변경 ·
  커밋 전 `pnpm vitest run`+`pnpm run lint` · 한글 커밋 · 각 태스크 파일 5개 이하
- **Ask first (= ralph에서는 하지 않음)**: 신규 API/DB · 의존성 추가 · Header.tsx 삭제 또는
  26개 잔여 사용처 이관 · 결재 단계/승인 규칙 변경 · admin-menu IA 변경
- **Never**: 역할 하드코딩 · 테스트 삭제/skip · backend/ 수정 · 승인/반려 버튼 동작 변경

## 5. Success Criteria

- [x] 홈 대시보드·admin·결재함에서 상단 Header가 사라지고 탑바(벨·아바타 메뉴·테넌트 전환)로 대체
- [x] 탑바 아바타 메뉴가 기존 Header 드롭다운과 동일 항목·동일 권한 노출 (역할별 대조)
- [x] 로그아웃이 탑바·사이드바 카드 어디서든 동작 (공통 훅, 중복 구현 없음)
- [x] 결재함 목록: 딥그린 사이드바 + StatusPill, 기존 필터·무한스크롤·모바일 동작 유지
- [x] 결재함 상세: 스테퍼 표시 (완료 그린/대기 앰버/반려 레드), 승인·반려 액션 기존과 동일 동작
- [x] Header를 쓰는 나머지 화면(지출결의서 목록 등)은 회귀 없음
- [x] `pnpm vitest run` 전체 통과 · `pnpm run build` 성공 · 신규 파일 lint 0건

근거: `docs/TASKS_APPROVALS_HEADER_PHASE3_2026-07-19.md`의 태스크 F 결과 참조 (2026-07-19)

## 6. Open Questions

- 탑바 벨의 미확인 카운트 데이터 소스가 기존에 없으면 dot 생략(링크만) — 구현 중 확인 후 태스크에 기록
