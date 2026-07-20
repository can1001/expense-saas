# Ralph Loop Prompt — 백엔드 이관 잔여분 (FastAPI 컷오버 완결)

당신은 expense-saas 리포에서 **Next.js `app/api/**` 잔여 라우트의 FastAPI 이관**을 진행 중이다. 본 프롬프트는 Ralph Loop 의 매 iteration 에서 전달된다.

## 입력 파일

- 진행 상태 추적: **`PRD_BACKEND_REMAINDER.md`** (레포 루트) — 미완료 `- [ ]`, 완료 `- [x]`
- 태스크 상세: **`docs/TASKS_BACKEND_REMAINDER.md`** — 각 태스크의 Description / Files / Acceptance / Verify + **공통 원칙 10개조**
- 선행 작업 참고: 커밋 `186b3f1`·`2eb68fb`·`d4a2e98`(컷오버 1~3차), `backend/tests/test_budget_query_routes.py`(계약 테스트 패턴), `next.config.ts` rewrites(beforeFiles + API_ORIGIN 게이트)

## 브랜치 (매 iteration 첫 단계)

현재 브랜치가 `20260720-backend-remainder`가 아니면:
- 브랜치가 이미 존재하면 `git checkout 20260720-backend-remainder`
- 없으면 `git checkout -b 20260720-backend-remainder`

**main 직접 커밋 금지. push·머지 금지** (머지는 사용자 승인 후).

## 이번 iteration 에서 할 일

### Step 1. 다음 태스크 선택

`PRD_BACKEND_REMAINDER.md`의 Phase A → B → C → D → P → N → Y 섹션을 위에서부터 읽어 **가장 위의 미완료(`- [ ]`) 태스크 하나만** 선택한다.

- Excel 의존 항목(D2 export, D5 template, P5)은 C1 이 `[x]`인 경우에만 진행 가능 — C1 미완료면 해당 항목을 건너뛰고 다음 미완료 태스크를 택한다 (그 외 순서 변경 금지).
- "최종 검증"(F1~F3)은 A~Y 가 모두 `[x]`가 된 후에만 다룬다.
- **"수동 게이트"(M1~M4)는 절대 건드리지 않는다** — COMPLETE 판정에서도 제외.

### Step 2. 태스크 본문 로드

`docs/TASKS_BACKEND_REMAINDER.md`에서 해당 태스크 §섹션과 **공통 원칙 10개조**를 읽는다. Description / Files / Acceptance / Verify 가 단일 truth. 본 프롬프트와 충돌하면 task 본문이 우선. **포팅 전에 반드시 Next 원본 라우트(및 그것이 import 하는 lib)를 Read 한다** — 문서 요약만 보고 구현하지 않는다.

### Step 3. 구현 (컷오버 레시피)

매 태스크는 같은 순서를 따른다:

1. Next 원본 라우트의 **export 메서드 전수 grep** → 응답 구조·에러 메시지·권한 가드 파악
2. FastAPI 라우터 구현 — **모든 쿼리 tenantId 스코프**(platform 예외), 응답 키 동일
3. 신규 테이블은 `prisma/schema.prisma` 대조 후 SQLModel 추가 (**alembic 마이그레이션 작성 금지** — 스키마 소유권은 Prisma, 테스트는 create_all)
4. 계약 테스트 작성 (`test_budget_query_routes.py` 픽스처 패턴)
5. `next.config.ts` beforeFiles 에 rewrite 추가 — **cuid 패턴 `[a-z0-9]{20,}`**, 같은 위치 고정 세그먼트와 충돌 점검, **API_ORIGIN 게이트 구조 유지**
6. Verify 실행

- 기존 코드의 주석 밀도·한국어 메시지·`core/routes`+`core/service` 계층 관례를 따른다.
- 허용 의존성: openpyxl(C1)·cloudinary(B2)·pywebpush(N1)·firebase-admin(N2) — 그 외 추가 금지.
- 테스트 삭제·`.skip`·`xfail` 금지. 기존 테스트는 수정 없이 통과가 원칙 (N1 처럼 task 본문이 계약 정정을 명시한 경우만 예외).

### Step 4. 검증 (필수)

```bash
cd backend && RUNNING_ZONE=local uv run pytest -q && uv run ruff check
```

**반드시 포그라운드로 실행하고 완료까지 기다린다.** next.config.ts 를 바꾼 태스크는 `pnpm exec tsc --noEmit -p .` 대신 `node -e "require('./next.config.ts')"` 식 검증이 불가하므로 **`pnpm run build` 는 F3 에서만** 돌리고, 평시에는 rewrite 항목의 문법 오탈자를 diff 로 재확인한다.

**검증 통과 전에는 절대 PRD 체크박스를 [x]로 바꾸지 않는다.**

검증 실패 시: 같은 iteration 에서 원인 파악·수정. 3회 시도에도 실패하면 체크박스는 그대로 두고 오류 한 줄 요약 출력 후 종료.

### Step 5. PRD 체크박스 갱신

검증 통과 후 `PRD_BACKEND_REMAINDER.md`의 해당 라인을 `- [x]`로.

### Step 6. 커밋

해당 태스크의 변경만 명시적으로 stage 하고 커밋. **커밋 메시지 형식:**

```
feat(cutover): <A|B|C|D|P|N|Y|F><번호> — <태스크 한줄 설명>

<상세 변경 요약 2-4줄>

Refs: docs/TASKS_BACKEND_REMAINDER.md §<태스크>
```

PRD 체크박스 변경도 동일 커밋에 포함. **`git add -A`/`git add .` 금지** — 파일 명시 add. `.claude/`, `ralph_log_*`, `*.pid` 절대 stage 금지. `--no-verify` 금지.

### Step 7. 종료 신호

- 한 태스크 완료 + 커밋 후 한 줄 요약 출력하고 종료.
- A~Y 전 태스크와 F1~F3 이 **모두** `[x]`면 (M 게이트 무시) 다음 줄 추가 후 종료:

```
<promise>COMPLETE</promise>
```

## 가드레일

- **실 DB 접근 금지**: 프로덕션 DATABASE_URL·Neon 접근, `prisma db push/migrate`, 시드 실행 금지. 검증은 인메모리 SQLite pytest 로만.
- **서버 기동 금지**: uvicorn/next dev 를 띄워 수동 확인하지 않는다 — 계약 테스트로 대신한다.
- **외부 호출 금지**: Cloudinary·kapi.kakao.com·FCM·WebPush 실호출 금지, 반드시 모킹.
- **건드리지 말 것**: 이미 컷오버된 라우트·테스트(정정 명시된 N1 제외), Next 프론트 컴포넌트/페이지, `render.yaml`/`backend/render.yaml`, `ralph.sh`, 다른 PRD/spec 문서, `next.config.ts` 의 API_ORIGIN 게이트·기존 rewrite 항목.
- **Next 라우트 파일 삭제 금지** — 컷오버 후에도 폴백으로 남긴다 (삭제는 M3, 사용자 몫).
- **사용자 확인 없이 금지**: push, 머지, 파일/브랜치 삭제, `git reset --hard`, 허용 목록 외 의존성 추가, CI 변경.
- **scope 준수**: 태스크 범위 밖 "관련 정리" 금지.

## 출력 형식

iteration 종료 시 마지막에 다음 3줄을 출력한다:

```
TASK: <A|B|C|D|P|N|Y|F><번호>
STATUS: COMPLETED  (또는 FAILED — 사유)
COMMIT: <short hash>  (또는 NONE)
```

전부 완료된 경우 `<promise>COMPLETE</promise>` 라인을 추가한다.
