# Ralph Loop Prompt — 결재함 리디자인 + Header 탑바 이관 (Phase 3)

당신은 expense-saas 리포에서 **Phase 3 (결재함 리디자인 + Header 탑바 이관)** 태스크를 진행 중이다.
본 프롬프트는 Ralph Loop의 매 iteration에서 전달된다.

실행 예 (Phase 2 머지 후):
```bash
RALPH_PRD=docs/TASKS_APPROVALS_HEADER_PHASE3_2026-07-19.md \
RALPH_PROMPT=scripts/ralph/CLAUDE_APPROVALS_PHASE3.md \
RALPH_TAG=phase3 RALPH_BRANCH=20260719-approvals-phase3 ./ralph.sh 14
```

## 입력 파일

- 진행 상태 추적: **`docs/TASKS_APPROVALS_HEADER_PHASE3_2026-07-19.md`** — 미완료 `- [ ]`, 완료 `- [x]`
- 스펙(단일 truth): **`docs/SPEC_APPROVALS_HEADER_PHASE3_2026-07-19.md`**
- 배경: `docs/DESIGN_SYSTEM_2026-07-18.md`, Phase 0~2 산출물
  (`components/ui/*`, `components/layout/*`, `components/dashboard/*`, `lib/constants/global-menu.ts`)

## 브랜치 (매 iteration 첫 단계)

현재 브랜치가 `20260719-approvals-phase3`가 아니면 checkout(없으면 `-b`로 생성).
**main에 직접 커밋 금지. push·머지 금지.**

## 이번 iteration에서 할 일

1. TASKS 문서에서 가장 위의 미완료(`- [ ]`) 태스크 **하나만** 선택 (의존성 순).
2. 태스크 본문(Files/Description/Acceptance/Verify)과 스펙 해당 절을 읽는다. 문서에 적힌 파일
   구조·드롭다운 항목·훅 존재 여부는 **반드시 grep/Read로 현재 코드에서 재확인**한다.
3. 구현: 태스크 Files만 변경. 스펙 4절 Boundaries 준수 — 결재 로직·API 무변경, Header.tsx는
   삭제·대규모 수정 금지(이관 컴포넌트를 새로 만들고 AppShell 채택 화면에서만 교체),
   토큰 유틸리티만, 권한 파생 함수만, 신규 API/의존성 금지, backend/ 금지.
4. 검증: 태스크 Verify 명령을 **포그라운드로 완료까지 실행**. 통과 전 체크박스 변경 금지.
   테스트 삭제·skip 금지 — 실패하면 고친다.
5. 통과 시 해당 태스크만 `[x]` + 한글 커밋 (예: `feat(approvals): A1 결재선 스테퍼 재스타일`).

**특히 F(최종 검증)**: 문서 체크만 하고 끝내지 말 것 — Success Criteria 각 항목을 실제 코드
grep/Read로 대조하고 근거(파일:라인)를 TASKS 문서에 남긴다. 미충족이면 그 자리에서 고친다.

## 완료 판정

TASKS 문서에 미완료 `- [ ]`가 하나도 없으면 아무것도 변경하지 말고
`<promise>COMPLETE</promise>` 를 출력하고 종료한다.
