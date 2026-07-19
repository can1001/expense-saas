# Ralph Loop Prompt — Header 완전 대체 + 폼·보고서 토큰 (Phase 4)

당신은 expense-saas 리포에서 **Phase 4 (Header 완전 대체 + 폼·보고서 토큰 전환)** 태스크를 진행 중이다.

실행 예:
```bash
RALPH_PRD=docs/TASKS_HEADER_CUTOVER_PHASE4_2026-07-20.md \
RALPH_PROMPT=scripts/ralph/CLAUDE_HEADER_CUTOVER_PHASE4.md \
RALPH_TAG=phase4 RALPH_BRANCH=20260720-header-cutover-phase4 ./ralph.sh 16
```

## 입력 파일

- 진행 상태 추적: **`docs/TASKS_HEADER_CUTOVER_PHASE4_2026-07-20.md`** — 미완료 `- [ ]`, 완료 `- [x]`
- 스펙(단일 truth): **`docs/SPEC_HEADER_CUTOVER_PHASE4_2026-07-20.md`**
- 배경: `docs/DESIGN_SYSTEM_2026-07-18.md`, Phase 0~3 산출물
  (`components/layout/*` — Sidebar/AppShell/TopbarUserMenu/TopbarBell/SidebarUserCard,
  `components/dashboard/DashboardShell.tsx`, `lib/constants/global-menu.ts`)

## 브랜치 (매 iteration 첫 단계)

현재 브랜치가 `20260720-header-cutover-phase4`가 아니면 checkout(없으면 `-b`로 생성).
**main에 직접 커밋 금지. push·머지 금지.**

## 이번 iteration에서 할 일

1. TASKS 문서에서 가장 위의 미완료(`- [ ]`) 태스크 **하나만** 선택.
2. 태스크 본문과 스펙 해당 절을 읽고, 대상 파일들을 **Read로 전부 확인 후** 수정한다.
   화면 이관은 셸 교체만 — 페이지의 데이터 fetch·상태·핸들러 코드는 옮기되 바꾸지 않는다.
3. 스펙 3절 Boundaries 준수. 특히: 폼 필드/검증 로직 무변경, youth-night 기능 무변경,
   Header.tsx 삭제는 G6에서 grep 0건 근거 기록 후에만.
4. 검증: Verify 명령을 **포그라운드로 완료까지 실행**. 통과 전 체크박스 변경 금지.
   기존 테스트가 깨지면 테스트를 지우지 말고 원인을 고친다 (예외: G6의 Header 전용 테스트 삭제만 허용).
5. 통과 시 해당 태스크만 `[x]` + 한글 커밋 (예: `feat(shell): G2 expenses 7화면 GlobalShell 이관`).

**F(최종 검증)**: Success Criteria 각 항목을 실제 grep/Read 근거와 함께 TASKS 문서에 기록.
문서 체크만 하고 끝내기 금지 — 미충족이면 그 자리에서 고친다.

## 완료 판정

TASKS 문서에 미완료 `- [ ]`가 하나도 없으면 아무것도 변경하지 말고
`<promise>COMPLETE</promise>` 를 출력하고 종료한다.
