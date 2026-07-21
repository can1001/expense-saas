# Ralph Loop Prompt — 영수증 관리 (Phase 5, 신규 기능)

당신은 expense-saas 리포에서 **Phase 5 (영수증 관리 신규 기능)** 태스크를 진행 중이다.

실행 예:
```bash
RALPH_PRD=docs/TASKS_RECEIPTS_PHASE5_2026-07-20.md \
RALPH_PROMPT=scripts/ralph/CLAUDE_RECEIPTS_PHASE5.md \
RALPH_TAG=phase5 RALPH_BRANCH=20260720-receipts-phase5 ./ralph.sh 12
```

## 입력 파일

- 진행 상태 추적: **`docs/TASKS_RECEIPTS_PHASE5_2026-07-20.md`** — 미완료 `- [ ]`, 완료 `- [x]`
- 스펙(단일 truth): **`docs/SPEC_RECEIPTS_PHASE5_2026-07-20.md`**
- 배경: `docs/DESIGN_SYSTEM_2026-07-18.md` 6절, Phase 0~4 산출물
  (`components/layout/GlobalShell.tsx`, `components/ui/StatusPill.tsx`, `lib/constants/global-menu.ts`,
  `lib/auth/permissions.ts`, `lib/constants/receipt-exempt-details.ts`)

## 브랜치 (매 iteration 첫 단계)

현재 브랜치가 `20260720-receipts-phase5`가 아니면 checkout. **main 직접 커밋·push·머지 금지.**

## 이번 iteration에서 할 일

1. TASKS 문서에서 가장 위의 미완료(`- [ ]`) 태스크 **하나만** 선택.
2. 태스크 본문과 스펙 해당 절을 읽고, 관련 파일(모델·권한·기존 admin API 가드 패턴·
   receipt-exempt 헬퍼)을 **Read/grep으로 확인 후** 구현한다.
3. 스펙 4절 Boundaries 준수. 이 Phase는 **신규 permission·API·라우트를 허용**하지만
   **DB 스키마/모델 변경·마이그레이션·backend/ 수정·영수증 업로드/삭제는 금지**(조회 전용).
   영수증 데이터는 기존 `ExpenseAttachment`만 사용(Simple 포함 여부는 F에서 결정).
   권한은 반드시 permission 파생 — 역할 배열 하드코딩 금지.
4. 검증: Verify 명령을 **포그라운드로 완료까지 실행**. 통과 전 체크박스 변경 금지.
   테스트 삭제·skip 금지 — 실패하면 고친다.
5. 통과 시 해당 태스크만 `[x]` + 한글 커밋 (예: `feat(receipts): R2 영수증 목록 API`).

**F(최종 검증)**: Success Criteria 각 항목을 실제 grep/Read 근거와 함께 TASKS 문서에 기록.
문서 체크만 하고 끝내기 금지 — 미충족이면 그 자리에서 고친다.

## 완료 판정

TASKS 문서에 미완료 `- [ ]`가 하나도 없으면 아무것도 변경하지 말고
`<promise>COMPLETE</promise>` 를 출력하고 종료한다.
