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
- [x] **H4 (M)**: AppShell 채택 화면에서 Header 제거
  - Files: `components/dashboard/DashboardShell.tsx`, `components/admin/AdminLayout.tsx`
  - Description: 두 화면에서 `withHeader` 제거하고 탑바에 TenantSwitcher(권한자만 — Header에서 노출 조건
    확인)·TopbarBell·TopbarUserMenu 배치. AdminLayout 로딩 화면의 Header도 대체.
    사용자 정보는 기존 fetch 패턴(`/auth/me`) 재사용.
  - Acceptance: 두 화면에서 상단 Header 미표시 + 로그아웃·테넌트 전환 동작, 다른 화면은 Header 유지
  - Verify: `pnpm vitest run && pnpm run build`
- [x] **A1 (M)**: 결재선 스테퍼 재스타일
  - Files: `components/approval/ApprovalLineDisplay.tsx`, `components/approval/__tests__/ApprovalLineDisplay.test.tsx`
  - Description: props 인터페이스 무변경으로 내부 렌더링을 목업 스테퍼 스타일로 —
    완료 노드 `bg-brand-500`+체크, 진행선 그린/회색, 대기 노드 `status-pending-bar` 3px 링,
    반려 `status-rejected`. 승인 시각·서명·코멘트 정보량 유지. 기존 테스트 있으면 통과 유지.
  - Verify: `pnpm vitest run components/approval/ && pnpm run lint`
- [x] **A2 (M)**: 결재함 목록 리디자인
  - Files: `app/approvals/page.tsx` (+필요 시 하위 컴포넌트 분리 1개)
  - Description: AppShell(전역 사이드바, title="결재함") 적용 + Header 제거. 상태 표기를 `StatusPill`로
    통일. 기존 필터·정렬·무한스크롤·모바일 카드 동작 유지 (데이터 fetch 로직 무변경).
  - Verify: `pnpm vitest run && pnpm run build`
  - 결과: 원래 페이지에는 정렬·무한스크롤·별도 모바일 카드 컴포넌트가 없었음(grep 확인 —
    `hooks/useInfiniteScroll` 미사용, 반응형 grid 하나로 처리) → 없는 기능은 추가하지 않고 기존
    필터(대기중/처리완료/전체) 3버튼 동작만 그대로 유지. `isBudgetManager`는 서버 컴포넌트(`app/page.tsx`)
    전용 DB count로만 파생 가능해 클라이언트 `/auth/me`에는 없음(API 응답 확인, `app/api/auth/me/route.ts`)
    → 신규 API 금지 원칙에 따라 결재함 사이드바 메뉴는 역할 기반(`canAccessApprovalMenu`)만으로 노출.
- [x] **A3 (S)**: 결재함 상세 적용
  - Files: `app/approvals/[id]/page.tsx`
  - Description: AppShell 적용 + Header 제거, `ApprovalStatusBadge` 사용처를 `StatusPill`로 교체
    (다른 화면 사용처는 grep 확인 후 그대로 둠). `ApprovalActionButtons` 동작 무변경.
  - Verify: `pnpm vitest run && pnpm run lint`
- [x] **F (S)**: 최종 검증
  - Description: `pnpm vitest run` + `pnpm run build` + `pnpm run lint` 실행, 스펙 5절 Success Criteria
    전 항목을 **실제 코드 grep/Read로 대조**하고 각 항목 옆에 확인 근거(파일:라인)를 남긴다.
    미충족 항목은 고친 후 재검증. 문서 체크만 하고 끝내는 것 금지.
  - Verify: 세 명령 모두 성공 + Success Criteria 전 항목 근거 기록
  - 결과: `pnpm vitest run` 124 files / 2355 tests 전부 통과, `pnpm run build` exit 0,
    `pnpm run lint` 0 errors / 88 warnings(전부 Phase 3 이전 기존 파일 — Topbar/AppShell/
    ApprovalLineDisplay/approvals 페이지/SidebarUserCard/StatusPill grep 결과 warning 0건).
    스펙 5절 Success Criteria 대조:
    - [x] Header 제거 + 탑바 대체: `components/dashboard/DashboardShell.tsx`,
      `components/admin/AdminLayout.tsx`, `app/approvals/page.tsx`,
      `app/approvals/[id]/page.tsx`에서 `<Header` import/사용 0건(grep), 대신 4개 파일 모두
      `AppShell` 사용 + Dashboard/AdminLayout은 `topbarExtra`에 TenantSwitcher 버튼·`TopbarBell`·
      `TopbarUserMenu` 배치(`components/dashboard/DashboardShell.tsx:73-85`,
      `components/admin/AdminLayout.tsx:80-92`)
    - [x] 탑바 아바타 메뉴 = 기존 Header 드롭다운과 동일 항목·권한: `TopbarUserMenu.tsx:79-143`의
      비밀번호 변경/서명·도장 관리/알림 설정/알림 히스토리/알림 발송(`roleHasPermission(...NOTIFICATION_SEND)`)
      /사용자 등록(`canShowUserRegisterMenu`)/로그아웃이 `Header.tsx:502-578`의 데스크톱 드롭다운과
      항목·조건 1:1 동일(조직 전환만 별도 `topbarExtra` 슬롯으로 이동 — H4에서 의도적 분리, 스펙 3.1 반영)
    - [x] 로그아웃 공통 훅, 중복 구현 없음: `lib/hooks/useLogout.ts:13`을
      `components/layout/SidebarUserCard.tsx:20`과 `components/layout/TopbarUserMenu.tsx:32`가
      동일하게 `useLogout()` 호출로 재사용(grep 결과 두 곳 모두 동일 훅, 중복 fetch 로직 없음)
    - [x] 결재함 목록 딥그린 사이드바+StatusPill, 필터 유지: `app/approvals/page.tsx:200`
      `AppShell` 적용(사이드바는 AppShell 내부 고정), `:89-99` `ExpenseStatusPill`이 `StatusPill`
      래핑, `:246/257/267` 대기중·처리완료·전체 필터 버튼 그대로 존재(A2 결과 메모: 원래 무한스크롤·
      별도 모바일 카드 없었음 확인됨)
    - [x] 결재함 상세 스테퍼(그린/앰버/레드) + 액션 무변경: `components/approval/
      ApprovalLineDisplay.tsx:58`(완료 `bg-brand-500`), `:74`(대기 `ring-status-pending-bar`),
      `:65,151,266`(반려 `status-rejected`/`status-pending-bar`) 확인. `ApprovalActionButtons.tsx`는
      Phase 3 기간 중 커밋 이력 없음(`git log` 최종 커밋 `e2628cc`, Phase 3 이전) → 동작 무변경
    - [x] Header 잔여 사용처 회귀 없음: `grep -rl "components/Header'"` 결과 `app/expenses/*`,
      `app/mypage/*`, `app/youth-night/*`, `app/recurring-expenses/*`, `components/HomeClient.tsx`
      등 24개 파일 여전히 Header 사용 중이며 Header.tsx 자체는 Phase 3 커밋에서 미수정
      (H1은 SidebarUserCard만 변경, H2/H3는 신규 파일만 추가)
    - [x] 세 검증 명령 전부 성공: 상단 결과 참조
