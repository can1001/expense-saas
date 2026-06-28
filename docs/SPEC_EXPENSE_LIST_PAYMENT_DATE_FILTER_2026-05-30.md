# Spec: 지출결의서 목록 — 지급일자 범위 필터 추가

> **라벨 결정**: 사용자 요청에 따라 UI 라벨은 **"지급일자"**로 통일.
> 단, 코드 식별자(상태 키, URL 파라미터, DB 컬럼)는 기존 `expenseDate` 명명을 유지하여 코드 일관성 확보.

작성일: 2026-05-30
대상 페이지: `/expenses` (지출결의서 목록)
관련 코드: `app/expenses/page.tsx`, `lib/types/index.ts`

---

## 1. Objective

지출결의서 목록 페이지의 고급 필터 패널에 **지급일자(`expenseDate` 컬럼) 범위 검색** 기능을 추가하여,
재정팀이 "특정 기간에 지급 처리된 건"을 빠르게 조회할 수 있도록 한다.

### User Story
- 재정팀원으로서, 5월 15일~5월 31일 사이에 지급일자가 설정된 결의서만 목록에서 보고 싶다.
- 그래야 월말 지급 결산 시 해당 기간 지출 건을 누락 없이 확인·정산할 수 있다.

### Success Criteria
- 고급 필터 패널에 "지급일자 범위" 입력(시작일~종료일)이 노출된다.
- 시작일/종료일 중 하나만 입력해도 동작한다(한쪽 무한대).
- 두 날짜 모두 입력 시 `startDate ≤ expenseDate ≤ endDate`인 건만 표시된다.
- 지출일자가 `null`(미입력)인 건은 둘 중 하나라도 조건이 걸리면 결과에서 자동 제외된다.
  (기존 `approvedAt` 필터의 동일 동작과 일관)
- URL 파라미터(`expenseStart`, `expenseEnd`)로 상태가 동기화되어 새로고침/공유 시에도 유지된다.
- "필터 초기화" 버튼 클릭 시 지출일자 범위도 함께 초기화된다.
- "활성 필터 카운트"(`activeFilterCount`)에도 반영된다.

---

## 2. Tech Stack

- Next.js 16 App Router (Client Component)
- React 19 + TypeScript
- 기존 코드 컨벤션 준수 (Tailwind CSS 4, date input)
- 추가 의존성 없음

---

## 3. Commands

```bash
npm run dev         # 로컬 개발 (http://localhost:3000/expenses)
npm run build       # 프로덕션 빌드 검증 (--webpack)
npm run lint        # ESLint 검증
npx tsc --noEmit    # 타입 체크
```

---

## 4. 영향 받는 파일 (Project Structure)

| 파일 | 변경 내용 |
|---|---|
| `lib/types/index.ts` | `ExpenseListItem`에 `expenseDate?: string \| null` 추가 |
| `app/expenses/page.tsx` | filters state, URL 동기화, 필터링 로직, 고급 필터 UI 추가 |

**API/DB 변경 없음**
- `Expense.expenseDate` 컬럼은 이미 존재 (`prisma/schema.prisma:26`).
- `GET /api/expenses`는 `findMany`에 `select` 없이 모든 컬럼을 반환하므로 `expenseDate`도 이미 응답에 포함됨. (확인 완료 — 추가 API 작업 불필요)
- 필터링은 클라이언트 사이드(기존 `requestDate`/`approvedAt` 필터와 동일 패턴).

---

## 5. Code Style

기존 `최종승인일 범위` 필터와 동일한 형태로 추가. 예시:

```tsx
// filters state (추가)
expenseStartDate: searchParams.get('expenseStart') || '',
expenseEndDate: searchParams.get('expenseEnd') || '',

// URL 동기화 (추가)
if (filters.expenseStartDate) params.set('expenseStart', filters.expenseStartDate);
if (filters.expenseEndDate) params.set('expenseEnd', filters.expenseEndDate);

// 필터링 로직 (추가) — approvedAt 패턴과 동일
if (filters.expenseStartDate) {
  if (!expense.expenseDate) return false;
  const expDate = new Date(expense.expenseDate);
  const startDate = new Date(filters.expenseStartDate);
  if (expDate < startDate) return false;
}
if (filters.expenseEndDate) {
  if (!expense.expenseDate) return false;
  const expDate = new Date(expense.expenseDate);
  const endDate = new Date(filters.expenseEndDate);
  if (expDate > endDate) return false;
}

// UI (고급 필터 패널 안, 최종승인일 범위 다음 행)
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    지급일자 범위
  </label>
  <div className="flex gap-2 items-center">
    <input
      type="date"
      value={filters.expenseStartDate}
      onChange={(e) => handleFilterChange('expenseStartDate', e.target.value)}
      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg ..."
    />
    <span className="text-gray-500">~</span>
    <input
      type="date"
      value={filters.expenseEndDate}
      onChange={(e) => handleFilterChange('expenseEndDate', e.target.value)}
      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg ..."
    />
  </div>
</div>
```

### 명명 규칙
- 상태 키: `expenseStartDate`, `expenseEndDate` (기존 `approvedStartDate`/`approvedEndDate` 패턴 일치)
- URL 파라미터: `expenseStart`, `expenseEnd` (기존 `approvedStart`/`approvedEnd` 패턴 일치)
- UI 라벨: **"지급일자 범위"** — 사용자 비즈니스 용어.
  > ℹ️ 코드 식별자와 DB 컬럼은 기존 `expenseDate`를 그대로 사용. UI 라벨만 "지급일자"로 노출.
  > 추후 `BulkExpenseDateModal`의 "일괄 지출일자 설정" 라벨도 동일하게 변경하는 것은 별도 작업으로 분리.

---

## 6. Testing Strategy

### 수동 검증 체크리스트 (필수)
1. `/expenses` 진입 → 고급 필터 열기 → "지급일자 범위" 입력 두 칸이 보인다.
2. 시작일만 입력 → 해당일 이후 지급일자 건만 노출, 지급일자 null인 건은 제외됨.
3. 종료일만 입력 → 해당일 이전 지급일자 건만 노출, 지급일자 null인 건은 제외됨.
4. 둘 다 입력 → 범위 내 건만 노출.
5. 시작일=종료일 → 해당일 단일 건만 노출.
6. URL에 `?expenseStart=2026-05-15&expenseEnd=2026-05-31`로 직접 진입 → 필터 상태 복원, 결과 일치.
7. "필터 초기화" 클릭 → 두 입력 모두 빈 값, URL 파라미터 제거.
8. 다른 필터(위원회/금액/결재상태/지급상태)와 AND 조합 정상 동작.
9. 활성 필터 카운트 뱃지 숫자 정상 증가/감소.
10. 모바일 뷰(`md:` 미적용 영역)에서 입력 동작·레이아웃 정상.

### 회귀 검증
- 기존 `requestDate` 범위 필터, `approvedAt` 범위 필터, 텍스트 검색, 정렬, 페이지네이션이 영향받지 않는지 확인.

### 단위 테스트
- 단위 테스트 추가는 필수 아님(필터링이 한 컴포넌트 내 인라인 로직). 필요 시 `filteredExpenses` 로직만 헬퍼로 추출 후 테스트할 수 있으나, 본 스펙 범위는 최소 변경 우선.

---

## 7. Boundaries

### Always do
- 기존 `approvedStartDate`/`approvedEndDate` 패턴을 그대로 미러링 (코드 일관성).
- URL 파라미터 동기화 누락 없이 유지.
- `clearFilters()`, `activeFilterCount`, `getInitialFilters()` 모두 동시 업데이트.

### Ask first
- 모바일 전용 단축 프리셋(예: "이번 달", "지난 달") 추가 여부 — 본 스펙에는 미포함.
- 서버 사이드 필터링으로 전환할지 (현재 클라이언트 필터, 데이터 10,000건 한도 내에서 충분).
- `BulkExpenseDateModal`을 비롯한 기타 UI의 "지출일자" 라벨도 "지급일자"로 일괄 변경할지(별도 작업).

### Never do
- API 라우트(`/api/expenses`) 시그니처 변경. 본 작업은 순수 클라이언트 변경.
- `prisma/schema.prisma` 수정. `expenseDate` 컬럼은 이미 존재.
- `paymentCompletedAt`(지급완료시각) 필터 추가. 사용자 답변에 따라 본 스펙은 `expenseDate`만 대상.
- 기존 컬럼 UI(테이블/카드)에 "지출일자" 컬럼 추가. 본 스펙은 필터만 추가.

---

## 8. Open Questions

1. **프리셋 버튼**: "오늘 / 이번주 / 이번달 / 지난달" 같은 빠른 선택 버튼은 후속 작업으로 분리.
2. **모바일 필터 시트(`showMobileFilters`)**: 동일 필터를 모바일 시트에도 추가할지. (현 페이지 구조상 동일 `filters` 상태를 공유하므로, 모바일 시트 UI에도 동일 입력을 추가하는 것이 자연스러움 — Phase 2에서 결정.)
3. **타 UI의 라벨 통일**: `BulkExpenseDateModal` 등의 "지출일자" 라벨도 "지급일자"로 일괄 변경할지 별도 작업으로 결정.

---

## 9. 다음 단계

본 스펙 승인 후:
1. `/planning-and-task-breakdown` 으로 태스크 분해 (예상 3개 태스크).
2. `/incremental-implementation` 으로 슬라이스 단위 구현.
3. 수동 검증 체크리스트 통과 확인 후 커밋.
