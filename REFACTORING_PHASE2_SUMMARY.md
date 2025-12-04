# Refactoring Phase 2: Component Refactoring - 완료 보고서

## 개요

High Impact 리팩토링의 Phase 2(Component Refactoring)가 완료되었습니다. 이 단계에서는 650줄의 ExpenseForm 컴포넌트를 작은 섹션 컴포넌트들로 분할하고, react-hook-form + Zod를 통합하여 검증 로직을 개선했습니다.

## 완료된 작업

### ✅ 1. react-hook-form 및 Zod 설치

**설치된 패키지**:
- `react-hook-form`: 폼 상태 관리 및 검증
- `zod`: TypeScript-first 스키마 검증
- `@hookform/resolvers`: Zod와 react-hook-form 통합

---

### ✅ 2. Zod 스키마 생성 (`lib/schemas/expense-schema.ts`)

**목적**: 타입 안전한 폼 검증 규칙 정의

**주요 스키마**:

#### `expenseItemSchema`
```typescript
z.object({
  budgetDetail: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  unitPrice: z.number().positive().int().max(1000000000),
  quantity: z.number().positive().int().max(100000),
  amount: z.number().int().nonnegative(),
})
```

#### `expenseFormSchema`
```typescript
z.object({
  // 예산 정보 (필수)
  committee: z.string().min(1).max(50),
  department: z.string().min(1).max(50),
  budgetCategory: z.string().min(1).max(50),
  budgetSubcategory: z.string().min(1).max(50),

  // 지출일자 (선택사항)
  expenseDate: z.string().optional(),

  // 세부 항목 (1~10개)
  items: z.array(expenseItemSchema).min(1).max(10),

  // 신청 정보
  requestDate: z.string().min(1),
  requestTeam: z.string().min(1).max(50),
  applicantName: z.string().min(1).max(50),
  applicantTitle: z.string().max(50).optional(),

  // 은행 정보
  bankName: z.string().min(1).max(50),
  accountNumber: z.string().min(1).max(50).regex(/^[0-9-]+$/),
  accountHolder: z.string().min(1).max(50),
})
```

**유틸리티 함수**:
- `calculateAmount()`: 금액 자동 계산
- `calculateTotalAmount()`: 총액 계산
- `defaultExpenseItem`: 기본 항목 값
- `defaultExpenseFormData`: 기본 폼 값

**타입 추출**:
```typescript
type ExpenseItem = z.infer<typeof expenseItemSchema>
type ExpenseFormData = z.infer<typeof expenseFormSchema>
```

---

### ✅ 3. 컴포넌트 분할

#### Before (단일 파일)
```
components/ExpenseForm.tsx (650 lines)
├── 예산 선택 UI (30 lines)
├── 지출일자 UI (20 lines)
├── 세부 항목 UI (100 lines)
├── 신청 정보 UI (60 lines)
├── 은행 정보 UI (50 lines)
├── 첨부파일 UI (20 lines)
├── 상태 관리 (100 lines)
├── 검증 로직 (80 lines)
├── 폼 제출 로직 (60 lines)
└── 기타 로직 (130 lines)
```

#### After (모듈화된 구조)
```
components/
├── ExpenseForm.tsx (250 lines) - 메인 컨테이너
└── expense-form/
    ├── BudgetSection.tsx (80 lines)
    ├── ExpenseDateSection.tsx (50 lines)
    ├── ItemsSection.tsx (180 lines)
    ├── ApplicantSection.tsx (90 lines)
    └── BankSection.tsx (90 lines)

lib/schemas/
└── expense-schema.ts (120 lines) - 검증 로직
```

**라인 수 비교**:
- **Before**: 650 lines (단일 파일)
- **After**: 250 + 80 + 50 + 180 + 90 + 90 + 120 = 860 lines (7개 파일)
- **증가**: +210 lines
- **이유**: 타입 안전성, 에러 메시지, 재사용성 추가

---

### ✅ 4. BudgetSection 컴포넌트

**책임**: 예산 정보(위원회, 사역팀, 예산 항/목) 입력

**주요 기능**:
- react-hook-form의 `Controller` 사용
- BudgetSelector와 통합
- 예산(세목) 선택 시 콜백 호출
- 통합 에러 메시지 표시

**Props**:
```typescript
interface BudgetSectionProps {
  control: Control<ExpenseFormData>;
  disabled?: boolean;
  onBudgetDetailChange?: (detail: string) => void;
}
```

---

### ✅ 5. ExpenseDateSection 컴포넌트

**책임**: 지출일자 입력 (선택사항)

**주요 기능**:
- date input 필드
- Zod 검증과 통합
- 안내 문구 표시

**Props**:
```typescript
interface ExpenseDateSectionProps {
  register: UseFormRegister<ExpenseFormData>;
  errors: FieldErrors<ExpenseFormData>;
  disabled?: boolean;
}
```

---

### ✅ 6. ItemsSection 컴포넌트

**책임**: 세부 항목 목록 관리 (1~10개)

**주요 기능**:
- `useFieldArray`로 동적 항목 추가/삭제
- 단가/수량 변경 시 자동 금액 계산
- `useWatch`로 실시간 총액 계산
- 최대/최소 항목 개수 제한

**Props**:
```typescript
interface ItemsSectionProps {
  control: Control<ExpenseFormData>;
  register: UseFormRegister<ExpenseFormData>;
  setValue: UseFormSetValue<ExpenseFormData>;
  disabled?: boolean;
}
```

**로직 개선**:
```typescript
// Before: 수동 상태 관리
const [items, setItems] = useState([...]);
const handleItemChange = (index, field, value) => {
  const newItems = [...items];
  newItems[index][field] = value;
  setItems(newItems);
};

// After: react-hook-form의 useFieldArray
const { fields, append, remove } = useFieldArray({ control, name: 'items' });
const items = useWatch({ control, name: 'items' });
```

---

### ✅ 7. ApplicantSection 컴포넌트

**책임**: 신청 정보(청구일자, 청구팀, 청구인, 직책) 입력

**주요 기능**:
- register를 사용한 간단한 입력 필드
- 개별 에러 메시지 표시
- 2열 그리드 레이아웃

**Props**:
```typescript
interface ApplicantSectionProps {
  register: UseFormRegister<ExpenseFormData>;
  errors: FieldErrors<ExpenseFormData>;
  disabled?: boolean;
}
```

---

### ✅ 8. BankSection 컴포넌트

**책임**: 은행 정보(은행명, 계좌번호, 예금주) 입력

**주요 기능**:
- register를 사용한 간단한 입력 필드
- 계좌번호 정규식 검증 (숫자와 하이픈만)
- 개별 에러 메시지 표시
- 3열 그리드 레이아웃

**Props**:
```typescript
interface BankSectionProps {
  register: UseFormRegister<ExpenseFormData>;
  errors: FieldErrors<ExpenseFormData>;
  disabled?: boolean;
}
```

---

### ✅ 9. ExpenseForm 메인 컴포넌트 리팩토링

**Before (수동 검증)**:
```typescript
const [formData, setFormData] = useState<ExpenseFormData>({ ... });
const [error, setError] = useState<string | null>(null);

const validateForm = (): boolean => {
  if (!formData.committee || !formData.department || ...) {
    setError('예산 항목을 모두 선택해주세요.');
    return false;
  }
  // ... 100 lines of validation logic
  return true;
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateForm()) return;
  // submit logic
};
```

**After (react-hook-form + Zod)**:
```typescript
const {
  control,
  register,
  handleSubmit,
  setValue,
  reset,
  formState: { errors, isSubmitting },
} = useForm<ExpenseFormData>({
  resolver: zodResolver(expenseFormSchema),
  defaultValues: defaultExpenseFormData as ExpenseFormData,
});

const onSubmit = async (data: ExpenseFormData) => {
  // data는 이미 검증됨
  // submit logic
};

return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
```

**개선 사항**:
1. **검증 로직 제거**: 80줄의 수동 검증 → Zod 스키마로 자동 검증
2. **상태 관리 간소화**: useState → useForm
3. **타입 안전성**: any 타입 제거, 완전한 타입 추론
4. **에러 처리 개선**: 통합 에러 메시지 표시
5. **섹션 분리**: 5개의 섹션 컴포넌트로 분할

---

## 성능 개선

### 리렌더 최적화

**Before**:
```typescript
// formData 전체가 변경될 때마다 모든 섹션 리렌더
const [formData, setFormData] = useState({ ... });
```

**After**:
```typescript
// react-hook-form은 변경된 필드만 리렌더
// Controller, register, useWatch가 최적화됨
```

### 검증 성능

**Before**:
- 제출 시에만 검증 (80줄의 동기 코드)
- 모든 필드를 순회하며 검증

**After**:
- Zod 스키마로 빠른 검증
- 필드별 비동기 검증 지원
- 에러 캐싱으로 중복 검증 방지

---

## 타입 안전성 개선

### Before
```typescript
interface ExpenseFormData {
  committee?: string;  // undefined 허용
  items: ExpenseItem[];  // 최소/최대 개수 제한 없음
}

const handleInputChange = (field: keyof ExpenseFormData, value: any) => {
  // value가 any 타입
  setFormData({ ...formData, [field]: value });
};
```

### After
```typescript
// Zod 스키마로부터 타입 추출
type ExpenseFormData = z.infer<typeof expenseFormSchema>;

// 완전한 타입 안전성
const { register } = useForm<ExpenseFormData>({ ... });
register('committee'); // 자동완성 지원
register('unknownField'); // 컴파일 에러
```

---

## 검증 규칙 개선

### 추가된 검증

1. **문자열 길이 제한**:
   - 위원회/사역팀/예산 항목: 50자
   - 예산(세목): 100자
   - 적요: 200자

2. **숫자 범위 제한**:
   - 단가: 최대 10억원
   - 수량: 최대 100,000개
   - 금액: 음수 불가

3. **정규식 검증**:
   - 계좌번호: `^[0-9-]+$` (숫자와 하이픈만)
   - 날짜: `Date.parse()` 검증

4. **배열 길이 검증**:
   - items: 최소 1개, 최대 10개

5. **의존성 검증**:
   - 단가와 수량 변경 시 금액 자동 재계산

---

## 에러 메시지 개선

### Before
```typescript
if (!formData.committee || !formData.department || ...) {
  setError('예산 항목을 모두 선택해주세요.');
  return false;
}
```
- 하나의 일반적인 에러 메시지
- 어떤 필드가 문제인지 명확하지 않음

### After
```typescript
// Zod가 자동으로 구체적인 에러 메시지 생성
committee: z.string().min(1, '위원회를 선택해주세요.'),
department: z.string().min(1, '사역팀(부)을 선택해주세요.'),
```
- 각 필드별 구체적인 에러 메시지
- 필드 옆에 에러 표시
- 폼 상단에 에러 요약 표시

---

## 코드 품질 개선

### 재사용성

**Before**:
- 모든 로직이 한 파일에 집중
- 다른 폼에서 재사용 불가

**After**:
- 섹션 컴포넌트를 다른 폼에서 재사용 가능
- Zod 스키마를 API 검증에도 사용 가능
- 유틸리티 함수 분리

### 테스트 용이성

**Before**:
```typescript
// 650줄의 컴포넌트를 한 번에 테스트
test('ExpenseForm validation', () => {
  // 복잡한 테스트 설정
});
```

**After**:
```typescript
// 각 섹션을 독립적으로 테스트
test('BudgetSection renders correctly', () => { ... });
test('ItemsSection calculates amount correctly', () => { ... });
test('expenseFormSchema validates correctly', () => { ... });
```

### 유지보수성

**단일 책임 원칙 (SRP) 적용**:
- BudgetSection: 예산 정보만 담당
- ItemsSection: 세부 항목만 담당
- ApplicantSection: 신청 정보만 담당
- BankSection: 은행 정보만 담당
- ExpenseForm: 전체 조율만 담당

---

## 마이그레이션 가이드

### 1. Zod 스키마 사용
```typescript
import { expenseFormSchema, ExpenseFormData } from '@/lib/schemas/expense-schema';

// 폼 검증
const result = expenseFormSchema.safeParse(data);
if (result.success) {
  // data는 ExpenseFormData 타입
}
```

### 2. react-hook-form 사용
```typescript
const { control, register, handleSubmit, setValue } = useForm<ExpenseFormData>({
  resolver: zodResolver(expenseFormSchema),
  defaultValues: defaultExpenseFormData,
});
```

### 3. 섹션 컴포넌트 사용
```typescript
import BudgetSection from './expense-form/BudgetSection';

<BudgetSection
  control={control}
  disabled={loading}
  onBudgetDetailChange={handleBudgetDetailChange}
/>
```

---

## 브레이킹 체인지

**없음** - 기존 API와 동작은 동일합니다.

단, 다음 파일이 백업되었습니다:
- `components/ExpenseForm.old.tsx` - 이전 버전 (필요 시 참조 가능)

---

## 다음 단계 (Phase 3)

### Phase 3: API Route Refactoring
- [ ] 모든 API 라우트에 새로운 에러 핸들러 적용
- [ ] ID 검증 유틸리티 적용
- [ ] 파일 검증 상수 적용
- [ ] Zod 스키마를 API 검증에 활용

### Phase 4: UI/UX Improvements
- [ ] Toast 알림 시스템 추가 (alert 대체)
- [ ] 폼 저장 진행 상태 표시
- [ ] 에러 바운더리 추가
- [ ] 로딩 스켈레톤 UI

---

## 결론

Phase 2 리팩토링을 통해 다음 목표를 달성했습니다:

✅ **컴포넌트 분할** (650줄 → 7개 파일)
✅ **react-hook-form 통합** (80줄 검증 로직 제거)
✅ **Zod 스키마 검증** (타입 안전 검증)
✅ **타입 안전성 향상** (any 타입 제거)
✅ **에러 메시지 개선** (필드별 구체적 메시지)
✅ **재사용성 향상** (섹션 컴포넌트 분리)
✅ **테스트 용이성 개선** (단위 테스트 가능)
✅ **유지보수성 향상** (단일 책임 원칙)

Phase 1 + Phase 2를 통해 전체 High Impact 리팩토링의 약 60%가 완료되었습니다.
