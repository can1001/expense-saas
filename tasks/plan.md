# 간편 지출결의서 개선 구현 계획

## 현재 상태 분석

### 이미 구현된 기능
| 기능 | 상태 | 위치 |
|------|------|------|
| 세목 검색 | ✅ 구현됨 | `ItemBudgetSelector.tsx` (searchTerm) |
| 즐겨찾기 | ✅ 구현됨 | `useBudgetPreferences` 훅 |
| 최근 사용 | ✅ 구현됨 | `useBudgetPreferences` 훅 |
| 은행 계좌 입력 | ✅ 구현됨 | `BankAccountSelector.tsx` |
| 첨부파일 업로드 | ✅ 구현됨 | `FileUpload.tsx` |

### 미구현 기능
| 기능 | 우선순위 | 복잡도 |
|------|----------|--------|
| 2단계 마법사 UI | 높음 | 중 |
| 저장된 은행 계좌 | 높음 | 중 |
| ExpenseTemplate | 중간 | 높음 |
| 모바일 터치 최적화 | 중간 | 낮음 |

---

## 의존성 그래프

```
                    ┌─────────────────────────┐
                    │  Prisma Schema 변경     │
                    │  (SavedBankAccount,     │
                    │   ExpenseTemplate)      │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
┌───────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ 저장 계좌 API     │ │ 템플릿 API      │ │ 2단계 마법사 UI     │
│ /api/saved-      │ │ /api/expense-   │ │ SimpleExpenseWizard │
│ accounts         │ │ templates       │ │                     │
└────────┬──────────┘ └────────┬────────┘ └──────────┬──────────┘
         │                     │                      │
         ▼                     ▼                      ▼
┌────────────────────────────────────────────────────────────────┐
│                    통합 (SimpleExpenseForm 개선)               │
│  - SavedAccountSelector 컴포넌트                               │
│  - TemplateManager 컴포넌트                                    │
│  - 마법사 통합                                                 │
└────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│                    모바일 최적화                                │
│  - inputmode="numeric"                                         │
│  - 터치 타겟 48px                                              │
│  - 스와이프 네비게이션                                         │
└────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: 저장된 은행 계좌 (Vertical Slice 1)

### 목표
사용자가 자주 사용하는 은행 계좌를 저장하고 빠르게 선택

### 태스크

#### 1.1 DB 스키마 추가
**파일**: `prisma/schema.prisma`
```prisma
model SavedBankAccount {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  bankName      String
  accountNumber String
  accountHolder String
  isDefault     Boolean  @default(false)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, accountNumber])
  @@index([userId])
}
```

#### 1.2 API 엔드포인트
**파일**: `app/api/saved-accounts/route.ts`
- GET: 사용자 저장 계좌 목록
- POST: 새 계좌 저장

**파일**: `app/api/saved-accounts/[id]/route.ts`
- PUT: 계좌 수정
- DELETE: 계좌 삭제

#### 1.3 컴포넌트
**파일**: `components/expense-form/SavedAccountSelector.tsx`
- 저장된 계좌 목록 표시
- 계좌 선택 시 폼 자동 채움
- "현재 계좌 저장" 버튼

#### 1.4 폼 통합
**파일**: `components/SimpleExpenseForm.tsx`
- BankAccountSelector를 SavedAccountSelector로 교체

### 수락 기준
- [ ] 저장된 계좌 목록 표시
- [ ] 계좌 선택 시 자동 채움
- [ ] 새 계좌 저장 가능
- [ ] 기본 계좌 설정 가능

---

## Phase 2: 2단계 마법사 UI (Vertical Slice 2)

### 목표
복잡한 폼을 2단계로 분리하여 인지 부하 감소

### 태스크

#### 2.1 마법사 컨테이너
**파일**: `components/simple-expense-form/SimpleExpenseWizard.tsx`
```typescript
interface WizardStep {
  id: string;
  title: string;
  component: React.ReactNode;
}

// Step 1: 예산 + 금액 + 적요
// Step 2: 청구 정보 + 은행 계좌 + 첨부파일
```

#### 2.2 스텝 컴포넌트 분리
**파일**: `components/simple-expense-form/WizardStep1.tsx`
- 예산 항목 선택 (기존 ItemBudgetSelector)
- 금액 입력
- 적요 입력

**파일**: `components/simple-expense-form/WizardStep2.tsx`
- 청구 정보 (날짜, 청구인)
- 은행 계좌 (SavedAccountSelector)
- 첨부파일

#### 2.3 마법사 네비게이션
- 이전/다음 버튼
- 스텝 인디케이터 (1/2, 2/2)
- 스와이프 제스처 (react-swipeable)

### 수락 기준
- [ ] 2단계 폼 분리
- [ ] 이전/다음 네비게이션
- [ ] 각 단계 유효성 검증
- [ ] 스와이프로 단계 이동 (모바일)

---

## Phase 3: 모바일 최적화 (Vertical Slice 3)

### 목표
모바일에서 한 손으로 빠르게 입력 가능

### 태스크

#### 3.1 숫자 입력 최적화
**파일**: `components/simple-expense-form/AmountInput.tsx`
- `inputmode="numeric"` 적용
- 천 단위 콤마 포맷팅
- 큰 터치 타겟 (48px)

#### 3.2 터치 타겟 확대
**파일**: 관련 컴포넌트들
- 버튼 최소 높이 48px
- 탭 가능한 영역 확대
- 간격 조정

#### 3.3 하단 고정 버튼
**파일**: `components/simple-expense-form/WizardNavigation.tsx`
- 하단 고정 (sticky)
- 진행 상태 표시

### 수락 기준
- [ ] 숫자 키패드 자동 표시
- [ ] 터치 타겟 48px 이상
- [ ] 하단 고정 버튼
- [ ] 스와이프 네비게이션

---

## Phase 4: 템플릿 기능 (Vertical Slice 4)

### 목표
자주 사용하는 지출 패턴을 템플릿으로 저장/재사용

### 태스크

#### 4.1 DB 스키마
**파일**: `prisma/schema.prisma`
```prisma
model ExpenseTemplate {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name              String
  budgetCategory    String
  budgetSubcategory String
  budgetDetail      String
  description       String?
  defaultAmount     Int?

  usageCount        Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([userId, usageCount])
}
```

#### 4.2 API 엔드포인트
**파일**: `app/api/expense-templates/route.ts`
- GET: 템플릿 목록 (usageCount 순)
- POST: 템플릿 생성

**파일**: `app/api/expense-templates/[id]/route.ts`
- PUT: 템플릿 수정
- DELETE: 템플릿 삭제

#### 4.3 컴포넌트
**파일**: `components/simple-expense-form/TemplateSelector.tsx`
- 템플릿 목록 표시
- 템플릿 선택 시 폼 자동 채움

**파일**: `components/simple-expense-form/SaveTemplateModal.tsx`
- 작성 완료 후 템플릿 저장 모달

### 수락 기준
- [ ] 템플릿 저장 가능
- [ ] 템플릿에서 폼 자동 채움
- [ ] 사용자별 최대 20개 제한
- [ ] 템플릿 편집/삭제

---

## 검증 체크포인트

### Phase 1 완료 후
1. 저장된 계좌 CRUD 동작 확인
2. 기존 폼과 통합 확인
3. 단위 테스트 통과

### Phase 2 완료 후
1. 2단계 폼 흐름 확인
2. 유효성 검증 확인
3. 모바일/데스크톱 반응형 확인

### Phase 3 완료 후
1. 모바일에서 숫자 키패드 확인
2. 터치 타겟 크기 측정
3. 스와이프 동작 확인

### Phase 4 완료 후
1. 템플릿 CRUD 동작 확인
2. 사용 횟수 정렬 확인
3. 제한 (20개) 확인

---

## 리스크 및 고려사항

1. **기존 데이터 호환성**: 마이그레이션 시 기존 지출결의서 영향 없음
2. **성능**: 템플릿/계좌 조회 시 인덱스 활용
3. **보안**: 사용자별 데이터 격리 (userId 필수)
4. **UX**: 기존 단일 폼도 옵션으로 유지 가능

---

## 예상 변경 파일

| Phase | 신규 | 수정 |
|-------|------|------|
| 1 | 3 | 2 |
| 2 | 4 | 1 |
| 3 | 2 | 3 |
| 4 | 4 | 2 |
| **합계** | **13** | **8** |
