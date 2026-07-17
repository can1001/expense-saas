# Ralph Loop Prompt — SaaS 멀티테넌트 고도화 자동 진행

당신은 expense-saas 리포에서 **템플릿 프로비저닝(ARC-001) · Membership/서버 주도 설정(ARC-002) · 카카오 로그인(ARC-003)**을 구현 중이다. 본 프롬프트는 Ralph Loop의 매 iteration에서 전달된다.

## 입력 파일

- 진행 상태 추적: **`PRD_SAAS_MULTITENANT.md`** (레포 루트) — 미완료 `- [ ]`, 완료 `- [x]`
- 태스크 상세: **`docs/TASKS_SAAS_MULTITENANT.md`** — 각 태스크의 Description / Files / Acceptance / Verify
- 설계서(배경): `docs/EXP-2026-ARC-001-multitenant-architecture.md`, `docs/EXP-2026-ARC-002-mobile-multitenancy.md`, `docs/EXP-2026-ARC-003-kakao-login.md`

## 브랜치 (매 iteration 첫 단계)

현재 브랜치가 `20260718-saas-multitenant`가 아니면:
- 브랜치가 이미 존재하면 `git checkout 20260718-saas-multitenant`
- 없으면 `git checkout -b 20260718-saas-multitenant`

**main에 직접 커밋 금지. push·머지 금지** (머지는 사용자 승인 후).

## 이번 iteration에서 할 일

### Step 1. 다음 태스크 선택

`PRD_SAAS_MULTITENANT.md`의 Phase A → B → C 섹션을 위에서부터 읽어 **가장 위의 미완료(`- [ ]`) 태스크 하나만** 선택한다. PRD는 의존성 순으로 정렬되어 있다.

- "최종 검증"(F1~F3)은 A~C가 모두 `[x]`가 된 후에만 다룬다 — 그 경우 F1~F3을 순서대로 실행·체크하고 실패 시 원인을 고친다.
- **"수동 게이트"(M1~M4) 섹션은 절대 건드리지 않는다** — 사용자 전용이며 COMPLETE 판정에서도 제외한다.

### Step 2. 태스크 본문 로드

`docs/TASKS_SAAS_MULTITENANT.md`에서 해당 태스크 §섹션과 **"공통 원칙"**을 읽는다. **Description / Files / Acceptance / Verify**가 단일 truth다. 본 프롬프트와 충돌하면 task 본문이 우선. 문서의 파일 경로는 작성 시점 기준이므로 반드시 grep으로 현재 위치를 재확인한다.

### Step 3. 구현

- task 본문의 Files 목록(및 grep으로 발견하도록 명시된 파일)만 변경한다. 그 외 파일은 건드리지 않는다.
- **회귀 없음 원칙**: Membership 백필 전·카카오 키 미설정·단일 소속 사용자 등 "기존 상태"에서는 기존 동작과 100% 동일해야 한다. 기존 테스트는 수정 없이 통과가 원칙 (계약이 실제로 바뀌는 태스크만 예외, task 본문에 명시된 범위 내).
- **tenantId는 토큰 안에만** — 클라이언트가 바디/쿼리로 tenantId를 보내는 경로를 새로 만들지 않는다 (예외: switch-tenant, 공통 원칙 2 참조).
- 기존 코드의 주석 밀도·네이밍·한국어 메시지 관례, `app/api/**/route.ts` + `lib/services`/`lib/validators` 계층, 인접 `__tests__/` vitest 관례를 그대로 따른다.
- 테스트는 같은 iteration에서 작성/갱신한다. 테스트 삭제·`.skip`·`xfail` 추가 금지 — 실패하면 고친다.

### Step 4. 검증 (필수)

task 본문의 **Verify** 명령을 실행한다. 예:

```bash
pnpm exec prisma validate && pnpm exec prisma generate
pnpm exec vitest run
pnpm run lint
```

**검증 명령은 반드시 포그라운드로 실행하고 완료까지 기다린다 — 백그라운드 실행 후 "결과를 기다리겠다"며 턴을 끝내지 않는다** (--print 모드에서는 턴이 끝나면 세션이 종료되어 결과를 볼 수 없다).

**검증 통과 전에는 절대 PRD 체크박스를 [x]로 바꾸지 않는다.**

검증 실패 시: 같은 iteration에서 원인 파악·수정을 시도한다. 3회 시도에도 통과하지 못하면 체크박스는 그대로 두고, 오류 한 줄 요약을 출력한 뒤 종료한다.

### Step 5. PRD 체크박스 갱신

검증 통과 후 `PRD_SAAS_MULTITENANT.md`에서 완료한 태스크 라인의 `- [ ]`을 `- [x]`로 바꾼다.

### Step 6. 커밋

해당 태스크의 변경만 명시적으로 stage하고 커밋한다. **커밋 메시지 형식:**

```
feat(saas): <A|B|C><번호> — <태스크 한줄 설명>

<상세 변경 요약 2-4줄>

Refs: docs/TASKS_SAAS_MULTITENANT.md §<태스크>
```

`PRD_SAAS_MULTITENANT.md`의 체크박스 변경도 동일 커밋에 포함한다.

**`git add -A` / `git add .` 금지** — 변경 파일을 명시적으로 add. `.claude/`, `ralph_log_*`, `*.pid` 는 절대 stage하지 않는다. `--no-verify` / `--no-gpg-sign` 금지. pre-commit 훅 실패 시 원인을 고친 뒤 새 커밋.

### Step 7. 종료 신호

- 한 태스크를 완료 + 커밋했다면 한 줄 요약을 출력하고 종료.
- A1~A6, B1~B7, C1~C5와 최종 검증 F1~F3이 **모두** `[x]`라면 (M 게이트는 무시) 추가로 다음 줄을 출력하고 종료:

```
<promise>COMPLETE</promise>
```

모든 항목이 끝나기 전에는 절대 출력하지 않는다.

## 가드레일

- **DB 실행 절대 금지**: `prisma db push`, `prisma migrate dev/deploy`, 시드 실행(`tsx prisma/seeds/...`), 백필 스크립트 실행. 스키마 검증은 `prisma validate`/`generate`, 로직 검증은 vitest 모킹으로만. DB 실행이 필요한 항목은 PRD의 M 게이트(사용자 몫)다.
- **건드리지 말 것**: 범위 제외 목록(PRD "범위 제외" — FastAPI `backend/`, 네이티브 Kakao SDK, 네이버/구글, 기존 Budget 5단계 모델·화면, white-label), 다른 PRD/spec 문서, 배포 설정(`render.yaml`, `backend/render.yaml`), 기존 모델의 기존 필드 (신규 모델·역관계 추가만 허용).
- **사용자 확인 없이 금지**: push, 머지, 파일/브랜치 삭제, `git reset --hard`, 의존성 추가(package.json — Kakao SDK 포함), CI 워크플로 변경, 운영 DB 접근.
- **외부 호출 금지**: 실제 kapi.kakao.com·FCM·Cloudinary 호출을 테스트/검증에서 수행하지 않는다 — 반드시 모킹.
- **scope 준수**: "관련 정리"가 눈에 띄어도 태스크 범위 밖이면 손대지 않는다.
- 서버를 띄워 수동 확인하려고 시도하지 않는다 — 검증은 vitest/lint/build로 대신한다.

## 출력 형식

iteration 종료 시 마지막에 다음 3줄을 출력한다:

```
TASK: <A|B|C|F><번호>
STATUS: COMPLETED  (또는 FAILED — 사유)
COMMIT: <short hash>  (또는 NONE)
```

전부 완료된 경우 위 3줄에 더해 `<promise>COMPLETE</promise>` 라인을 추가한다.
