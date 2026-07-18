# Ralph Loop Prompt — 홈 회계 대시보드 (Phase 2) 자동 진행

당신은 expense-saas 리포에서 **홈 회계 대시보드 전환(Phase 2)** 태스크를 진행 중이다.
본 프롬프트는 Ralph Loop의 매 iteration에서 전달된다.

## 입력 파일

- 진행 상태 추적: **`docs/TASKS_DASHBOARD_PHASE2_2026-07-18.md`** — 미완료 `- [ ]`, 완료 `- [x]`
- 스펙(단일 truth): **`docs/SPEC_DASHBOARD_PHASE2_2026-07-18.md`** — 데이터 소스·화면 구성·Boundaries·Success Criteria
- 배경: `docs/DESIGN_SYSTEM_2026-07-18.md` (토큰·IA), Phase 0·1 산출물
  (`components/ui/StatCard.tsx`·`StatusPill.tsx`·`ProgressBar.tsx`, `components/layout/Sidebar.tsx`·`AppShell.tsx`,
  `lib/constants/global-menu.ts`, `lib/utils/fiscal-year.ts`)

## 브랜치 (매 iteration 첫 단계)

현재 브랜치가 `20260718-dashboard-phase2`가 아니면 checkout(없으면 `-b`로 생성).
**main에 직접 커밋 금지. push·머지 금지** (머지는 사용자 승인 후).

## 이번 iteration에서 할 일

1. **태스크 선택**: TASKS 문서에서 가장 위의 미완료(`- [ ]`) 태스크 **하나만** 선택 (의존성 순 정렬됨).
2. **본문 로드**: 해당 태스크의 Description/Files/Acceptance/Verify가 단일 truth. 스펙 문서의
   해당 절도 함께 읽는다. 문서의 파일 경로·응답 구조는 반드시 grep/Read로 현재 상태를 재확인한다.
3. **구현**: 태스크 Files 목록만 변경. 스펙 4절 Boundaries 준수 —
   색상은 토큰 유틸리티만, 권한은 `menu-permissions.ts` 파생 함수만, 역할 하드코딩 금지,
   신규 API/의존성/DB 변경 금지, HomeClient(일반 사용자 경로) 동작 변경 금지, backend/ 수정 금지.
   기존 코드의 한글 주석·네이밍·vitest 관례를 따른다.
4. **검증 (필수)**: 태스크의 Verify 명령을 **포그라운드로 실행하고 완료까지 기다린다** —
   백그라운드로 걸어두고 턴을 끝내지 않는다 (--print 모드는 턴 종료 시 세션이 끝난다).
   **검증 통과 전에는 절대 체크박스를 [x]로 바꾸지 않는다.** 테스트 삭제·`.skip` 금지 — 실패하면 고친다.
5. **체크·커밋**: 통과 시 해당 태스크만 `[x]`로 바꾸고 한글 커밋 메시지로 커밋한다 (예: `feat(dashboard): P1 KPI 카드`).

## 완료 판정

TASKS 문서에 미완료 `- [ ]`가 하나도 없으면 아무것도 변경하지 말고
`<promise>COMPLETE</promise>` 를 출력하고 종료한다.
