# 자동이체 UI 구현 계획

## 의존성 그래프

```
                    ┌─────────────────────┐
                    │   API (완료)         │
                    │ /api/recurring-*     │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ 상태 배지      │    │ 주기/일자 선택기 │    │ 훅 (데이터 로드) │
│ StatusBadge   │    │ Frequency/Day   │    │ useRecurring*   │
└───────┬───────┘    └────────┬────────┘    └────────┬────────┘
        │                     │                      │
        └──────────┬──────────┴──────────────────────┘
                   ▼
        ┌─────────────────────┐
        │  RecurringExpenseCard│
        │  (목록 카드 항목)     │
        └──────────┬──────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ 목록 페이지│ │ 등록 폼   │ │ 상세 페이지│
│ /r-e     │ │ /r-e/new │ │ /r-e/[id]│
└──────────┘ └──────────┘ └────┬─────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ 수정 페이지│ │ 상태 변경 │ │ 이력 조회 │
             │ /r-e/edit│ │ 일시정지등│ │ 생성이력  │
             └──────────┘ └──────────┘ └──────────┘
```

---

## 수직 슬라이스 (Vertical Slices)

각 태스크는 하나의 완전한 사용자 시나리오를 구현합니다.

---

## Phase 1: 기본 CRUD

### Task 1.1: 상태 배지 컴포넌트

**목표**: 자동이체 상태를 시각적으로 표시하는 배지 컴포넌트

**구현 파일**:
- `components/recurring-expense/RecurringExpenseStatus.tsx`
- `components/recurring-expense/__tests__/RecurringExpenseStatus.test.tsx`

**Acceptance Criteria**:
- [ ] ACTIVE → 녹색 배지 "활성"
- [ ] PAUSED → 노란색 배지 "일시정지"
- [ ] COMPLETED → 회색 배지 "완료"
- [ ] CANCELLED → 빨간색 배지 "취소"
- [ ] 테스트 커버리지 100%

**검증**:
```bash
npm test -- --run RecurringExpenseStatus
```

---

### Task 1.2: 주기/이체일 선택 컴포넌트

**목표**: 주기(월간/분기 등)와 이체일(1-28) 선택 UI

**구현 파일**:
- `components/recurring-expense/FrequencySelector.tsx`
- `components/recurring-expense/DayOfMonthInput.tsx`
- `components/recurring-expense/__tests__/FrequencySelector.test.tsx`
- `components/recurring-expense/__tests__/DayOfMonthInput.test.tsx`

**Acceptance Criteria**:
- [ ] FrequencySelector: 4가지 주기 선택 (라벨: 월간/분기/반기/연간)
- [ ] DayOfMonthInput: 1-28 범위 제한
- [ ] DayOfMonthInput: 28 초과 입력 시 28로 고정
- [ ] 폼 연동 (react-hook-form register 지원)

**검증**:
```bash
npm test -- --run FrequencySelector
npm test -- --run DayOfMonthInput
```

---

### Task 1.3: 자동이체 등록 폼 + 등록 페이지

**목표**: 자동이체를 등록할 수 있는 전체 플로우

**구현 파일**:
- `components/recurring-expense/RecurringExpenseForm.tsx`
- `app/recurring-expenses/new/page.tsx`

**Acceptance Criteria**:
- [ ] BudgetSelector로 5단계 예산 항목 선택
- [ ] 모든 필수 필드 검증 (Zod)
- [ ] 금액 입력 시 콤마 포맷
- [ ] 저장 성공 시 목록 페이지로 이동
- [ ] 저장 실패 시 에러 메시지 표시
- [ ] 권한 체크 (재정팀만 접근)

**검증**:
1. 브라우저에서 `/recurring-expenses/new` 접근
2. 폼 입력 후 저장
3. API 응답 확인 (Network 탭)
4. 목록 페이지로 이동 확인

---

### Task 1.4: 자동이체 카드 + 목록 페이지

**목표**: 등록된 자동이체 목록 조회 및 표시

**구현 파일**:
- `components/recurring-expense/RecurringExpenseCard.tsx`
- `components/recurring-expense/RecurringExpenseList.tsx`
- `app/recurring-expenses/page.tsx`

**Acceptance Criteria**:
- [ ] 카드에 이름, 수취인, 금액, 주기, 상태 표시
- [ ] 다음 생성일 표시
- [ ] 카드 클릭 시 상세 페이지 이동
- [ ] 로딩 스켈레톤 표시
- [ ] 빈 목록 시 안내 메시지

**검증**:
1. `/recurring-expenses` 접근
2. 등록된 자동이체 목록 표시 확인
3. 카드 클릭 시 상세 페이지 이동

---

### Task 1.5: 자동이체 상세 페이지

**목표**: 자동이체 상세 정보 조회

**구현 파일**:
- `components/recurring-expense/RecurringExpenseDetail.tsx`
- `app/recurring-expenses/[id]/page.tsx`

**Acceptance Criteria**:
- [ ] 모든 정보 섹션별 표시 (기본/주기/은행)
- [ ] 다음 생성 예정일 표시
- [ ] 수정 버튼 → 수정 페이지 이동
- [ ] 404 처리 (존재하지 않는 ID)
- [ ] 권한 체크 (본인 소유만)

**검증**:
1. `/recurring-expenses/{id}` 접근
2. 정보 표시 확인
3. 수정 버튼 클릭 시 이동

---

### Task 1.6: 자동이체 수정 페이지

**목표**: 기존 자동이체 수정

**구현 파일**:
- `app/recurring-expenses/[id]/edit/page.tsx`

**Acceptance Criteria**:
- [ ] 기존 데이터 폼에 로드
- [ ] RecurringExpenseForm 재사용 (mode="edit")
- [ ] 저장 성공 시 상세 페이지로 이동
- [ ] CANCELLED/COMPLETED 상태는 수정 불가 (리다이렉트)

**검증**:
1. 상세 페이지에서 수정 버튼 클릭
2. 기존 데이터 로드 확인
3. 수정 후 저장

---

## ✅ Checkpoint 1

**Phase 1 완료 조건**:
- [ ] 등록 → 목록 → 상세 → 수정 전체 플로우 동작
- [ ] 모든 컴포넌트 테스트 통과
- [ ] 빌드 성공

```bash
npm test -- --run recurring
npm run build
```

---

## Phase 2: 상태 관리

### Task 2.1: 일시정지/재개 기능

**목표**: 자동이체 일시정지 및 재개

**구현 파일**:
- `components/recurring-expense/RecurringExpenseActions.tsx`
- `components/ui/ConfirmDialog.tsx` (공용)
- 상세 페이지 수정

**Acceptance Criteria**:
- [ ] ACTIVE 상태: "일시정지" 버튼 표시
- [ ] PAUSED 상태: "재개" 버튼 표시
- [ ] 확인 다이얼로그 후 API 호출
- [ ] 성공 시 상태 즉시 반영
- [ ] 실패 시 에러 메시지

**검증**:
1. 활성 자동이체 일시정지
2. 상태 배지 변경 확인
3. 일시정지된 자동이체 재개

---

### Task 2.2: 취소 기능

**목표**: 자동이체 취소 (되돌릴 수 없음)

**구현 파일**:
- RecurringExpenseActions.tsx 수정

**Acceptance Criteria**:
- [ ] "취소" 버튼 표시 (CANCELLED 제외)
- [ ] 경고 다이얼로그: "이 작업은 되돌릴 수 없습니다"
- [ ] 취소 후 수정/재개 버튼 숨김
- [ ] 취소 후 목록 페이지로 이동

**검증**:
1. 자동이체 취소
2. 상태 배지 "취소"로 변경
3. 수정 버튼 숨김 확인

---

## ✅ Checkpoint 2

**Phase 2 완료 조건**:
- [ ] 일시정지/재개/취소 전체 동작
- [ ] 확인 다이얼로그 동작
- [ ] 상태 전이 규칙 준수

---

## Phase 3: 고급 기능

### Task 3.1: 생성 이력 표시

**목표**: 자동 생성된 지출결의서 목록 표시

**구현 파일**:
- `components/recurring-expense/GeneratedExpenseList.tsx`
- 상세 페이지에 추가

**Acceptance Criteria**:
- [ ] 최근 10건 표시
- [ ] 생성일, 금액, 상태 표시
- [ ] 클릭 시 지출결의서 상세 페이지 이동
- [ ] 빈 목록 시 "생성된 지출결의서가 없습니다"

---

### Task 3.2: 목록 필터 기능

**목표**: 상태별 필터링

**구현 파일**:
- 목록 페이지 수정

**Acceptance Criteria**:
- [ ] 상태 탭/버튼 (전체/활성/일시정지/완료/취소)
- [ ] URL 쿼리 파라미터 반영 (?status=ACTIVE)
- [ ] 필터 변경 시 목록 갱신

---

### Task 3.3: 무한 스크롤

**목표**: 모바일 환경 무한 스크롤

**구현 파일**:
- 목록 페이지 수정

**Acceptance Criteria**:
- [ ] 초기 10개 로드
- [ ] 스크롤 시 추가 로드
- [ ] 로딩 인디케이터 표시
- [ ] 더 이상 데이터 없으면 종료

---

## ✅ Checkpoint 3 (최종)

**Phase 3 완료 조건**:
- [ ] 생성 이력 표시 동작
- [ ] 필터 동작
- [ ] 무한 스크롤 동작
- [ ] 전체 테스트 통과
- [ ] 빌드 성공

```bash
npm test -- --run
npm run build
```

---

## 네비게이션 추가 (Phase 완료 후)

목록 완료 후 사이드바/모바일 네비게이션에 "자동이체" 메뉴 추가 필요.

---

## 파일 목록 요약

| Phase | 파일 | 유형 |
|-------|------|------|
| 1 | `components/recurring-expense/RecurringExpenseStatus.tsx` | 신규 |
| 1 | `components/recurring-expense/FrequencySelector.tsx` | 신규 |
| 1 | `components/recurring-expense/DayOfMonthInput.tsx` | 신규 |
| 1 | `components/recurring-expense/RecurringExpenseForm.tsx` | 신규 |
| 1 | `components/recurring-expense/RecurringExpenseCard.tsx` | 신규 |
| 1 | `components/recurring-expense/RecurringExpenseList.tsx` | 신규 |
| 1 | `components/recurring-expense/RecurringExpenseDetail.tsx` | 신규 |
| 1 | `app/recurring-expenses/page.tsx` | 신규 |
| 1 | `app/recurring-expenses/new/page.tsx` | 신규 |
| 1 | `app/recurring-expenses/[id]/page.tsx` | 신규 |
| 1 | `app/recurring-expenses/[id]/edit/page.tsx` | 신규 |
| 2 | `components/recurring-expense/RecurringExpenseActions.tsx` | 신규 |
| 2 | `components/ui/ConfirmDialog.tsx` | 신규/수정 |
| 3 | `components/recurring-expense/GeneratedExpenseList.tsx` | 신규 |

---

## 예상 태스크 수

| Phase | 태스크 수 | 예상 파일 수 |
|-------|---------|------------|
| Phase 1 | 6 | 11 |
| Phase 2 | 2 | 2 |
| Phase 3 | 3 | 1 |
| **합계** | **11** | **~14** |
