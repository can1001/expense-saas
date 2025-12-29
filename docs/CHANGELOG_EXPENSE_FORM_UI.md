# 지출결의서 폼 UI 개선 변경 로그

**변경일**: 2025-12-29

## 개요

지출결의서 작성 폼의 사용자 경험을 개선하기 위한 UI 리팩토링을 완료했습니다.

---

## 변경 사항

### 1. 예산(세목) 위치 변경

#### 변경 전
- 예산 정보 섹션에서 위원회 → 사역팀 → 예산(항) → 예산(목) → 예산(세목) 5단계 연속 선택

#### 변경 후
- 예산 정보 섹션: 위원회 → 사역팀 → 예산(항) → 예산(목) 4단계만 표시
- 예산(세목): 세부 항목 섹션 상단으로 이동

#### 새로운 기능
- 세목 선택 후 "빈 항목에 적용" 버튼으로 빈 항목에 일괄 적용
- 새 항목 추가 시 마지막 선택한 세목이 자동으로 입력됨
- 예산(목) 변경 시 세목 선택 초기화

---

### 2. 버튼 구성 변경

#### 변경 전
```
[취소] [저장]
```

#### 변경 후
```
[취소] [저장] [제출]
 회색   파랑   녹색
```

| 버튼 | 색상 | 동작 | 상태값 |
|------|------|------|--------|
| 취소 | 회색 (outline) | 이전 페이지로 이동 | - |
| 저장 | 파랑 (primary) | 임시저장 (수정 가능) | `DRAFT` |
| 제출 | 녹색 (success) | 최종 제출 (결재 진행) | `PENDING` |

---

### 3. 목록 페이지 결재상태 표시

#### 변경 전
- 지출상태 컬럼만 표시 (지출예정/지출완료)

#### 변경 후
- 결재상태 컬럼 추가
- 지출상태 컬럼 유지

#### 결재상태 배지
| 상태 | 배지 색상 | 표시 텍스트 |
|------|----------|------------|
| DRAFT | 회색 | 임시저장 |
| PENDING | 파랑 | 결재대기 |
| APPROVED_STEP_1 | 인디고 | 1차승인 |
| APPROVED_STEP_2 | 보라 | 2차승인 |
| APPROVED_FINAL | 녹색 | 최종승인 |
| REJECTED | 빨강 | 반려 |
| WITHDRAWN | 주황 | 회수 |

---

## 수정된 파일 목록

### 컴포넌트
| 파일 | 변경 내용 |
|------|----------|
| `components/BudgetSelector.tsx` | `showDetail`, `onDetailsLoaded` props 추가 |
| `components/expense-form/BudgetSection.tsx` | 세목 표시 여부 제어 props 추가 |
| `components/expense-form/ItemsSection.tsx` | 상단 세목 선택 영역 추가 |
| `components/ExpenseForm.tsx` | 세목 옵션 상태 관리, 버튼 구성 변경 |

### API
| 파일 | 변경 내용 |
|------|----------|
| `app/api/expenses/route.ts` | POST 시 status 필드 처리 추가 |
| `app/api/expenses/[id]/route.ts` | PUT 시 status 필드 처리 추가 |

### 페이지
| 파일 | 변경 내용 |
|------|----------|
| `app/expenses/page.tsx` | 결재상태 컬럼 추가 |

---

## 상세 코드 변경

### BudgetSelector.tsx

```typescript
// Props 추가
interface BudgetSelectorProps {
  // 기존 props...
  showDetail?: boolean;  // 세목 표시 여부 (기본값: true)
  onDetailsLoaded?: (details: string[]) => void;  // 세목 옵션 외부 전달
}
```

### ItemsSection.tsx

```typescript
// Props 추가
interface ItemsSectionProps {
  // 기존 props...
  detailOptions?: string[];  // 사용 가능한 세목 목록
}

// 새로운 상태
const [selectedDetail, setSelectedDetail] = useState<string>('');

// 새 항목 추가 시 선택된 세목 자동 적용
const handleAddItem = () => {
  append({
    ...defaultExpenseItem,
    budgetDetail: selectedDetail || '',
  });
};
```

### ExpenseForm.tsx

```typescript
// 새로운 상태
const [detailOptions, setDetailOptions] = useState<string[]>([]);
const [submitMode, setSubmitMode] = useState<'save' | 'submit'>('save');

// 제출 시 status 결정
const onSubmit = (data: ExpenseFormData) => {
  const status = submitMode === 'submit' ? 'PENDING' : 'DRAFT';
  handleFormSubmit({ ...data, status });
};
```

### API - POST /api/expenses

```typescript
// 상태 처리 추가
const status = body.status === 'PENDING' ? 'PENDING' : 'DRAFT';
const submittedAt = status === 'PENDING' ? new Date() : null;

const expense = await prisma.expense.create({
  data: {
    // 기존 필드...
    status,
    submittedAt,
    // ...
  },
});
```

---

## UI 미리보기

### 세목 선택 영역 (ItemsSection 상단)
```
┌──────────────────────────────────────────────────────────────┐
│ 세부 항목                                        [+ 항목 추가] │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 예산(세목)                                               │ │
│  │ ┌───────────────────────────┐ ┌──────────────────┐      │ │
│  │ │ 세목 선택              ▼  │ │ 빈 항목에 적용   │      │ │
│  │ └───────────────────────────┘ └──────────────────┘      │ │
│  │ 선택한 세목은 새 항목 추가 시 자동으로 적용됩니다        │ │
│  └─────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ [항목 1] ...                                                 │
└──────────────────────────────────────────────────────────────┘
```

### 하단 버튼 영역
```
                              [취소]  [저장]  [제출]
```

---

## 참고사항

- 기존 데이터 호환성: 기존 데이터는 스키마 기본값(DRAFT)으로 처리됨
- 세목이 없는 예산(목): "예산(목)을 먼저 선택하세요" 메시지 표시
- 저장 시 필수 필드 검증: Zod 스키마에 따라 검증 (저장도 필수 필드 입력 필요)
