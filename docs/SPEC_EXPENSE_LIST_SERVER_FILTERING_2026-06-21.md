# Spec: 지출결의서 목록 — 서버 필터링 + 정상 페이지네이션 + Aggregate

작성일: 2026-06-21
상태: **2단계 (대기)** — 1단계(`SPEC_EXPENSE_LIST_TOTAL_ROW_2026-06-21.md`) 완료 후 진행

## 배경 / 문제

`app/expenses/page.tsx:103` 는 `/api/expenses?limit=10000` 으로 한 번에 최대 1만 건을 받아 클라이언트에서 필터링/정렬/페이지네이션을 처리한다. 지출결의서 데이터가 누적되면서:

- **DB 부담**: 매 페이지 진입마다 권한 범위 전체를 조회 → `findMany` 가 대용량 결과 반환
- **네트워크/직렬화 부담**: 1만 건 × N 필드 × `include`(items, attachments) = 수 MB JSON
- **메모리 부담**: 클라가 사실상 안 쓸 데이터를 전부 보유
- **숨은 스케일 한계**: 1만 건 초과 시 누락된 결의서가 화면에 안 보임 — 조용한 버그
- **불필요한 작업**: 사용자는 99%를 안 본다 (필터링 후 버려짐)

## Objective

API 가 표준 페이지네이션 + 서버 필터링을 수행하도록 전환하여, **요청당 50건 안팎만 주고받는** 정상 구조로 복원한다. 동시에 응답에 `aggregates` 를 포함시켜 합계 행이 클라 reduce 가 아닌 **서버 집계 값**을 표시하게 한다.

## 결정 사항 (사전 합의)

| 항목 | 결정 |
|---|---|
| 단계 | 1단계(합계 행) → **이번 2단계(서버 전환)** → 후속 |
| 페이지당 기본 limit | 50 (변경 가능, 추후 결정) |
| 합계 데이터 출처 | 서버 응답 `aggregates.totalRequestAmount` |
| 필터 파라미터 | 현재 클라 필터 11종(라인 131-143)을 그대로 서버로 이동 |
| 권한 처리 | 기존 `where` 권한 분기 유지 |

## Scope (2단계에서 변경)

### 서버 (`app/api/expenses/route.ts`)
- 쿼리스트링 수신: `committee`, `department`, `category`, `startDate`, `endDate`, `minAmount`, `maxAmount`, `status`, `paymentStatus`, `approvedStart`, `approvedEnd`, `expenseStart`, `expenseEnd`, `q`(검색어), `sortBy`, `sortDir`
- `where` 절에 모두 반영
- `OR` 검색: 신청자명/예산명/설명 등 (현재 클라 검색 대상과 동일)
- `aggregate({ _sum: { requestAmount: true }, _count: true })` 1회 호출 추가 → 응답에 `aggregates: { totalRequestAmount, totalCount }` 포함
- 정렬을 서버 `orderBy` 로 처리

### 클라이언트 (`app/expenses/page.tsx`)
- `fetch('/api/expenses?limit=10000')` → **현재 필터/검색/정렬/페이지 상태를 모두 쿼리스트링으로 전송**
- 필터 변경 시 자동 refetch (debounce 검색어)
- 페이지네이션 UI 가 서버 `pagination` 응답 기반으로 동작
- 클라이언트 측 필터링 함수(라인 172-)를 **삭제 또는 축소**
- 합계 행: `useMemo(reduce)` → 응답 `aggregates.totalRequestAmount` 로 데이터 출처 교체
- UI 컴포넌트 자체는 1단계 그대로

## 위험 / 검증

- **회귀 위험 큼** — 1673줄 페이지의 데이터 흐름을 바꾸는 변경. 단계별 검증 필수:
  - 권한별 (admin/팀장/일반) 결과 동일성
  - 각 필터 단독 동작
  - 필터 조합
  - 정렬 안정성
  - 페이지 이동 / 페이지 크기 변경
  - 검색어 debounce
- **인덱스 점검**: 자주 쓰는 필터 컬럼(`status`, `paymentStatus`, `expenseDate`, `createdAt`)에 인덱스 존재 확인. 없으면 `prisma/schema.prisma` 에 추가.
- **`aggregate` 비용**: `where` 가 인덱스 적중하면 거의 무료. 적중 안 하면 별도 인덱스 필요.

## Success Criteria

- [ ] 페이지 진입 시 1회 요청이 **50건만** 받는다 (네트워크 패널 확인).
- [ ] 모든 기존 필터/검색/정렬이 동일하게 동작한다.
- [ ] 합계 행이 서버 `aggregates` 값을 표시한다.
- [ ] 권한별 조회 범위가 1단계와 동일하다.
- [ ] `npm test` 통과 + 신규 API 테스트 추가.
- [ ] 1만 건 초과 시나리오에서 누락 없이 페이지네이션 가능.

## Out of Scope

- 검색 인덱싱(전문 검색, FTS) 도입
- 가상 스크롤 / 무한 스크롤 재도입
- Excel/PDF 출력 경로 (별도 export API 가 따로 있음)

## Open Questions (구현 시작 전 확정 필요)

- 기본 페이지 크기 50이 적당? (20/50/100 중 선택)
- 검색어 debounce 시간 (300ms?)
- 정렬 가능 컬럼 목록 (현재 클라 정렬 키 전부 서버로 옮길지)
- 모바일 페이지네이션 UI 방식 (기존 페이지 버튼 vs 무한 스크롤)
