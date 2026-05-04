# 자동이체 UI 구현 태스크 목록

## Phase 1: 기본 CRUD

- [ ] **1.1** RecurringExpenseStatus 컴포넌트 (상태 배지)
  - 파일: `components/recurring-expense/RecurringExpenseStatus.tsx`
  - 테스트 포함

- [ ] **1.2** FrequencySelector + DayOfMonthInput 컴포넌트
  - 파일: `components/recurring-expense/FrequencySelector.tsx`
  - 파일: `components/recurring-expense/DayOfMonthInput.tsx`
  - 테스트 포함

- [ ] **1.3** RecurringExpenseForm + 등록 페이지
  - 파일: `components/recurring-expense/RecurringExpenseForm.tsx`
  - 파일: `app/recurring-expenses/new/page.tsx`
  - BudgetSelector 연동

- [ ] **1.4** RecurringExpenseCard + 목록 페이지
  - 파일: `components/recurring-expense/RecurringExpenseCard.tsx`
  - 파일: `components/recurring-expense/RecurringExpenseList.tsx`
  - 파일: `app/recurring-expenses/page.tsx`

- [ ] **1.5** RecurringExpenseDetail + 상세 페이지
  - 파일: `components/recurring-expense/RecurringExpenseDetail.tsx`
  - 파일: `app/recurring-expenses/[id]/page.tsx`

- [ ] **1.6** 수정 페이지
  - 파일: `app/recurring-expenses/[id]/edit/page.tsx`
  - RecurringExpenseForm 재사용

### ✅ Checkpoint 1
- [ ] 테스트 통과: `npm test -- --run recurring`
- [ ] 빌드 성공: `npm run build`

---

## Phase 2: 상태 관리

- [ ] **2.1** 일시정지/재개 기능
  - 파일: `components/recurring-expense/RecurringExpenseActions.tsx`
  - ConfirmDialog 컴포넌트

- [ ] **2.2** 취소 기능
  - 경고 다이얼로그
  - 상태 전이 규칙 적용

### ✅ Checkpoint 2
- [ ] 일시정지/재개/취소 동작 확인
- [ ] 테스트 통과

---

## Phase 3: 고급 기능

- [ ] **3.1** 생성 이력 표시
  - 파일: `components/recurring-expense/GeneratedExpenseList.tsx`
  - 상세 페이지에 통합

- [ ] **3.2** 목록 필터 기능
  - 상태별 탭/버튼
  - URL 쿼리 파라미터

- [ ] **3.3** 무한 스크롤
  - IntersectionObserver 사용
  - 로딩 인디케이터

### ✅ Checkpoint 3 (최종)
- [ ] 전체 테스트 통과: `npm test -- --run`
- [ ] 빌드 성공: `npm run build`
- [ ] 수동 테스트 완료

---

## 후속 작업 (별도)

- [ ] 네비게이션에 "자동이체" 메뉴 추가
- [ ] 권한 체크 미들웨어 적용
