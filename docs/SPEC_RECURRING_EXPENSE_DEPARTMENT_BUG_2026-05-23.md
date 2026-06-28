# Spec: 자동이체 등록 - 사역팀 선택 오류 수정

**작성일**: 2026-05-23
**브랜치**: `feat-recurring-expense-daivd-260504`
**유형**: 버그 수정 (Bug Fix)
**우선순위**: High (자동이체 신규 등록 자체가 불가능)

## 1. Objective

### 무엇을, 왜 고치는가
자동이체 신규 등록 페이지(`/recurring-expenses/new`)에서 BudgetSelector의 5단계 계층 선택(위원회 → 사역팀 → 항 → 목 → 세목)이 위원회 다음 단계인 **사역팀**에서 중단된다. 사용자가 사역팀을 선택해도 즉시 빈 값으로 되돌아가 다음 단계가 로드되지 않는다. 자동이체 등록 자체를 막는 차단(blocker) 버그이므로 즉시 수정한다.

### 사용자 시나리오
- 행정간사/재무팀이 자동이체를 신규 등록하려고 함
- 위원회 선택 → 사역팀 드롭다운 표시됨
- 사역팀 선택 → 선택값이 즉시 사라지고 항/목/세목이 로드되지 않음
- 등록 불가능

### 성공 기준 (Success Criteria)
- [ ] 신규 등록 페이지에서 위원회 → 사역팀 → 항 → 목 → 세목 5단계 cascade 선택이 끊김 없이 동작
- [ ] 수정 페이지에서도 동일하게 사역팀 변경이 정상 동작
- [ ] 폼 제출 시 5개 예산 계층 필드가 모두 RecurringExpense 테이블에 저장됨
- [ ] 기존 일반 지출결의서 폼(`BudgetSection.tsx`)과 동일한 동작 패턴
- [ ] 회귀 방지를 위한 통합 테스트 추가

## 2. 근본 원인 (Root Cause Analysis)

### 발견된 버그
`components/recurring-expense/RecurringExpenseForm.tsx:236-250`

```tsx
<Controller
  name="committee"            // ❌ committee 하나만 watch
  control={control}
  render={({ field }) => (
    <BudgetSelector
      value={{
        committee: field.value,
        department: initialData?.department || '',      // ❌ 초기값에서 고정
        category: initialData?.budgetCategory || '',    // ❌ 초기값에서 고정
        subcategory: initialData?.budgetSubcategory || '',
        detail: initialData?.budgetDetail || '',
      }}
      onChange={handleBudgetChange}
    />
  )}
/>
```

### 왜 깨지는가
1. 사용자가 사역팀 선택 → `BudgetSelector.handleChange('department', X)` 실행
2. `onChange` → `handleBudgetChange` → `setValue('department', X)` 호출
3. 그러나 BudgetSelector의 `value.department` prop은 `initialData?.department || ''`에 묶여있어 갱신되지 않음
4. 다음 렌더에서 `<select value={value.department || ''}>`가 다시 `''`로 표시됨 → 선택값 사라짐
5. `value.department`가 falsy하므로 `BudgetSelector:300` `{value.department && ...}` 조건에 따라 예산(항) 섹션 자체가 렌더링되지 않음
6. 신규 등록은 `initialData` 자체가 undefined이므로 항상 발생, 수정 페이지는 초기에 값이 채워져 있어 가려지지만 사역팀을 변경하려 하면 동일 버그 발생

### 올바른 참조 패턴
`components/expense-form/BudgetSection.tsx:33-106`에서 5개 필드 각각을 `Controller`로 중첩하여 `field.value`를 BudgetSelector에 전달하는 패턴이 이미 정상 동작 중.

## 3. Tech Stack

- Next.js 16, React 19, TypeScript
- react-hook-form (Controller 패턴)
- Zod (검증)
- Prisma (RecurringExpense 모델)

## 4. 수정 범위 (Scope)

### 수정할 파일
1. `components/recurring-expense/RecurringExpenseForm.tsx`
   - BudgetSelector 통합 부분(line 236-250)을 5개 필드 중첩 Controller 패턴으로 교체
   - `handleBudgetChange`는 더 이상 필요 없거나, 각 Controller의 `field.onChange`로 대체

### 추가할 파일
2. `components/recurring-expense/__tests__/RecurringExpenseForm.test.tsx`
   - 기존 테스트 파일에 사역팀 선택 cascade 테스트 추가

### 건드리지 않는 파일
- `components/BudgetSelector.tsx` (내부 동작은 정상)
- `app/api/budget/route.ts` (API는 정상)
- `lib/recurring-expense.ts` (스키마 정상)
- `prisma/schema.prisma`

## 5. Code Style

`BudgetSection.tsx`의 중첩 Controller 패턴을 참조한다.

```tsx
<Controller
  name="committee"
  control={control}
  render={({ field: committeeField }) => (
    <Controller
      name="department"
      control={control}
      render={({ field: departmentField }) => (
        <Controller
          name="budgetCategory"
          control={control}
          render={({ field: categoryField }) => (
            <Controller
              name="budgetSubcategory"
              control={control}
              render={({ field: subcategoryField }) => (
                <Controller
                  name="budgetDetail"
                  control={control}
                  render={({ field: detailField }) => (
                    <BudgetSelector
                      value={{
                        committee: committeeField.value,
                        department: departmentField.value,
                        category: categoryField.value,
                        subcategory: subcategoryField.value,
                        detail: detailField.value,
                      }}
                      onChange={(budget) => {
                        committeeField.onChange(budget.committee || '');
                        departmentField.onChange(budget.department || '');
                        categoryField.onChange(budget.category || '');
                        subcategoryField.onChange(budget.subcategory || '');
                        detailField.onChange(budget.detail || '');
                      }}
                    />
                  )}
                />
              )}
            />
          )}
        />
      )}
    />
  )}
/>
```

대안 (더 간결): `useWatch`로 5개 필드를 한 번에 구독하고 일반 `<BudgetSelector>` 호출:

```tsx
const committee = useWatch({ control, name: 'committee' });
const department = useWatch({ control, name: 'department' });
const budgetCategory = useWatch({ control, name: 'budgetCategory' });
const budgetSubcategory = useWatch({ control, name: 'budgetSubcategory' });
const budgetDetail = useWatch({ control, name: 'budgetDetail' });

<BudgetSelector
  value={{
    committee: committee || '',
    department: department || '',
    category: budgetCategory || '',
    subcategory: budgetSubcategory || '',
    detail: budgetDetail || '',
  }}
  onChange={handleBudgetChange}
/>
```
→ 기존 코드 스타일(BudgetSection.tsx와의 일관성)을 우선하면 **중첩 Controller 패턴** 채택.

## 6. Testing Strategy

### 단위/통합 테스트 (Jest + Testing Library)
파일: `components/recurring-expense/__tests__/RecurringExpenseForm.test.tsx`

추가할 테스트:
- ✅ "위원회 선택 후 사역팀 드롭다운이 표시되고 옵션을 가져온다"
- ✅ "사역팀 선택 후 선택값이 유지된다" (회귀 방지)
- ✅ "사역팀 선택 후 예산(항) 섹션이 렌더링된다"
- ✅ "5단계 cascade를 모두 완료한 뒤 제출하면 5개 필드가 모두 페이로드에 포함된다"
- ✅ "수정 페이지에서 사역팀을 다른 값으로 변경하면 하위(항/목/세목)가 초기화된다"

API mocking 전략: `/api/budget` POST 응답을 `jest.fn` 또는 `msw`로 모킹 (기존 테스트에 이미 패턴이 있다면 따름).

### 수동 검증
1. `npm run dev`로 서버 실행
2. `/recurring-expenses/new` 접속 → 5단계 cascade 직접 클릭하며 끊김 없음 확인
3. `/recurring-expenses/[id]/edit` 접속 → 기존 값이 표시되고 사역팀을 다른 값으로 변경 시 정상 동작 확인

## 7. Boundaries

### Always do
- `BudgetSection.tsx` 패턴과 일관되게 유지
- 기존 `handleBudgetChange` 로직(빈 값 처리)을 새 패턴에서도 동일하게 보존
- 변경 후 lint/typecheck/test 모두 통과 확인
- 한글 커밋 메시지

### Ask first
- 만약 `useWatch` 대안 패턴이 더 낫다고 판단되면 결정 전에 확인
- 테스트 환경에서 `/api/budget` 모킹 방식이 기존과 달라야 한다면 확인

### Never do
- BudgetSelector 내부 로직 변경 (영향 범위 확대)
- 다른 폼(BudgetSection.tsx, ItemBudgetSelector.tsx 등) 동시 리팩토링
- 기존 자동이체 데이터 마이그레이션
- `prisma/schema.prisma` 변경

## 8. Open Questions

1. **Q**: 신규 등록과 수정 페이지에서 사역팀이 깨졌는데, 사용자는 "신규 등록"만 명시했습니다. 수정 페이지 검증도 함께 진행할까요?
   → 같은 컴포넌트(`RecurringExpenseForm`)이므로 한 번에 수정 + 양쪽 회귀 테스트 권장.
2. **Q**: `useWatch` vs 중첩 Controller — 어느 패턴을 채택할까요?
   → 기본 권장: **중첩 Controller** (BudgetSection.tsx와의 일관성). 단, 가독성이 떨어진다는 의견이 있다면 useWatch도 고려.

## 9. Phase 2 — Plan (요약)

1. 현재 RecurringExpenseForm BudgetSelector 부분 백업 차원에서 변경 전 코드 확인
2. 중첩 Controller 패턴으로 교체 (5필드)
3. `handleBudgetChange`는 inline onChange로 대체 (또는 헬퍼로 유지)
4. 테스트 추가 → 실패 확인 → 수정 → 통과 확인
5. lint, typecheck 통과
6. 수동 브라우저 검증 (`npm run dev`)
7. 커밋 (한글 메시지)

## 10. Verification Checklist (병합 전)

- [ ] `npm run lint` 통과
- [ ] `npm test -- RecurringExpenseForm` 통과
- [ ] 새 회귀 테스트가 본 버그 수정 전에는 실패, 수정 후 통과함을 확인 (TDD)
- [ ] 수동: 신규 등록 페이지에서 5단계 cascade 끝까지 선택 가능
- [ ] 수동: 수정 페이지에서 사역팀 변경 시 하위 초기화 정상
- [ ] 수동: 제출 시 5개 필드 모두 페이로드에 포함 (DevTools Network 탭 확인)
