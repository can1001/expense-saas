# Implementation Plan: 지출결의서 목록 — 지급일자 범위 필터

스펙: [SPEC_EXPENSE_LIST_PAYMENT_DATE_FILTER_2026-05-30.md](./SPEC_EXPENSE_LIST_PAYMENT_DATE_FILTER_2026-05-30.md)
작성일: 2026-05-30

---

## Overview

`/expenses` 페이지의 고급 필터 패널에 **지급일자(`Expense.expenseDate` 컬럼) 범위 검색**을 추가한다.
API/DB 변경 없음. 순수 클라이언트 변경(2개 파일, 약 40줄).
기존 `approvedStartDate`/`approvedEndDate` 필터 패턴을 그대로 미러링.

---

## Architecture Decisions

| 결정 | 이유 |
|---|---|
| **클라이언트 사이드 필터링** 유지 | 기존 모든 필터(`startDate`/`approvedAt` 등)와 동일 패턴. `GET /api/expenses`가 이미 `expenseDate` 포함해 응답함. 데이터 한도 10,000건 내에서 충분. |
| **코드 식별자는 `expenseDate` 명명 유지**, UI 라벨만 "지급일자" | DB/스키마/타입과의 일관성. UI 비즈니스 용어와 코드 식별자 분리. |
| **URL 파라미터 `expenseStart`/`expenseEnd`** | 기존 `approvedStart`/`approvedEnd` 패턴 미러. |
| **null 자동 제외** | 기존 `approvedAt` 필터의 동작과 일관(`if (!expense.approvedAt) return false`). |
| **태스크 2단계 분할** | 타입 선행(prefit) → 기능 슬라이스. 타입 안전성 확보 후 구현. |

---

## Task List

### Phase 1: Foundation

#### Task 1: `ExpenseListItem` 타입에 `expenseDate` 추가

**Description**: API 응답에는 이미 `expenseDate`가 포함되어 있으나 `ExpenseListItem` 타입에 누락되어 있다. 타입을 먼저 확장해 후속 작업에서 타입 안전한 접근이 가능하도록 한다.

**Acceptance criteria:**
- [ ] `lib/types/index.ts:121` `ExpenseListItem`에 `expenseDate?: string | null;` 필드가 추가됨
- [ ] 주석은 `// 지급일자 (재정팀 입력)` 등으로 비즈니스 용어와 정합

**Verification:**
- [ ] `npx tsc --noEmit` 통과 (기존 사용처가 깨지지 않음)

**Dependencies:** None

**Files touched:**
- `lib/types/index.ts`

**Estimated scope:** XS (1 파일, 1줄)

---

### Phase 2: Feature Slice

#### Task 2: 지급일자 범위 필터 구현 (state + URL sync + 필터링 + UI)

**Description**: `app/expenses/page.tsx`에 지급일자 범위 필터를 한 슬라이스로 구현. `expenseStartDate`/`expenseEndDate` 상태를 추가하고 URL 동기화, 필터링 로직, 고급 필터 패널 UI까지 한 번에 처리.

**Acceptance criteria:**
- [ ] `getInitialFilters()`에 `expenseStartDate` / `expenseEndDate` 두 키 추가, URL 파라미터 `expenseStart` / `expenseEnd`에서 초기값 읽기
- [ ] URL 동기화 `useEffect`에 두 값 set 추가 (빈 문자열이면 set 안 함)
- [ ] `filteredExpenses` 로직에 `expenseDate` 범위 검사 추가 — `approvedAt` 필터와 동일 패턴 (값 없는 expense는 둘 중 하나라도 입력 시 제외)
- [ ] `clearFilters()`에 두 키 빈 문자열로 초기화 추가
- [ ] 고급 필터 패널의 "최종승인일 범위" 바로 다음 행에 "지급일자 범위" 입력(시작일 ~ 종료일) UI 추가, 클래스/레이아웃은 기존 패턴 동일
- [ ] `activeFilterCount`는 별도 변경 불필요 (이미 `filters` 객체 전체를 카운트)

**Verification:**
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run dev` 실행 후 수동 검증 (아래 체크리스트)

**Manual verification 체크리스트:**
1. `/expenses` → 고급 필터 열기 → "지급일자 범위" 입력 두 칸 노출
2. 시작일만 입력 → 해당일 이후 지급일자 건만 표시, 지급일자 null인 건 제외
3. 종료일만 입력 → 해당일 이전 지급일자 건만 표시, 지급일자 null인 건 제외
4. 두 날짜 입력 → 범위 내 건만 표시
5. URL에 `?expenseStart=YYYY-MM-DD&expenseEnd=YYYY-MM-DD` 직접 진입 → 상태 복원·결과 일치
6. "필터 초기화" 클릭 → 입력 비워지고 URL 파라미터 제거
7. 다른 필터(위원회/금액/결재상태)와 AND 조합 정상
8. 활성 필터 카운트 뱃지 증감 정상
9. 기존 `requestDate`/`approvedAt` 필터, 정렬, 페이지네이션 회귀 없음

**Dependencies:** Task 1

**Files touched:**
- `app/expenses/page.tsx`

**Estimated scope:** S (1 파일, ~40줄, 동일 패턴 복제)

---

### Checkpoint: Complete

- [ ] Task 1, 2 acceptance criteria 모두 만족
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 통과
- [ ] 수동 검증 체크리스트 9개 항목 통과
- [ ] (선택) `npm run build` 통과 — PWA 빌드까지 검증
- [ ] 사용자 리뷰 후 커밋

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 기존 `approvedAt` 필터 회귀 (붙여넣기 실수로 변수명 혼동) | Med | Task 2 수동 검증 단계에서 두 필터 동시 입력 케이스 확인 |
| 모바일 필터 시트(`showMobileFilters`)에는 새 필터가 없어 일관성 깨짐 | Low | Open Question으로 분리. 본 작업 범위는 데스크톱 고급 필터 패널만. 후속 PR에서 모바일 시트 동기화. |
| 타임존 경계 처리 — `new Date('2026-05-15')`는 UTC 자정 | Low | 기존 `approvedAt` 필터와 동일 동작이므로 일관됨. 사용자가 기존 동작에 익숙. 본 작업에서 변경하지 않음. |
| `expenseDate`가 API 응답에서 빠지면 필터링 무용지물 | Low | 현재 `findMany` `select` 없이 모든 컬럼 반환 — 확인 완료. 추후 누군가 `select`를 좁히면 회귀 가능성. 본 작업에서는 그대로 둠. |

---

## Open Questions

(스펙 §8과 동일 — 본 작업 범위 외)

1. 프리셋 버튼("이번 달" 등) 추가 여부 — 후속 분리.
2. 모바일 필터 시트에도 동일 입력 추가 — 후속 분리.
3. 다른 UI ("일괄 지출일자 설정" 모달 등)의 라벨도 "지급일자"로 일괄 변경할지 — 별도 작업.

---

## Parallelization

본 계획은 단일 파일 위주의 작은 변경이라 **순차 실행 권장**. 병렬화 이득 없음.
