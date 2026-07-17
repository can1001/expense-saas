# Ralph Loop Prompt — 프론트 전면 전환 (FastAPI 커토버) 자동 진행

당신은 expense-saas 리포에서 **프론트 화면 트래픽을 Next.js API에서 FastAPI(/api/py 프록시)로 전환**하는 작업을 진행 중이다. 본 프롬프트는 Ralph Loop의 매 iteration에서 전달된다.

## 입력 파일

- 진행 상태 추적: **`PRD_FRONTEND_CUTOVER.md`** (레포 루트) — 미완료 `- [ ]`, 완료 `- [x]`
- 태스크 상세: **`docs/TASKS_FRONTEND_CUTOVER.md`** — 각 태스크의 Description / Files / Acceptance / Verify
- 배경: `BACKEND_SEPARATION_STATUS.md`, `spec_python_refactoring.md` §7, `backend/README.md`

## 브랜치 (매 iteration 첫 단계)

현재 브랜치가 `20260717-frontend-cutover`가 아니면:
- 브랜치가 이미 존재하면 `git checkout 20260717-frontend-cutover`
- 없으면 `git checkout -b 20260717-frontend-cutover`

**main에 직접 커밋 금지. push·머지 금지** (머지는 사용자 승인 후).

## 이번 iteration에서 할 일

### Step 1. 다음 태스크 선택

`PRD_FRONTEND_CUTOVER.md`의 "태스크" 섹션을 위에서부터 읽어 **가장 위의 미완료(`- [ ]`) 태스크 하나만** 선택한다. PRD는 의존성 순으로 정렬되어 있다. "최종 검증"(F1~F3) 섹션은 C0~C10이 모두 `[x]`가 된 후에만 다룬다 — 그 경우 F1~F3을 순서대로 실행·체크하고 실패 시 원인을 고친다.

### Step 2. 태스크 본문 로드

`docs/TASKS_FRONTEND_CUTOVER.md`에서 해당 태스크 §섹션을 읽는다. **Description / Files / Acceptance / Verify**가 단일 truth다. 본 프롬프트와 충돌하면 task 본문이 우선. 문서의 파일:라인 표기는 작성 시점 기준이므로 반드시 grep으로 현재 위치를 재확인한다.

### Step 3. 구현

- task 본문의 Files 목록(및 grep으로 발견하도록 명시된 파일)만 변경한다. 그 외 파일은 건드리지 않는다.
- **레거시 계약 우선 원칙**: 응답/요청 형태가 다르면 화면이 아니라 FastAPI 스키마를 레거시에 맞춘다 (TASKS 문서 "공통 원칙" 참조).
- **플래그 off = 무변경 원칙**: `NEXT_PUBLIC_PY_DOMAINS` 미설정 시 기존 동작과 100% 동일해야 한다.
- 기존 코드의 주석 밀도·네이밍·한국어 메시지 관례를 따른다. 프론트는 기존 컴포넌트·훅·vitest 관례, 백엔드는 기존 routes/service/repository/schemas 계층과 pytest 관례를 그대로 따른다.
- 테스트는 같은 iteration에서 작성/갱신한다. 테스트 삭제·`.skip`·`xfail` 추가 금지 — 실패하면 고친다.

### Step 4. 검증 (필수)

task 본문의 **Verify** 명령을 실행한다. 예:

```bash
cd backend && uv run pytest -q
pnpm exec vitest run
pnpm run lint
```

**검증 명령은 반드시 포그라운드로 실행하고 완료까지 기다린다 — 백그라운드 실행 후 "결과를 기다리겠다"며 턴을 끝내지 않는다** (--print 모드에서는 턴이 끝나면 세션이 종료되어 결과를 볼 수 없다).

**검증 통과 전에는 절대 PRD 체크박스를 [x]로 바꾸지 않는다.**

검증 실패 시: 같은 iteration에서 원인 파악·수정을 시도한다. 3회 시도에도 통과하지 못하면 체크박스는 그대로 두고, 오류 한 줄 요약을 출력한 뒤 종료한다.

### Step 5. PRD 체크박스 갱신

검증 통과 후 `PRD_FRONTEND_CUTOVER.md`에서 완료한 태스크 라인의 `- [ ]`을 `- [x]`로 바꾼다.

### Step 6. 커밋

해당 태스크의 변경만 명시적으로 stage하고 커밋한다. **커밋 메시지 형식:**

```
feat(cutover): C<번호> — <태스크 한줄 설명>

<상세 변경 요약 2-4줄>

Refs: docs/TASKS_FRONTEND_CUTOVER.md §C<번호>
```

`PRD_FRONTEND_CUTOVER.md`의 체크박스 변경도 동일 커밋에 포함한다.

**`git add -A` / `git add .` 금지** — 변경 파일을 명시적으로 add. `.claude/`, `ralph_log_*`, `*.pid` 는 절대 stage하지 않는다. `--no-verify` / `--no-gpg-sign` 금지. pre-commit 훅 실패 시 원인을 고친 뒤 새 커밋.

### Step 7. 종료 신호

- 한 태스크를 완료 + 커밋했다면 한 줄 요약을 출력하고 종료.
- C0~C10과 최종 검증 F1~F3이 **모두** `[x]`라면 추가로 다음 줄을 출력하고 종료:

```
<promise>COMPLETE</promise>
```

모든 항목이 끝나기 전에는 절대 출력하지 않는다.

## 가드레일

- **건드리지 말 것**: 범위 제외 목록(PRD "범위 제외" 섹션 — 첨부/엑셀/벌크/오프라인 동기화/simple·recurring/푸시/admin 알림), 다른 PRD/spec 문서, 배포 설정(`render.yaml`, `backend/render.yaml`), Prisma 스키마, alembic 기존 리비전 수정(신규 리비전은 태스크가 요구할 때만).
- **사용자 확인 없이 금지**: push, 머지, 파일/브랜치 삭제, `git reset --hard`, 의존성 추가(package.json/pyproject.toml), CI 워크플로 변경, 운영 DB 접근.
- **scope 준수**: "관련 정리"가 눈에 띄어도 태스크 범위 밖이면 손대지 않는다.
- **외부 호출 금지**: 실 Cloudinary/푸시 등 외부 네트워크 호출을 새로 만들지 않는다.
- 백엔드 실행이 필요한 검증은 pytest로 대신한다 — 서버를 띄워 수동 확인하려고 시도하지 않는다.

## 출력 형식

iteration 종료 시 마지막에 다음 3줄을 출력한다:

```
TASK: C<번호>  (최종 검증이면 F<번호>)
STATUS: COMPLETED  (또는 FAILED — 사유)
COMMIT: <short hash>  (또는 NONE)
```

전부 완료된 경우 위 3줄에 더해 `<promise>COMPLETE</promise>` 라인을 추가한다.
