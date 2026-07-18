# 구현 태스크: 결재함 리디자인 + Header 탑바 이관 (Phase 3)

> 스펙(단일 truth): `docs/SPEC_APPROVALS_HEADER_PHASE3_2026-07-19.md`
> 선행 조건: Phase 2 브랜치 main 머지. 각 태스크 검증 통과 후 체크(`[x]`) + 한글 커밋. 순서대로 진행.

## 태스크

- [x] **H1 (S)**: 로그아웃 공통 훅 추출
  - Files: `lib/hooks/useLogout.ts`(신규 — 기존 훅 위치 관례 grep으로 확인), `components/layout/SidebarUserCard.tsx`, 테스트 1개
  - Description: Header.tsx·SidebarUserCard에 중복된 로그아웃 로직(`apiBase('auth')/auth/logout` POST →
    `/login` 이동)을 훅으로 추출하고 SidebarUserCard가 사용하도록 교체. Header.tsx는 건드리지 않는다.
  - Verify: `pnpm vitest run components/layout/ lib/hooks/ && pnpm run lint`
- [x] **H2 (M)**: `TopbarUserMenu` — Header 드롭다운 이관
  - Files: `components/layout/TopbarUserMenu.tsx`, `components/layout/__tests__/TopbarUserMenu.test.tsx`
  - Description: Header.tsx의 데스크톱 사용자 드롭다운을 읽고(마이페이지·서명·비밀번호·알림 설정/발송/히스토리·
    사용자 등록·로그아웃) **항목과 노출 조건을 1:1 동일**하게 컴포넌트로 이관. 권한은 기존 파생 함수
    (`canShowUserRegisterMenu` 등) 재사용, 로그아웃은 H1 훅. ESC/외부 클릭 닫힘, 아바타는 `bg-brand-500`.
  - Acceptance: 역할별 노출 항목이 Header 드롭다운과 동일 (테스트로 대조)
  - Verify: `pnpm vitest run components/layout/ && pnpm run lint`
- [x] **H3 (S)**: `TopbarBell` + AppShell 탑바 슬롯
  - Files: `components/layout/TopbarBell.tsx`, `components/layout/AppShell.tsx`, 테스트 1개
  - Description: 벨 아이콘 → `/mypage/notification-history` 링크. 미확인 카운트용 기존 훅/API가 있는지
    grep으로 확인해 있으면 dot 표시, 없으면 링크만 (신규 API 금지 — 결과를 이 파일에 기록).
    AppShell에 `topbarExtra` 슬롯(벨·아바타·테넌트 전환 배치용) 추가.
  - Verify: `pnpm vitest run components/layout/ && pnpm run lint`
  - 결과: 사용자별 미확인 알림 카운트 훅/API 없음 확인
    (`app/api/admin/notifications`는 관리자 발송 이력 조회용, `NotificationLog`/`AdminNotification`
    모델에 읽음 여부 필드 없음 — `prisma/schema.prisma:1159`, `1380`) → dot 미구현, 링크만 렌더.
- [ ] **H4 (M)**: AppShell 채택 화면에서 Header 제거
  - Files: `components/dashboard/DashboardShell.tsx`, `components/admin/AdminLayout.tsx`
  - Description: 두 화면에서 `withHeader` 제거하고 탑바에 TenantSwitcher(권한자만 — Header에서 노출 조건
    확인)·TopbarBell·TopbarUserMenu 배치. AdminLayout 로딩 화면의 Header도 대체.
    사용자 정보는 기존 fetch 패턴(`/auth/me`) 재사용.
  - Acceptance: 두 화면에서 상단 Header 미표시 + 로그아웃·테넌트 전환 동작, 다른 화면은 Header 유지
  - Verify: `pnpm vitest run && pnpm run build`
- [ ] **A1 (M)**: 결재선 스테퍼 재스타일
  - Files: `components/approval/ApprovalLineDisplay.tsx`, `components/approval/__tests__/ApprovalLineDisplay.test.tsx`
  - Description: props 인터페이스 무변경으로 내부 렌더링을 목업 스테퍼 스타일로 —
    완료 노드 `bg-brand-500`+체크, 진행선 그린/회색, 대기 노드 `status-pending-bar` 3px 링,
    반려 `status-rejected`. 승인 시각·서명·코멘트 정보량 유지. 기존 테스트 있으면 통과 유지.
  - Verify: `pnpm vitest run components/approval/ && pnpm run lint`
- [ ] **A2 (M)**: 결재함 목록 리디자인
  - Files: `app/approvals/page.tsx` (+필요 시 하위 컴포넌트 분리 1개)
  - Description: AppShell(전역 사이드바, title="결재함") 적용 + Header 제거. 상태 표기를 `StatusPill`로
    통일. 기존 필터·정렬·무한스크롤·모바일 카드 동작 유지 (데이터 fetch 로직 무변경).
  - Verify: `pnpm vitest run && pnpm run build`
- [ ] **A3 (S)**: 결재함 상세 적용
  - Files: `app/approvals/[id]/page.tsx`
  - Description: AppShell 적용 + Header 제거, `ApprovalStatusBadge` 사용처를 `StatusPill`로 교체
    (다른 화면 사용처는 grep 확인 후 그대로 둠). `ApprovalActionButtons` 동작 무변경.
  - Verify: `pnpm vitest run && pnpm run lint`
- [ ] **F (S)**: 최종 검증
  - Description: `pnpm vitest run` + `pnpm run build` + `pnpm run lint` 실행, 스펙 5절 Success Criteria
    전 항목을 **실제 코드 grep/Read로 대조**하고 각 항목 옆에 확인 근거(파일:라인)를 남긴다.
    미충족 항목은 고친 후 재검증. 문서 체크만 하고 끝내는 것 금지.
  - Verify: 세 명령 모두 성공 + Success Criteria 전 항목 근거 기록
