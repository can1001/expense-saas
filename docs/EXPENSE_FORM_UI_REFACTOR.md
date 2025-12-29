# 지출결의서 폼 UI 개선 전략

## 개요

지출결의서 작성 폼의 사용자 경험을 개선하기 위한 UI 리팩토링 계획입니다.

## 변경 요구사항

### 1. 예산(세목) 위치 변경
- **현재**: BudgetSelector 내부에 위원회~예산(세목) 5단계가 모두 포함
- **변경**: 예산(세목)을 지출정보(ItemsSection) 상단으로 이동
- **이유**: 항목 추가 시 동일한 예산(세목)을 반복 사용하는 경우가 많음

### 2. 버튼 구성 변경
- **현재**: 취소, 저장 버튼만 존재
- **변경**: 취소, 저장, 제출 3개 버튼으로 구성
- **이유**: 저장(임시저장)과 제출(최종제출)의 명확한 구분 필요

---

## 현재 구조 분석

### 파일 구조
```
components/
├── BudgetSelector.tsx       # 5단계 예산 선택 (위원회~세목)
├── ExpenseForm.tsx          # 메인 폼
└── expense-form/
    ├── BudgetSection.tsx    # BudgetSelector 래퍼
    └── ItemsSection.tsx     # 세부 항목 (각 항목에 세목 입력 필드)
```

### 현재 폼 레이아웃
```
1. 예산 정보 (BudgetSection)
   - 위원회
   - 사역팀(부)
   - 예산(항)
   - 예산(목)
   - 예산(세목) ← 이동 대상

2. 지출일자 (ExpenseDateSection)

3. 세부 항목 (ItemsSection)
   - 항목별: 예산(세목), 적요, 단가, 수량, 금액

4. 신청 정보 (ApplicantSection)

5. 은행 정보 (BankAccountSelector)

6. 첨부파일 (FileUpload)

7. 버튼: [취소] [저장]
```

---

## 변경 후 구조

### 변경된 폼 레이아웃
```
1. 예산 정보 (BudgetSection) - 4단계로 축소
   - 위원회
   - 사역팀(부)
   - 예산(항)
   - 예산(목)

2. 지출일자 (ExpenseDateSection)

3. 지출 세부정보 (ItemsSection) - 확장
   ┌─────────────────────────────────────┐
   │ 예산(세목) 선택                      │  ← 상단에 공통 선택 영역 추가
   │ [드롭다운: 선택된 목에 해당하는 세목] │
   │ [+ 적용] 버튼으로 항목에 일괄 적용    │
   └─────────────────────────────────────┘
   - 항목 1: 예산(세목), 적요, 단가, 수량, 금액
   - 항목 2: 예산(세목), 적요, 단가, 수량, 금액
   - ...

4. 신청 정보 (ApplicantSection)

5. 은행 정보 (BankAccountSelector)

6. 첨부파일 (FileUpload)

7. 버튼: [취소] [저장] [제출]
```

---

## 상세 구현 전략

### Phase 1: 데이터 모델 확장

#### 1.1 Expense 상태 필드 추가 (필요시)
```prisma
// prisma/schema.prisma
model Expense {
  // 기존 필드...
  status      String   @default("draft")  // draft | submitted | approved | rejected
}
```

> **참고**: 현재 스키마에 status 필드가 있는지 확인 필요. 없다면 추가.

### Phase 2: BudgetSelector 분리

#### 2.1 BudgetSelector 수정
- 예산(세목) 선택 UI를 조건부 렌더링으로 변경
- `showDetail` prop 추가: `true`일 때만 세목 드롭다운 표시
- 세목 옵션 목록을 외부로 노출하는 기능 추가

```tsx
// components/BudgetSelector.tsx 수정
interface BudgetSelectorProps {
  // 기존 props...
  showDetail?: boolean;           // 세목 표시 여부
  onDetailsLoaded?: (details: string[]) => void;  // 세목 옵션 전달
}
```

#### 2.2 DetailSelector 신규 컴포넌트 생성
```tsx
// components/expense-form/DetailSelector.tsx
interface DetailSelectorProps {
  options: string[];              // 사용 가능한 세목 목록
  onApply: (detail: string) => void;  // 항목에 적용
  disabled?: boolean;
}
```

### Phase 3: ItemsSection 확장

#### 3.1 상단 영역 추가
- 예산(세목) 드롭다운 배치
- "현재 항목에 적용" 버튼 추가
- 선택된 세목을 새 항목 추가 시 기본값으로 설정

#### 3.2 동작 방식
1. 사용자가 예산(목)까지 선택 → API에서 해당하는 세목 목록 로드
2. ItemsSection 상단에 세목 드롭다운 표시
3. 세목 선택 후 "적용" 클릭 → 현재 포커스된 항목 또는 첫 번째 항목에 적용
4. 새 항목 추가 시 → 마지막 선택된 세목이 기본값으로 입력

### Phase 4: 버튼 구성 변경

#### 4.1 버튼 레이아웃
```tsx
<div className="flex justify-end gap-4">
  <button type="button" onClick={handleCancel}>취소</button>
  <button type="button" onClick={handleSave}>저장</button>
  <button type="submit" onClick={handleSubmit}>제출</button>
</div>
```

#### 4.2 버튼 동작 정의
| 버튼 | 동작 | status 값 |
|------|------|-----------|
| 취소 | 이전 페이지로 이동 | - |
| 저장 | 임시저장 (수정 가능) | `draft` |
| 제출 | 최종 제출 (결재 진행) | `submitted` |

#### 4.3 저장 vs 제출 차이점
- **저장 (draft)**
  - 목록에서 "임시저장" 표시
  - 언제든 수정 가능
  - 결재선에 올라가지 않음

- **제출 (submitted)**
  - 목록에서 "제출됨" 표시
  - 수정 불가 (또는 취소 후 재작성)
  - 결재선에 올라감

---

## 파일 수정 목록

### 수정 대상
1. `components/BudgetSelector.tsx`
   - `showDetail` prop 추가
   - 세목 옵션 외부 전달 콜백 추가

2. `components/expense-form/BudgetSection.tsx`
   - `showDetail={false}` 전달
   - 세목 옵션을 상위로 전달

3. `components/expense-form/ItemsSection.tsx`
   - 상단에 세목 선택 영역 추가
   - 세목 적용 로직 구현

4. `components/ExpenseForm.tsx`
   - 세목 옵션 상태 관리
   - 버튼 구성 변경 (저장/제출 분리)
   - 저장/제출 핸들러 분리

5. `prisma/schema.prisma` (필요시)
   - status 필드 추가

6. `app/api/expenses/route.ts`
   - status 필드 처리 추가

### 신규 생성
1. `components/expense-form/DetailSelector.tsx`
   - 세목 선택 및 적용 전용 컴포넌트

---

## UI 와이어프레임

### 세목 선택 영역 (ItemsSection 상단)
```
┌──────────────────────────────────────────────────────────────┐
│ 지출 세부정보                                    [+ 항목 추가] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  예산(세목)                                                   │
│  ┌─────────────────────────────┐  ┌─────────────────┐        │
│  │ 교육자료비                ▼ │  │ 현재 항목에 적용 │        │
│  └─────────────────────────────┘  └─────────────────┘        │
│                                                              │
│  ※ 선택한 세목은 새 항목 추가 시 자동으로 적용됩니다          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [항목 1]                                                     │
│   예산(세목): 교육자료비  │  적요: 교재 구입                  │
│   단가: 15,000  │  수량: 10  │  금액: 150,000원              │
├──────────────────────────────────────────────────────────────┤
│ [항목 2]                                                     │
│   ...                                                        │
└──────────────────────────────────────────────────────────────┘
```

### 하단 버튼 영역
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                      [취소]  [저장]  [제출]                   │
│                       ↑       ↑       ↑                      │
│                     회색    청색    녹색                      │
│                    outline  outline primary                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 구현 순서

1. **Step 1**: 스키마 확인 및 status 필드 추가 (필요시)
2. **Step 2**: BudgetSelector에서 세목 분리 (`showDetail` prop)
3. **Step 3**: DetailSelector 컴포넌트 생성
4. **Step 4**: ItemsSection 상단에 세목 선택 영역 추가
5. **Step 5**: ExpenseForm 버튼 구성 변경 (저장/제출 분리)
6. **Step 6**: API 수정 (status 필드 처리)
7. **Step 7**: 목록 페이지에서 상태 표시

---

## 고려사항

### 1. 기존 데이터 호환성
- status 필드 추가 시 기존 데이터는 기본값 `submitted`로 처리
- 또는 migration으로 일괄 업데이트

### 2. 세목 없는 경우 처리
- 일부 예산(목)에는 세목이 없을 수 있음
- 이 경우 세목 선택 영역 비활성화 및 직접 입력 안내

### 3. 권한 처리 (향후)
- 제출된 지출결의서는 작성자가 수정 불가
- 관리자만 상태 변경 가능

### 4. 버튼 비활성화 조건
- 저장: 필수 필드 미입력 시에도 저장 가능 (임시저장)
- 제출: 모든 필수 필드 입력 완료 시에만 활성화

---

## 예상 작업량

| 단계 | 작업 내용 | 복잡도 |
|------|----------|--------|
| Step 1 | 스키마 수정 | 낮음 |
| Step 2 | BudgetSelector 수정 | 중간 |
| Step 3 | DetailSelector 생성 | 낮음 |
| Step 4 | ItemsSection 확장 | 중간 |
| Step 5 | ExpenseForm 버튼 변경 | 중간 |
| Step 6 | API 수정 | 낮음 |
| Step 7 | 목록 상태 표시 | 낮음 |

---

## 참고

- 관공서 문서 작성 시스템 패턴 참고
- 저장(draft) → 제출(submitted) 워크플로우는 대부분의 전자결재 시스템에서 사용
