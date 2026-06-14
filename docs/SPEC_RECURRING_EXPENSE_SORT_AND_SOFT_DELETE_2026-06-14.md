# Spec: 자동이체 관리 — 이체일 정렬 및 취소 항목 숨김

작성일: 2026-06-14
대상 경로: `/recurring-expenses`

## Objective

자동이체 관리 페이지의 운영성을 개선한다.

1. **정렬 개선** — 다음 이체가 임박한 항목이 가장 위에 오도록 정렬하여, 운영자가 "곧 나갈 돈"을 한눈에 파악할 수 있게 한다.
2. **취소 항목 소프트 삭제** — `CANCELLED` 상태는 기본 목록·전체 필터에서 숨겨, 살아있는 자동이체만 보이도록 한다. DB 행은 감사 목적으로 보존하며 명시적으로 'CANCELLED' 필터를 선택해야만 열람 가능하다.

### Users / Acceptance

- 자동이체 관리자(admin / finance_head / accountant / finance_member / admin_assistant)
- AC-1: 목록 진입 시 `nextGenerationDate` 오름차순으로 정렬되어 표시된다. `null`(COMPLETED/CANCELLED 등)은 가장 뒤에 위치한다.
- AC-2: 'ALL' 또는 'ACTIVE/PAUSED/COMPLETED' 필터에서 CANCELLED 항목은 보이지 않는다.
- AC-3: 'CANCELLED' 필터를 명시적으로 선택해야만 취소된 항목이 노출된다.
- AC-4: DELETE 호출 시 `status = CANCELLED` 및 `deletedAt = now()`가 함께 저장된다 (감사 목적의 삭제 시각 기록).
- AC-5: 상단 상태 카운트 뱃지에서 ALL 카운트는 CANCELLED를 제외한 합계와 일치한다.
- AC-6: 자동이체 크론(`/api/recurring-expenses/process`)의 처리 대상에는 변동 없음(이미 `status: ACTIVE`만 조회 — 회귀 없음).

## Tech Stack (영향 영역)

- Next.js 16 App Router
- Prisma 7 + PostgreSQL(Neon)
- React 19 + Tailwind 4
- 변경 모듈: `prisma/schema.prisma`, `app/api/recurring-expenses/route.ts`, `app/api/recurring-expenses/[id]/route.ts`, `app/recurring-expenses/page.tsx`

## Commands

```bash
npm run dev                                                  # 로컬 검증
npm run build                                                # 타입체크 + 빌드
npx vitest run app/api/recurring-expenses/__tests__         # 자동이체 API 테스트
npm run db:push                                              # schema 변경 반영 (deletedAt 컬럼 추가)
```

## Project Structure (변경 파일)

```
prisma/schema.prisma                                   # RecurringExpense.deletedAt 추가
app/api/recurring-expenses/route.ts                    # GET 정렬·기본 숨김
app/api/recurring-expenses/[id]/route.ts               # DELETE에 deletedAt 세팅
app/recurring-expenses/page.tsx                        # 상태 카운트 보정 (CANCELLED 제외)
app/api/recurring-expenses/__tests__/recurring-expenses.test.ts  # 회귀 테스트 보강
docs/SPEC_RECURRING_EXPENSE_SORT_AND_SOFT_DELETE_2026-06-14.md   # 본 문서
```

## Code Style

기존 코드 스타일 준수. 정렬·필터 구성은 단일 객체로 일관되게.

```ts
// GET /api/recurring-expenses
const where: Prisma.RecurringExpenseWhereInput =
  canManageAllRecurringExpenses(currentUser.role)
    ? {}
    : { userId: currentUser.id };

// 상태 필터: 명시적으로 CANCELLED 선택 시에만 노출, 그 외에는 CANCELLED 제외
if (status === 'CANCELLED') {
  where.status = 'CANCELLED';
} else if (status) {
  where.status = status as RecurringExpenseStatus;
} else {
  where.status = { not: 'CANCELLED' };
}

// 이체 임박순 정렬 (null 뒤로). cursor 페이지네이션은 합성 cursor로 전환.
const recurringExpenses = await prisma.recurringExpense.findMany({
  where,
  take: limit + 1,
  ...(cursor && {
    cursor: { id: cursor },   // 단일 cursor 유지 + tie-break id ASC
    skip: 1,
  }),
  orderBy: [
    { nextGenerationDate: { sort: 'asc', nulls: 'last' } },
    { id: 'asc' },
  ],
  // ...
});
```

```prisma
model RecurringExpense {
  // ... 기존 필드 ...
  deletedAt DateTime? // 소프트 삭제 시각 (status=CANCELLED와 동시 세팅)

  @@index([deletedAt])
}
```

## Testing Strategy

- 프레임워크: 기존 vitest 설정 사용 (`vi.mock`, `vi.fn`)
- 위치: `app/api/recurring-expenses/__tests__/recurring-expenses.test.ts` 확장
- 추가 케이스:
  - `status` 미지정 시 CANCELLED 제외 확인
  - `status=CANCELLED` 명시 시 CANCELLED만 반환
  - `status=ACTIVE` 시 ACTIVE만 반환 (회귀)
  - 정렬: `nextGenerationDate` ASC, null 뒤
  - DELETE 호출 시 `status=CANCELLED`, `deletedAt != null` 동시 세팅
- 빌드 + 기존 테스트 회귀 모두 그린

## Boundaries

- **Always**: 
  - 모든 GET 쿼리는 기본적으로 `status != CANCELLED` 적용 (운영자가 명시한 경우만 예외)
  - DELETE는 항상 `status` + `deletedAt`을 트랜잭션 1회로 세팅
  - 자동이체 크론 로직(`processRecurringExpenses`)은 건드리지 않음 — 이미 ACTIVE만 조회
- **Ask first**:
  - `nextGenerationDate`가 nullable이어서 정렬 시 `nulls: last` 옵션이 필요한데, Prisma 버전 호환성 이슈 발견 시 raw SQL fallback 검토
  - cursor 페이지네이션을 단순 `id`로 유지할지, `(nextGenerationDate, id)` 합성 cursor로 전환할지 — 한계 100건 + 무한스크롤 특성상 단순 유지 후 sort instability가 관측되면 합성 cursor로 전환
- **Never**:
  - DB 행을 hard delete 하지 않는다 (감사 목적)
  - CANCELLED 항목을 ACTIVE/PAUSED로 되돌리는 복구 UI 도입 금지 (요구사항 명시: 복구 불필요)
  - 기존 검색·페이지네이션 응답 shape 변경 금지 (UI 무수정 호환)

## Success Criteria

- [ ] `npm run build` 통과
- [ ] `npm test -- recurring` 통과 (기존 + 신규 케이스)
- [ ] 로컬에서 자동이체 페이지 진입 시 다음 이체 임박순으로 정렬됨 (육안 확인)
- [ ] CANCELLED 카드는 ALL 필터에서 보이지 않음
- [ ] CANCELLED 필터 선택 시 취소 항목이 보임
- [ ] DELETE 후 DB에 `status=CANCELLED`, `deletedAt != null` 동시 기록

## Open Questions

없음 (사전 합의 완료).

## 비범위 (Out of Scope)

- 자동이체 상세 페이지 UI 변경
- 모바일 카드 컴포넌트 시각 변경 (정렬은 API 단에서 자동 반영되므로 코드 변경 불필요)
- 복구(undo) 기능
- 별도 휴지통 화면
