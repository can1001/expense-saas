# Spec: 지출결의서 목록 합계 행 (Total Row)

작성일: 2026-06-21
대상 페이지: `app/expenses/page.tsx`

## Objective

지출결의서 목록 화면에서 사용자가 적용한 필터/검색에 따라 **조회된 결과의 청구금액 총합**을 한 줄로 보여준다. 회계/팀장/일반 사용자 모두 "지금 보고 있는 결과가 얼마인지"를 한눈에 확인하기 위함.

- **사용자 시나리오 1 (재무 담당자)**: 6월 지급완료 건만 필터링 → 합계 행에서 "지급된 총액"을 즉시 확인.
- **사용자 시나리오 2 (팀장)**: 본인 부서 + 2026년 상반기 필터 → 부서 누적 청구액 확인.
- **사용자 시나리오 3 (일반 사용자)**: 본인 작성분 전체 → 본인이 청구한 총액 확인.

## 결정 사항 (Phase 1 합의됨)

| 항목 | 결정 |
|---|---|
| 합계 범위 | 필터 적용된 **전체 결과**의 합 (현재 페이지가 아님) |
| 표시 방식 | **단일 합계** — 청구금액 총합 1줄 (예: `합계: ₩1,234,500 (152건)`) |
| 적용 범위 | **데스크탑 테이블 + 모바일 카드 리스트** 둘 다 |
| 통화 | KRW 단일 (변환 없음) |
| 합계 대상 필드 | `Expense.requestAmount` |

## 핵심 발견: 1단계는 서버 변경 불필요

`app/expenses/page.tsx:103` 가 `/api/expenses?limit=10000` 으로 **한 번에 다 받아오고**, 모든 필터를 클라이언트 메모리에서 적용한다 (라인 172-). 따라서 이번 1단계에선:

- **합계는 이미 메모리에 있는 `filteredExpenses` 배열을 `reduce` 하면 끝**.
- API 응답 스키마 변경 없음.
- 페이지네이션은 표시용일 뿐 — 메모리상의 전체 결과는 이미 다 있다.
- 권한 필터(전체/팀장/본인)는 서버에서 이미 적용된 상태로 메모리에 들어오므로, 합계도 자동으로 권한 범위와 일치한다.

> ⚠️ `limit=10000` 구조 자체는 서버 부담 문제가 있어 별도 spec (`SPEC_EXPENSE_LIST_SERVER_FILTERING_2026-06-21.md`) 으로 2단계 작업을 잡아두었다. 2단계에서 서버 필터링 + 정상 페이지네이션 + `aggregates` 응답을 도입하면, 이 합계 행은 데이터 출처만 클라 reduce → 서버 aggregate 로 바꾸면 된다 (UI 그대로).

## Tech Stack

- Next.js 16, React 19, TypeScript
- 기존 페이지: `app/expenses/page.tsx` (1673 lines, 클라이언트 컴포넌트)
- 기존 화폐 포맷: `formatCurrency` (이미 사용 중, 라인 1416)

## Project Structure (수정 범위)

```
app/expenses/page.tsx                    # 합계 계산 + 푸터 행 렌더 (1곳)
app/expenses/__tests__/                  # (옵션) 합계 계산 유닛 테스트
```

별도 컴포넌트 분리는 불필요 — 합계 행 JSX는 푸터 1개씩 (데스크탑/모바일) 인라인이면 충분.

## 구현 개요

### 1. 합계 계산 (useMemo)
```tsx
const totalRequestAmount = useMemo(
  () => filteredExpenses.reduce((sum, e) => sum + (e.requestAmount ?? 0), 0),
  [filteredExpenses]
);
const totalCount = filteredExpenses.length;
```
- `filteredExpenses` 는 기존 정의된 변수 (필터·검색 적용 후 배열).
- 정렬·페이지네이션과 무관하게 **필터링 단계의 결과**를 기준으로 합산.

### 2. 데스크탑 (테이블 푸터)
- `<tfoot>` 또는 마지막 `<tr>` 에 합계 행 1줄 추가.
- 첫 번째 셀에 "합계 (N건)", 청구금액 컬럼에 `formatCurrency(totalRequestAmount)`.
- 다른 컬럼은 비움. 시각적으로는 굵은 글씨 + 상단 보더.

### 3. 모바일 (카드 리스트 푸터)
- 카드 리스트 맨 아래에 sticky 가 아닌 일반 합계 카드 1개 추가.
- "합계 N건"과 "₩1,234,500" 을 같은 카드에서 표시.

### 4. Empty State
- `filteredExpenses.length === 0` 이면 합계 행을 **렌더하지 않는다** (기존 "결과 없음" 표시만 노출).

## Code Style (기존 패턴 준수)

```tsx
{/* 데스크탑 합계 행 — 테이블 푸터 */}
{filteredExpenses.length > 0 && (
  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
    <td colSpan={N} className="px-4 py-3 text-right">
      합계 ({totalCount}건)
    </td>
    <td className="px-4 py-3 text-right text-blue-700">
      {formatCurrency(totalRequestAmount)}
    </td>
    <td colSpan={M} />
  </tr>
)}

{/* 모바일 합계 카드 */}
{filteredExpenses.length > 0 && (
  <div className="mt-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">
        합계 ({totalCount}건)
      </span>
      <span className="text-lg font-bold text-blue-700">
        {formatCurrency(totalRequestAmount)}
      </span>
    </div>
  </div>
)}
```

- `colSpan` 값은 실제 테이블 컬럼 수에 맞춰 결정.
- 색상은 기존 페이지의 액센트 색상(파란색)과 통일.

## Testing Strategy

- **유닛 테스트 (옵션, 권장)**: 합계 계산 로직을 함수로 추출 → `sumRequestAmount(filtered)` 단위 테스트.
  - 빈 배열 → 0
  - 단일 항목 → 그 값
  - `null`/`undefined` 포함 → 0으로 처리
- **수동 검증 (필수)**:
  1. 필터 없이 전체 목록 → 합계가 보이고 N건이 페이지 페이지네이션의 `total` 과 일치.
  2. 상태 필터 적용 → 합계가 줄어들고 N건도 줄어든다.
  3. 검색어 입력 → 합계 변경.
  4. 페이지 이동 → 합계는 그대로 (전체 결과 기준).
  5. 결과 0건 → 합계 행이 안 보인다.
- 기존 vitest 스위트(`npm test`)는 깨지면 안 됨.

## Boundaries

- **Always do**:
  - `useMemo` 로 합계 계산 (불필요한 재계산 방지).
  - `formatCurrency` 기존 유틸 사용.
  - empty state 처리.
- **Ask first**:
  - 합계 계산 로직을 별도 파일로 추출 (1줄짜리라 굳이 필요 없음).
  - 합계 행에 다른 컬럼 합계 추가 (예: 항목 단가 합).
  - API 응답에 `aggregates` 필드 추가 (현재는 불필요).
- **Never do**:
  - 페이지네이션 로직 변경.
  - `/api/expenses` 시그니처 변경.
  - 권한 필터 우회.
  - 1만 건 한도 변경 (별도 spec 필요).

## Success Criteria

- [ ] 데스크탑 테이블 마지막에 합계 행이 보인다 (`합계 (N건)` + 청구금액 총합).
- [ ] 모바일 카드 리스트 맨 아래에 합계 카드가 보인다.
- [ ] 필터·검색을 변경하면 합계가 즉시 반영된다.
- [ ] 페이지를 넘겨도 합계가 동일하다 (필터 기준이므로).
- [ ] 결과 0건이면 합계 행이 렌더되지 않는다.
- [ ] 권한별 (admin/팀장/일반) 로 합계가 각자의 조회 범위와 일치한다.
- [ ] `npm test` 통과.
- [ ] TypeScript 컴파일 에러 신규 발생 없음.

## Open Questions

- (해결됨) 합계 범위 = 필터 적용 전체 결과
- (해결됨) 표시 = 단일 합계 1줄
- (해결됨) 적용 = 데스크탑 + 모바일
- (해결됨) 서버 변경 = 불필요

## Out of Scope (이번 작업 범위 외)

- 항목(`ExpenseItem`) 단위 단가/수량 합계
- 상태별 분리 합계 (지급완료/미지급 등)
- Excel/PDF 출력에 합계 행 포함
- 1만 건 초과 시 서버 집계 API 도입
