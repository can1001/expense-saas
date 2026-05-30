# Spec: 행정간사용 지출결의서 엑셀 일괄 업로드 (웹 UI)

작성일: 2026-05-30
대상 사용자: 행정간사 (`role = admin_assistant`), 관리자 (`role = admin`)
참고 기존 자산: [BULK_UPLOAD.md](./BULK_UPLOAD.md), `scripts/bulk-upload.ts`, `scripts/generate-upload-template.ts`

---

## 1. Objective

행정간사가 **CLI 접근 없이 웹 UI로** 엑셀 파일을 업로드하여 여러 건의 지출결의서를 한 번에 등록할 수 있도록 한다. 기존 CLI 일괄 업로드 로직(`scripts/bulk-upload.ts`)을 API/UI로 이식하여 동일 포맷·동일 동작을 제공.

### User Story
- 행정간사로서, 월말에 여러 부서로부터 받은 지출결의서 목록을 엑셀 한 파일로 정리한 뒤,
- 웹 UI에서 파일을 올리고 **미리보기로 오류를 확인** → 모두 OK일 때 **"확정 업로드"** 하면,
- DRAFT 상태의 지출결의서가 한꺼번에 생성되어 각 작성자/팀장이 후속 결재를 진행할 수 있다.

### Success Criteria
- 행정간사/관리자만 접근 가능한 `/admin/expense-upload` 페이지 존재
- 페이지에서:
  - 템플릿 엑셀 다운로드 가능 (기존 CLI 템플릿과 동일 구조)
  - 엑셀 업로드 → **미리보기 모드(dry-run)** 자동 실행 → 검증 결과(총 행수·예상 생성 건수·오류 목록) 표시
  - 오류가 0건이면 **"확정 업로드"** 버튼 활성화 → 클릭 시 트랜잭션으로 전체 저장
  - 오류가 1건이라도 있으면 확정 업로드 비활성화 (전체 롤백 정책)
- 생성된 지출결의서:
  - `status = DRAFT`, 결재선 미생성 (작성자가 추후 상신)
  - `userId` = 청구인 이름(`applicantName`)으로 조회한 사용자 ID (조회 실패 시 해당 행 에러)
  - `paymentStatus = PENDING` (기본값)
- 트랜잭션 보장: 한 행이라도 DB 저장 실패 시 전체 롤백
- 권한 외 사용자가 페이지 직접 진입 시 403 또는 메인 리다이렉트
- 권한 외 사용자가 API 직접 호출 시 401/403 응답

### Non-Goals (이번 스펙에서 다루지 않음)
- 첨부파일(영수증 사진) 일괄 업로드 — 후속 스펙
- 결재선 자동 생성/자동 상신 — DRAFT만 만들고 끝
- 자동이체(RecurringExpense) 일괄 등록 — 후속 스펙
- CLI 스크립트 제거/마이그레이션 — 기존 CLI는 운영 유지

---

## 2. Tech Stack

- Next.js 16 App Router (Client + Server)
- TypeScript, React 19
- **신규 의존성 없음** — `exceljs`, `prisma`, `xlsx` 처리 모두 기존 활용
- 권한: `lib/auth/get-current-user.ts` 패턴 (세션 기반)
- 트랜잭션: Prisma `$transaction`

---

## 3. Commands

```bash
npm run dev                                    # 로컬 개발
npm run build                                  # 프로덕션 빌드
npm run lint                                   # ESLint
npx tsc --noEmit                               # 타입 체크
npm test -- bulk-expense-upload                # 신규 단위 테스트
```

기존 CLI는 변경 없이 유지:
```bash
npm run generate-template
npm run bulk-upload -- ./file.xlsx --dry-run
```

---

## 4. Project Structure (신규/변경)

| 경로 | 종류 | 설명 |
|---|---|---|
| `app/admin/expense-upload/page.tsx` | 신규 | 행정간사용 업로드 UI 페이지 |
| `app/api/expenses/bulk-upload/route.ts` | 신규 | POST: 엑셀 파일 multipart 수신 → 검증/저장. `?dryRun=true`로 미리보기 |
| `app/api/expenses/bulk-upload-template/route.ts` | 신규 | GET: 기존 `generate-upload-template.ts` 로직 호출 → 엑셀 파일 응답 |
| `lib/services/bulk-expense-upload-service.ts` | 신규 | `scripts/bulk-upload.ts`의 핵심 로직(읽기/검증/그룹핑/생성)을 함수로 이식. CLI와 API 양쪽이 import해 코드 중복 제거 |
| `lib/__tests__/bulk-expense-upload-service.test.ts` | 신규 | 검증 로직, 그룹핑, 트랜잭션 동작 테스트 |
| `scripts/bulk-upload.ts` | 변경 | 새 서비스 import해서 사용하도록 리팩터(동작 동일) |
| `components/admin/ExpenseUploadResult.tsx` | 신규 | 검증 결과/에러 표시 컴포넌트 (테이블 형식) |
| `app/admin/layout.tsx` 또는 사이드바 | 변경 | 행정간사/관리자 대상 메뉴 항목 "지출결의서 일괄 업로드" 추가 |

**API 응답 스키마:**
```ts
// POST /api/expenses/bulk-upload (multipart, optional ?dryRun=true)
type BulkUploadResponse = {
  dryRun: boolean;
  totalRows: number;
  totalExpenses: number;       // 그룹핑 후 생성될 지출결의서 수
  errors: Array<{
    rowNumber: number;         // 엑셀 1-based 행 번호
    groupId?: string;
    field?: string;
    message: string;
  }>;
  preview?: Array<{            // dryRun=true일 때만
    groupId: string;
    committee: string;
    department: string;
    applicantName: string;
    itemsCount: number;
    requestAmount: number;
  }>;
  createdIds?: string[];       // dryRun=false 성공 시
};
```

---

## 5. Code Style

### 권한 체크 (모든 API/페이지 진입점)
```ts
const ALLOWED_ROLES = ['admin', 'admin_assistant'] as const;

const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
if (!ALLOWED_ROLES.includes(user.role)) {
  return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
}
```

### 서비스 함수 시그니처 (CLI/API 공유)
```ts
// lib/services/bulk-expense-upload-service.ts
export interface BulkUploadOptions {
  dryRun: boolean;
}
export interface BulkUploadResult { /* 위 BulkUploadResponse와 거의 동일 */ }

export async function parseExpenseExcel(buffer: Buffer): Promise<ExcelRow[]>;
export function validateRows(rows: ExcelRow[]): ValidationError[];
export function groupRows(rows: ExcelRow[]): Map<string, ExcelRow[]>;
export async function executeBulkUpload(
  rows: ExcelRow[],
  options: BulkUploadOptions
): Promise<BulkUploadResult>;
```

### 트랜잭션
```ts
const createdIds = await prisma.$transaction(async (tx) => {
  const ids: string[] = [];
  for (const [groupKey, groupRows] of groups) {
    const expense = await tx.expense.create({ data: { /* ... */ } });
    ids.push(expense.id);
  }
  return ids;
});
// 어느 한 건이라도 실패하면 전체 롤백
```

### UI 페이지 패턴 (기존 `app/admin/budget-upload/page.tsx` 미러)
1. 파일 선택 (`<input type="file" accept=".xlsx">`)
2. "검증" 버튼 → `POST /api/expenses/bulk-upload?dryRun=true`
3. 결과 표시:
   - 에러 없음 → 초록색 요약 + "확정 업로드" 버튼 활성화
   - 에러 있음 → 빨간 에러 테이블 + 확정 버튼 비활성화
4. "확정 업로드" 클릭 → 같은 파일 재전송 `?dryRun=false`
5. 성공 시 생성된 ID 리스트와 함께 "목록 보기" 링크 노출

---

## 6. Testing Strategy

### 단위 테스트 (Vitest, `lib/__tests__/`)
| 케이스 | 검증 |
|---|---|
| 필수 컬럼 누락 (`category`, `unitPrice` 등) | `validateRows`가 행번호·필드 포함 에러 반환 |
| `unitPrice` 또는 `quantity`가 음수/0 | 에러 |
| `requestDate` 파싱 실패 | 에러 |
| `groupId` 같은 행들 → 1개 expense + 여러 items | `groupRows` 결과 확인 |
| `groupId` 없음 → 각 행이 개별 expense | `groupRows` 결과 |
| 예산 계층 조회 실패 → 에러 (단, 그룹 단위로 한 번만 조회) | mock prisma |
| 청구인 이름 매칭 실패 → 에러 (admin 폴백 없음) | mock prisma |
| 트랜잭션 중 1건 실패 → 전체 롤백, createdIds 빈 배열 | mock prisma 트랜잭션 |
| dryRun=true → DB 변경 없음, preview 채워짐 | mock prisma |

### API 통합 테스트
- 권한 없는 user(role=user)가 POST 시 403
- 잘못된 multipart 본문 시 400
- 정상 dryRun → 정상 응답
- 정상 commit → 생성된 expense들 DB에 존재

### 수동 검증 (UI)
1. 행정간사 계정으로 로그인 → 사이드바에 "지출결의서 일괄 업로드" 메뉴 노출
2. 일반 사용자 계정으로 로그인 → 메뉴 미노출, URL 직접 진입 시 차단
3. 정상 엑셀 업로드 → 미리보기 통과 → 확정 → 목록 페이지에서 생성 확인 (DRAFT 상태)
4. 일부 행 에러 엑셀 업로드 → 미리보기에서 빨간 에러 테이블 노출, 확정 버튼 비활성
5. 청구인 이름 오타 → 해당 행만 에러로 표시
6. 큰 파일(100행) 업로드 성능 — 5초 내 응답 기대 (CLI 성능 기준)
7. 템플릿 다운로드 → 엑셀 파일 내려받고 헤더 확인

---

## 7. Boundaries

### Always do
- 모든 진입점(페이지/API)에서 권한 체크 (`admin` 또는 `admin_assistant`)
- 검증 → 미리보기 → 확정의 2단계 워크플로우 유지
- 전체 트랜잭션 — 일부 성공 절대 없음
- 기존 CLI 동작과 비즈니스 로직 일치 (날짜 파싱, 그룹핑, 금액 계산 등)
- `lib/services/budget-lookup-service.ts:lookupBudgetHierarchy` 재사용 (CLI의 `findBudgetInfo` 중복 제거)

### Ask first
- 결재선 자동 생성/상신 도입 여부 (현재 DRAFT만)
- 첨부파일 일괄 처리 여부
- 청구인 매칭 실패 시 admin 폴백 재허용 여부 (현 스펙은 폴백 안 함)
- 파일 크기 상한 (현재 무제한, 보통 < 1MB 예상)
- 동일 데이터 중복 업로드 방어 (해시 비교 등) — 현재 없음

### Never do
- CLI 스크립트(`scripts/bulk-upload.ts`) 제거. 새 서비스 import로만 변경, 외부 호출 인터페이스 그대로 유지
- `scripts/generate-upload-template.ts`의 포맷 변경
- 권한 체크 우회 (개발 편의용 토글 금지)
- 트랜잭션 외부에서 expense.create (부분 저장 위험)
- prisma raw SQL — 모두 Prisma Client 사용
- 결재선/지급상태 강제 변경 (DRAFT/PENDING 기본값만)

---

## 8. Open Questions

1. **메뉴 진입 경로**: `/admin/expense-upload`로 가닥. 사이드바 그룹은 "지출관리"인지 "행정"인지 결정 필요 (현재 `app/admin/`의 다른 페이지 구조 참고해 정함).
2. **파일 크기 제한**: 현재 미정. 행 수 상한(예: 500행)으로 가드 추가할지.
3. **부분 실패 리포트 CSV 다운로드**: 후속 작업으로 분리.
4. **재실행 방지(중복 업로드 가드)**: 동일 파일 해시/내용 비교는 후속 작업.
5. **i18n**: 모든 메시지 한글로 작성(기존 컨벤션과 일치).

---

## 9. Migration / Backward Compatibility

- 기존 CLI 사용자 영향 없음 (`npm run bulk-upload`, `npm run generate-template` 그대로 동작)
- DB 스키마 변경 없음
- 기존 `app/api/expenses/bulk/` (인쇄용 일괄 조회)와 경로 구분: 신규는 `bulk-upload`

---

## 10. 다음 단계

본 스펙 승인 후:
1. `/planning-and-task-breakdown` — 5~7개 태스크 분해 예상 (서비스 추출 → API → UI → 권한 → 테스트)
2. `/incremental-implementation` — 슬라이스 단위 구현 (예: 서비스/CLI 리팩터 → API → UI 순)
3. 단위·통합 테스트 통과 + 수동 검증 7개 항목 통과 후 커밋
