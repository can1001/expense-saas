# 템플릿 UI 구현 계획 (Phase 4 잔여 작업)

## 현재 상태 (2026-05-04 업데이트)

### 완료된 기능
| 기능 | 상태 | 위치 |
|------|------|------|
| Phase 1: 저장된 은행 계좌 | ✅ 완료 | `SavedBankAccount`, `BankAccountSelector` |
| Phase 2: 2단계 마법사 UI | ✅ 완료 | `SimpleExpenseWizard`, `WizardStep1/2` |
| Phase 3: 모바일 최적화 | ✅ 완료 | 터치 타겟 48px, inputmode, 스와이프 |
| Phase 4: 템플릿 API | ✅ 완료 | `/api/expense-templates` CRUD |

### 남은 작업 (Phase 4 UI)
| 기능 | 우선순위 | 복잡도 |
|------|----------|--------|
| TemplateSelector 컴포넌트 | 높음 | 중 |
| SaveTemplateModal 컴포넌트 | 높음 | 낮음 |
| 폼 통합 | 높음 | 낮음 |

---

## 의존성 그래프

```
                    ┌─────────────────────┐
                    │  ExpenseTemplate    │
                    │     API (완료)      │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ TemplateSelector│ │SaveTemplateModal│ │  useTemplates   │
    │   (불러오기)    │ │   (저장하기)    │ │    (훅)         │
    └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │   WizardStep1.tsx   │
                    │    (통합 지점)      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │SimpleExpenseWizard  │
                    │ (제출 후 저장 유도) │
                    └─────────────────────┘
```

---

## Phase 4: 템플릿 UI (남은 작업)

### 목표
템플릿 API와 연동하는 UI 컴포넌트 구현

---

## 구현 순서 (수직 슬라이스)

### Slice 1: 템플릿 불러오기 (전체 경로)
1. `useTemplates` 훅 생성 (API 호출 추상화)
2. `TemplateSelector` 컴포넌트 생성
3. `WizardStep1`에 통합
4. 테스트: 템플릿 선택 → 폼 자동 채움

### Slice 2: 템플릿 저장하기 (전체 경로)
1. `SaveTemplateModal` 컴포넌트 생성
2. `SimpleExpenseWizard`에 통합 (제출 성공 후)
3. 테스트: 제출 → 저장 모달 → 템플릿 생성

---

## Task 4.4: useTemplates 훅

**파일**: `lib/hooks/useTemplates.ts`

```typescript
interface UseTemplatesReturn {
  templates: ExpenseTemplate[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  useTemplate: (id: string) => Promise<ExpenseTemplate>;
  saveTemplate: (data: CreateTemplateData) => Promise<void>;
}
```

**수락 기준**:
- [ ] GET `/api/expense-templates` 호출
- [ ] POST `/api/expense-templates/[id]` (use) 호출로 usageCount 증가
- [ ] POST `/api/expense-templates` (create) 호출
- [ ] 에러 핸들링

**검증**: 단위 테스트 통과

---

## Task 4.5: TemplateSelector 컴포넌트

**파일**: `components/simple-expense-form/TemplateSelector.tsx`

**UI**:
```
┌────────────────────────────────────────────┐
│  📋 템플릿에서 불러오기                     │
├────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 회의비   │ │ 교통비   │ │ 도서구입 │   │
│  │ (5회)    │ │ (3회)    │ │ (2회)    │   │
│  └──────────┘ └──────────┘ └──────────┘   │
│                                    [더보기]│
└────────────────────────────────────────────┘
```

**Props**:
```typescript
interface TemplateSelectorProps {
  onSelect: (template: ExpenseTemplate) => void;
  disabled?: boolean;
}
```

**수락 기준**:
- [ ] 템플릿 목록 칩 형태로 표시 (최대 6개)
- [ ] 사용 횟수 표시
- [ ] 클릭 시 `onSelect` 콜백 호출
- [ ] "더보기" 클릭 시 전체 목록 모달
- [ ] 로딩/빈 상태 처리
- [ ] 터치 타겟 48px

**검증**: 컴포넌트 테스트

---

## Task 4.6: WizardStep1에 TemplateSelector 통합

**파일**: `components/simple-expense-form/WizardStep1.tsx`

**변경**:
```tsx
// 안내 문구 아래에 추가
<TemplateSelector
  onSelect={handleTemplateSelect}
  disabled={disabled}
/>
```

**수락 기준**:
- [ ] 안내 문구 아래에 TemplateSelector 표시
- [ ] 템플릿 선택 시 첫 번째 항목에 값 채움
- [ ] 기존 입력값 있으면 덮어쓰기 확인

**검증**: 템플릿 선택 → 폼 채움 동작 확인

---

## Task 4.7: SaveTemplateModal 컴포넌트

**파일**: `components/simple-expense-form/SaveTemplateModal.tsx`

**UI**:
```
┌────────────────────────────────────────────┐
│  📋 템플릿으로 저장                         │
├────────────────────────────────────────────┤
│  템플릿 이름                               │
│  ┌────────────────────────────────────┐   │
│  │ 월례 회의비                        │   │
│  └────────────────────────────────────┘   │
│                                            │
│  저장할 항목: 사무행정비 > 회의비 > 다과비 │
├────────────────────────────────────────────┤
│           [취소]        [저장하기]          │
└────────────────────────────────────────────┘
```

**수락 기준**:
- [ ] 모달 열기/닫기
- [ ] 템플릿 이름 입력 (필수, 최대 50자)
- [ ] 저장 성공 시 토스트 메시지
- [ ] 최대 20개 제한 시 안내

**검증**: 컴포넌트 테스트

---

## Task 4.8: SimpleExpenseWizard에 저장 유도 통합

**파일**: `components/simple-expense-form/SimpleExpenseWizard.tsx`

**변경**:
- 제출 성공 후 "템플릿으로 저장하시겠습니까?" 모달 표시
- 첫 번째 항목 기준으로 템플릿 데이터 생성

**수락 기준**:
- [ ] 제출 성공 후 저장 유도 모달 표시
- [ ] "저장하기" 클릭 시 SaveTemplateModal 열기
- [ ] "다음에" 클릭 시 바로 목록으로 이동

**검증**: 제출 → 저장 유도 → 템플릿 생성 흐름 확인

---

## Checkpoint

### 기능 테스트
- [ ] 템플릿 불러오기 → 폼 채움 → 제출 → 성공
- [ ] 새 작성 → 제출 → 템플릿 저장 → 다음 작성 시 불러오기
- [ ] usageCount 정렬 (자주 쓰는 것 먼저)

### 회귀 테스트
- [ ] 템플릿 없이 기존 방식으로 작성 가능
- [ ] 모바일/데스크톱 반응형 동작

---

## 파일 목록

| 파일 | 유형 | 설명 |
|-----|-----|-----|
| `lib/hooks/useTemplates.ts` | 신규 | 템플릿 API 훅 |
| `components/simple-expense-form/TemplateSelector.tsx` | 신규 | 템플릿 선택 UI |
| `components/simple-expense-form/SaveTemplateModal.tsx` | 신규 | 템플릿 저장 모달 |
| `components/simple-expense-form/WizardStep1.tsx` | 수정 | TemplateSelector 통합 |
| `components/simple-expense-form/SimpleExpenseWizard.tsx` | 수정 | 저장 유도 통합 |

---

## 예상 작업량

| Task | 설명 | 신규/수정 |
|------|------|----------|
| 4.4 | useTemplates 훅 | 신규 |
| 4.5 | TemplateSelector 컴포넌트 | 신규 |
| 4.6 | WizardStep1 통합 | 수정 |
| 4.7 | SaveTemplateModal 컴포넌트 | 신규 |
| 4.8 | SimpleExpenseWizard 통합 | 수정 |
| **Total** | | **5 tasks** |
