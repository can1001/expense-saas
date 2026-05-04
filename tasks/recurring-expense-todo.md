# 자동이체 UI 구현 태스크 목록

## Phase 1: 기본 CRUD ✅ 완료

- [x] **1.1** RecurringExpenseStatus 컴포넌트 (상태 배지)
- [x] **1.2** FrequencySelector + DayOfMonthInput 컴포넌트
- [x] **1.3** RecurringExpenseForm + 등록 페이지
- [x] **1.4** RecurringExpenseCard + 목록 페이지
- [x] **1.5** RecurringExpenseDetail + 상세 페이지
- [x] **1.6** 수정 페이지

### ✅ Checkpoint 1 완료
- [x] 테스트 통과: 1432개
- [x] 빌드 성공
- [x] 커버리지: 93%+

---

## Phase 2: 상태 관리

- [x] **2.1** 일시정지/재개 기능 ✅
- [ ] **2.2** 취소 기능 + 확인 다이얼로그 ⏳

### ⏳ Checkpoint 2 진행 중
- [ ] 취소 기능 동작 확인
- [ ] ConfirmDialog 테스트 통과

---

## Phase 3: 고급 기능

- [x] **3.1** 목록 상태 필터 ✅ (상태 탭 구현됨)
- [ ] **3.2** 생성 이력 표시 (GeneratedExpenseList)
- [ ] **3.3** 목록 검색 기능
- [ ] **3.4** 무한 스크롤

### ⏳ Checkpoint 3 대기 중
- [ ] 생성 이력 표시 확인
- [ ] 검색 기능 동작 확인
- [ ] 무한 스크롤 동작 확인

---

## 후속 작업

- [ ] **A** 네비게이션 메뉴 추가 ⭐ **최우선**
  - Header.tsx에 "자동이체" 메뉴
  - 재정팀 역할만 표시

---

## 남은 작업 우선순위

| 순위 | Task | 설명 |
|------|------|------|
| 1 | A | 네비게이션 메뉴 (접근성) |
| 2 | 2.2 | 취소 기능 + ConfirmDialog |
| 3 | 3.2 | 생성 이력 표시 |
| 4 | 3.4 | 무한 스크롤 (P0) |
| 5 | 3.3 | 목록 검색 (P1) |

---

## 최종 검증

```bash
npm test -- --run
npm run build
```
