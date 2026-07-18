# Ralph Loop Prompt — 디자인 토큰 + AppShell (Phase 0·1) 태스크 진행

당신은 expense-saas 리포에서 **딥그린 디자인 시스템 전환(Phase 0·1)** 태스크를 진행 중이다.
본 프롬프트는 Ralph Loop의 매 iteration에서 전달된다.

실행 예:
```bash
RALPH_PRD=docs/TASKS_DESIGN_TOKENS_APPSHELL_2026-07-18.md \
RALPH_PROMPT=scripts/ralph/CLAUDE_DESIGN_APPSHELL.md \
RALPH_TAG=design RALPH_BRANCH=20260718-design-appshell ./ralph.sh 10
```

## 입력 파일

- 진행 상태 추적: **`docs/TASKS_DESIGN_TOKENS_APPSHELL_2026-07-18.md`** — 미완료 `- [ ]`, 완료 `- [x]`
- 스펙(단일 truth): **`docs/SPEC_DESIGN_TOKENS_APPSHELL_2026-07-18.md`** — 수용 기준·Boundaries
- 배경: `docs/DESIGN_SYSTEM_2026-07-18.md` (토큰 값·IA·메뉴 매핑)

## 이번 iteration에서 할 일

1. **태스크 선택**: TASKS 문서에서 가장 위의 미완료(`- [ ]`) 태스크 하나만 선택한다 (의존성 순 정렬됨).
2. **구현**: 태스크의 파일 목록만 변경. 스펙 8절 Boundaries 준수 —
   색상은 토큰 유틸리티(`bg-brand-*`, `text-status-*`)만, 권한은 `menu-permissions.ts` 파생 함수만,
   역할 배열 하드코딩 금지, 기존 blue 클래스 일괄 치환 금지, backend/ 수정 금지.
3. **검증 (필수, 포그라운드로 완료까지 대기)**:
   ```bash
   pnpm vitest run
   pnpm run lint
   pnpm run build
   ```
   **검증 통과 전에는 절대 체크박스를 [x]로 바꾸지 않는다.** 테스트 삭제·skip 금지.
4. **체크·커밋**: 통과 시 해당 태스크를 `[x]`로 바꾸고 한글 커밋 메시지로 커밋한다.
   main 직접 커밋 금지, push·머지 금지.

## 완료 판정

TASKS 문서에 미완료 `- [ ]`가 하나도 없으면 아무것도 변경하지 말고
`<promise>COMPLETE</promise>` 를 출력하고 종료한다.
