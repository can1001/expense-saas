# Implementation Plan: 행정간사용 지출결의서 엑셀 일괄 업로드

스펙: [SPEC_BULK_EXPENSE_UPLOAD_WEB_2026-05-30.md](./SPEC_BULK_EXPENSE_UPLOAD_WEB_2026-05-30.md)
작성일: 2026-05-30

---

## Overview

기존 CLI 일괄 업로드(`scripts/bulk-upload.ts`)의 핵심 로직을 공유 서비스로 추출해 CLI와 웹 양쪽에서 사용. 행정간사/관리자가 웹 UI(`/admin/expense-upload`)에서 엑셀을 업로드해 검증·미리보기·확정 2단계로 지출결의서를 일괄 생성. DRAFT 상태로만 저장, 트랜잭션 보장.

---

## Architecture Decisions

| 결정 | 이유 |
|---|---|
| **공유 서비스 추출** (`lib/services/bulk-expense-upload-service.ts`) | CLI와 API의 검증/그룹핑/저장 로직 중복 제거. CLI는 thin wrapper로 변경. |
| **2단계 워크플로우** (dry-run → commit) | 결제 후 롤백 비용이 크다. 미리보기에서 모든 검증 통과 후에만 확정. |
| **전체 트랜잭션 (`prisma.$transaction`)** | "성공한 것만 저장" 정책은 데이터 일관성 해침 + 재실행 시 중복 위험. 스펙 결정. |
| **청구인 매칭 실패 = 행 에러** (admin 폴백 금지) | CLI의 admin 폴백은 데이터 출처 모호. 스펙 결정. |
| **권한 화이트리스트** (`['admin', 'admin_assistant']`) | 기존 메뉴 권한 시스템과 정합. `menu-permissions.ts`에 경로 추가. |
| **신규 의존성 0개** | `exceljs`, `prisma` 모두 기존 활용. 빌드 시간/번들 영향 없음. |
| **`/api/expenses/bulk-upload` 경로 분리** | 기존 `/api/expenses/bulk`은 "인쇄용 일괄 조회"로 의미 충돌 회피. |

---

## Dependency Graph

```
existing: budget-lookup-service, prisma, exceljs, auth/get-current-user
        │
        ▼
Task 1: bulk-expense-upload-service (core logic + tests)
        ├──→ Task 2: CLI refactor (low-risk reuse)
        ├──→ Task 3: bulk-upload API route
        │           └──→ Task 5: admin upload page
        │                       └──→ Task 6: menu/permission wiring
        └──→ Task 4: template download API
                    └──→ (Task 5 UI에 내려받기 버튼 추가)
```

---

## Task List

### Phase 1: Core Service (foundation)

#### Task 1: 공유 일괄 업로드 서비스 추출

**Description**: `scripts/bulk-upload.ts`의 4개 핵심 함수(`readExcelFile`, `validateRow`, `groupRows`, `createExpense`)를 `lib/services/bulk-expense-upload-service.ts`로 옮긴다. `findBudgetInfo`는 기존 `lib/services/budget-lookup-service.ts:lookupBudgetHierarchy`로 대체해 중복 제거. 전체 트랜잭션 모드(`prisma.$transaction`)와 dry-run 모드를 옵션으로 분기. 청구인 admin 폴백 제거.

**Acceptance criteria:**
- [ ] `parseExpenseExcelBuffer(buffer: Buffer): Promise<ExcelRow[]>` — Excel 버퍼에서 행 파싱 (파일 경로 대신 버퍼 받음 → 웹/CLI 공용)
- [ ] `validateRows(rows: ExcelRow[]): ValidationError[]` — 필수 컬럼/타입 검사
- [ ] `groupRows(rows): Map<string, ExcelRow[]>` — groupId 그룹핑
- [ ] `executeBulkUpload(rows, { dryRun }): Promise<BulkUploadResult>` — 예산 조회 + (dry-run 시 preview만) / (commit 시 `$transaction`으로 일괄 생성). 한 건이라도 실패 시 throw → 전체 롤백
- [ ] 응답 타입 `BulkUploadResult`는 스펙 §4 `BulkUploadResponse`와 일치
- [ ] 청구인 매칭 실패는 row error로 누적 (admin 폴백 없음)
- [ ] 생성된 expense는 `status: DRAFT`(기본값), 결재선 미생성, `paymentStatus: PENDING`(기본값)

**Verification:**
- [ ] `npm test -- bulk-expense-upload-service` 통과
- [ ] 단위 테스트 케이스(스펙 §6) 9개 모두 grin/red 검증
- [ ] `npx tsc --noEmit` 신규 에러 없음

**Dependencies:** None (기존 `lookupBudgetHierarchy`만 의존)

**Files touched:**
- `lib/services/bulk-expense-upload-service.ts` (신규)
- `lib/__tests__/bulk-expense-upload-service.test.ts` (신규)

**Estimated scope:** M (2 파일, ~300줄 로직 + 테스트)

---

#### Task 2: CLI 스크립트 리팩터 (서비스 사용)

**Description**: `scripts/bulk-upload.ts`가 새 서비스를 import해 동일하게 동작하도록 변경. 외부 인터페이스(npm script, CLI 인자, 콘솔 출력)는 그대로 유지. 동일 입력에 대해 동일 결과를 보장하는 회귀 검증.

**Acceptance criteria:**
- [ ] `scripts/bulk-upload.ts`가 신규 서비스 함수들만 호출, 로컬 중복 로직 제거
- [ ] `npm run bulk-upload -- ./templates/bulk-upload-template.xlsx --dry-run` 정상 동작
- [ ] dry-run 출력 포맷 변경 없음
- [ ] 청구인 admin 폴백 제거 — README/스펙과 일치(BULK_UPLOAD.md 주석 추가)

**Verification:**
- [ ] `npm run generate-template` → 생성된 템플릿으로 dry-run 통과 (수동)
- [ ] CLI 출력 비교 (변경 전 백업과 diff)
- [ ] `npx tsc --noEmit`

**Dependencies:** Task 1

**Files touched:**
- `scripts/bulk-upload.ts` (수정)
- `docs/BULK_UPLOAD.md` (admin 폴백 제거 표기)

**Estimated scope:** S (1~2 파일)

---

### Checkpoint A: Core 안정화
- [ ] Task 1, 2 acceptance 모두 통과
- [ ] CLI 회귀 없음 — 기존 운영 사용자 영향 없음 확인
- [ ] 사용자 리뷰 → Phase 2 진입

---

### Phase 2: API

#### Task 3: 일괄 업로드 API (`POST /api/expenses/bulk-upload`)

**Description**: multipart/form-data로 `.xlsx` 파일을 수신해 서비스를 호출. `?dryRun=true`면 미리보기, 아니면 트랜잭션으로 저장. 권한 화이트리스트 (`admin`, `admin_assistant`).

**Acceptance criteria:**
- [ ] `POST /api/expenses/bulk-upload[?dryRun=true]` 라우트 존재
- [ ] 비로그인 → 401, 권한 외 역할 → 403
- [ ] 파일 누락/비-xlsx → 400 + 메시지
- [ ] 정상 multipart → 서비스 호출 후 스펙 §4 `BulkUploadResponse` 형식 응답
- [ ] dry-run=true: DB 변경 없음, `preview` 배열·`errors` 배열 반환
- [ ] dry-run=false: 트랜잭션 내 일괄 생성, `createdIds` 반환. 1건이라도 실패 시 500 + 전체 롤백
- [ ] 행 수 상한 가드 (예: 500행 초과 → 400) — 스펙 Open Question 보수적 기본값으로 결정

**Verification:**
- [ ] curl/Postman으로 정상 dry-run 응답 확인
- [ ] 권한 외 계정으로 호출 → 403
- [ ] 일부 행 에러 엑셀 dry-run → 에러 배열 정확히 반환
- [ ] 통합 테스트 (테스트 DB) — 정상 commit, 권한 에러 케이스
- [ ] `npx tsc --noEmit`, `npm run lint`

**Dependencies:** Task 1

**Files touched:**
- `app/api/expenses/bulk-upload/route.ts` (신규)
- `app/api/expenses/__tests__/bulk-upload.test.ts` (신규, 가능하면)

**Estimated scope:** S~M (1~2 파일)

---

#### Task 4: 템플릿 다운로드 API (`GET /api/expenses/bulk-upload-template`)

**Description**: 기존 `scripts/generate-upload-template.ts`의 워크북 생성 로직을 함수로 분리해 GET 응답으로 스트리밍. 권한 동일.

**Acceptance criteria:**
- [ ] `GET /api/expenses/bulk-upload-template` 라우트 존재
- [ ] 응답 Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- [ ] Content-Disposition: `attachment; filename="expense-bulk-upload-template.xlsx"`
- [ ] 권한 체크 동일
- [ ] CLI 템플릿(`scripts/generate-upload-template.ts` 결과)과 헤더·시트명·샘플 데이터 동일

**Verification:**
- [ ] 브라우저에서 다운로드 → 파일 열어 헤더 확인
- [ ] CLI `npm run generate-template` 산출물과 바이너리 diff(헤더 행만 비교)는 동일

**Dependencies:** None (Task 1과 병렬 가능하나 서비스 추출 후가 안전 → 순차)

**Files touched:**
- `app/api/expenses/bulk-upload-template/route.ts` (신규)
- (선택) `lib/services/bulk-expense-template.ts` — 워크북 생성 분리 함수

**Estimated scope:** S (1~2 파일)

---

### Checkpoint B: API 동작 검증
- [ ] Task 3, 4 acceptance 통과
- [ ] curl로 dry-run/commit/template 모두 정상 응답
- [ ] 사용자 리뷰 → Phase 3 진입

---

### Phase 3: UI

#### Task 5: 행정간사용 업로드 페이지

**Description**: `app/admin/budget-upload/page.tsx`를 패턴으로 `app/admin/expense-upload/page.tsx`를 생성. 파일 선택 → 검증(dry-run) → 결과 표시 → 확정 업로드 흐름. 템플릿 다운로드 버튼 포함.

**Acceptance criteria:**
- [ ] 페이지 진입 시 권한 체크 (`admin` / `admin_assistant`만 통과, 외 → 메인 리다이렉트)
- [ ] "템플릿 다운로드" 버튼 → `GET /api/expenses/bulk-upload-template`
- [ ] 파일 선택 → "검증" 버튼 활성화 → `POST ?dryRun=true`
- [ ] 결과:
  - 에러 0건: 초록색 요약(생성 예정 N건, 미리보기 테이블) + "확정 업로드" 활성화
  - 에러 1건+: 빨간 에러 테이블(행 번호·필드·메시지) + 확정 비활성화
- [ ] "확정 업로드" 클릭 → `POST ?dryRun=false` → 성공 시 생성 ID 수·"목록으로" 링크
- [ ] 처리 중 스피너, 중복 클릭 방지
- [ ] 페이지 떠나기 전 확정 미실행이면 경고 (브라우저 confirm) — 선택 사항(낮은 우선순위, 누락해도 OK)

**Verification:**
- [ ] 로컬에서 행정간사 계정 로그인 후 페이지 진입 → 전체 흐름 수동 검증
- [ ] 정상 케이스: 템플릿 다운→채워서 업로드→미리보기 통과→확정→목록 페이지 도착
- [ ] 에러 케이스: 청구인 오타 엑셀 → 빨간 에러, 확정 비활성
- [ ] 권한 없는 계정으로 URL 직접 진입 → 차단

**Dependencies:** Task 3, Task 4

**Files touched:**
- `app/admin/expense-upload/page.tsx` (신규)
- `components/admin/ExpenseUploadResult.tsx` (신규)
- (참고) `app/admin/budget-upload/page.tsx`를 패턴으로

**Estimated scope:** M (2~3 파일, ~300줄)

---

#### Task 6: 사이드바 메뉴 등록 + 권한 화이트리스트

**Description**: `lib/constants/admin-menu.ts`에 메뉴 항목 추가, `lib/constants/menu-permissions.ts`의 `admin_assistant` 화이트리스트에 경로 추가. 메뉴 그룹은 기존 구조 보고 결정(권장: 새 "지출관리" 그룹 또는 기존 "예산 마스터" 그룹 끝).

**Acceptance criteria:**
- [ ] 사이드바에 "지출결의서 일괄 업로드" 메뉴 노출 (admin/admin_assistant)
- [ ] 일반 user/team_leader 등은 메뉴 미노출, URL 직접 진입 시 차단
- [ ] 메뉴 아이콘은 `Upload` 또는 `FileSpreadsheet` (`lucide-react`, 기존 사용 중)
- [ ] `canAccessAdminMenuPath('/admin/expense-upload')`가 admin/admin_assistant에 true

**Verification:**
- [ ] 4가지 역할(admin, admin_assistant, team_leader, user)로 로그인 → 사이드바 노출/차단 확인
- [ ] `npx tsc --noEmit`, `npm run lint`

**Dependencies:** Task 5 (페이지 존재 후 메뉴 연결)

**Files touched:**
- `lib/constants/admin-menu.ts`
- `lib/constants/menu-permissions.ts`

**Estimated scope:** S (2 파일, ~10줄)

---

### Checkpoint C: 전체 통합 확인 (Complete)
- [ ] 6개 태스크 모두 acceptance 통과
- [ ] `npm run build` 성공
- [ ] `npm test` 신규 테스트 포함 전부 그린
- [ ] 7개 수동 검증 항목 (스펙 §6) 모두 통과
- [ ] 사용자 리뷰 + 커밋

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| CLI 회귀 — 서비스 추출 시 동작 미세 변경 | High | Task 2에서 변경 전/후 동일 입력→동일 출력 비교. CLI 통합 테스트 1건 추가 가능 |
| 청구인 매칭 실패가 너무 잦으면 행정간사가 활용 불가 | Med | 에러 메시지에 "User 테이블의 정확한 username을 입력해주세요" 안내 + 후속에 사용자 검색 헬퍼 고려 |
| 대용량 파일 트랜잭션 타임아웃 (500+ 행) | Med | 행 수 상한(500) 가드. 초과 시 분할 업로드 안내. Prisma 트랜잭션 timeout 명시 |
| multipart 파싱 — Next.js 16 App Router 호환 | Low | `request.formData()` 표준 API 사용. 기존 첨부파일 업로드 코드(`app/api/upload/`)에 패턴 있을 가능성 — Task 3 시작 시 확인 |
| 권한 우회 — 페이지 클라이언트 가드만 두면 API 직접 호출 가능 | Med | 페이지+API 양쪽 모두 권한 체크. API가 단일 진실. 통합 테스트로 가드 |
| 트랜잭션 내에서 청구인 username 조회 N번 → N+1 쿼리 | Low | dry-run 단계에서 username 사전 일괄 조회 + 캐시 (CLI의 budgetCache 패턴 재사용) |

---

## Parallelization

- **순차 권장**: Task 1 → Task 2 → (Task 3 ∥ Task 4) → Task 5 → Task 6
- Task 3과 Task 4는 서비스 추출 후 병렬 가능하나, 한 사람/세션이면 순차가 단순
- UI(Task 5)는 API 두 개 완성 후 진행

---

## Open Questions (스펙과 동일)

1. 사이드바 그룹 — Task 6에서 코드 보고 최종 결정
2. 행 수 상한 — 기본 500으로 결정 (Task 3 acceptance에 반영)
3. 부분 실패 CSV 다운로드 — 후속
4. 중복 업로드 가드 — 후속

---

## 추정 총 작업량

| 태스크 | 크기 | 누적 |
|---|---|---|
| 1. 공유 서비스 + 테스트 | M | M |
| 2. CLI 리팩터 | S | M+S |
| 3. 업로드 API | S~M | M+M |
| 4. 템플릿 API | S | M+M+S |
| 5. 업로드 UI | M | 2M+S+M |
| 6. 메뉴/권한 | S | **전체 ≈ 3M + 2S** |

신중 진행 시 2~3 세션 분량.
