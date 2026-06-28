# 간편 지출결의서 개선 명세서

## 1. 목표 (Objective)

### 배경
현재 간편 지출결의서(`/expenses/simple`)는 위원회/사역팀 선택 없이 항목별로 예산을 직접 선택하는 방식이지만, 여전히 입력 과정이 복잡하고 모바일에서의 사용성이 떨어짐.

### 목표
1. **예산 항목 선택 간소화**: 항/목/세목 3단계 선택을 1~2단계로 줄임
2. **입력 필드 최소화**: 필수 입력만 남기고 선택 입력은 숨김/확장 방식
3. **모바일 최적화**: 한 손으로 빠르게 입력 가능한 UI
4. **자주 쓰는 항목 저장**: 반복 사용 패턴을 템플릿으로 저장/재사용

### 대상 사용자
- 소액 지출을 자주 청구하는 일반 사용자
- 모바일에서 빠르게 지출을 등록하고 싶은 사용자
- IT에 익숙하지 않은 사용자

### 성공 기준
- 지출결의서 작성 시간 50% 단축 (목표: 2분 이내)
- 모바일 작성 완료율 80% 이상
- 사용자 만족도 향상

---

## 2. 핵심 기능 (Core Features)

### 2.1 예산 항목 선택 간소화

#### 현재 문제
- 항 → 목 → 세목 3단계 순차 선택 필요
- 각 단계마다 드롭다운 클릭 필요
- 총 6번 이상의 클릭/탭 필요

#### 개선안
**A. 통합 검색 방식 (권장)**
```
[🔍 예산 항목 검색...]  ← 한 번에 검색
예: "교통비" 입력 → 관련 세목 목록 표시
```

**B. 자주 사용하는 항목 표시**
```
최근 사용:
[교통비] [회의비] [도서구입비]

즐겨찾기:
⭐ 청년부 아웃팅비
⭐ 선교팀 출장비
```

#### 수락 기준
- [ ] 예산 항목을 검색어로 한 번에 찾을 수 있음
- [ ] 최근 사용 항목 5개 표시
- [ ] 즐겨찾기 항목 저장/관리 가능
- [ ] 기존 3단계 선택도 옵션으로 유지

---

### 2.2 입력 필드 최소화

#### 현재 필드 (총 10개)
| 필드 | 필수 | 비고 |
|------|------|------|
| 청구일자 | O | 기본값: 오늘 |
| 지출일자 | X | 선택 |
| 청구인 | O | 자동 채움 |
| 은행명 | O | |
| 계좌번호 | O | |
| 예금주 | O | |
| 예산(항/목/세목) | O | 3개 필드 |
| 적요 | O | |
| 단가 | O | |
| 수량 | O | 기본값: 1 |

#### 개선안: 2단계 입력
**Step 1: 필수 정보 (화면 1)**
```
┌─────────────────────────────────┐
│  어떤 항목에 청구하시나요?      │
│  [🔍 예산 항목 검색...]         │
│                                 │
│  최근 사용: [교통비] [회의비]   │
├─────────────────────────────────┤
│  얼마를 청구하시나요?           │
│  [          ] 원                │
│                                 │
│  무엇에 사용했나요? (적요)      │
│  [                        ]     │
└─────────────────────────────────┘
         [다음 →]
```

**Step 2: 은행 정보 (화면 2)**
```
┌─────────────────────────────────┐
│  입금받을 계좌                  │
│  ┌─────────────────────────┐   │
│  │ 저장된 계좌 사용         │   │
│  │ ○ 국민 123-456-7890     │   │
│  │ ○ 새 계좌 입력          │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
    [← 이전]    [제출하기]
```

#### 수락 기준
- [ ] 2단계 마법사 형태로 입력 흐름 단순화
- [ ] 청구일자는 자동(오늘), 수량은 기본값 1
- [ ] 저장된 은행 계좌 자동 선택
- [ ] 단가만 입력하면 금액 자동 계산

---

### 2.3 모바일 최적화

#### 현재 문제
- 데스크톱 폼을 그대로 사용
- 작은 터치 타겟
- 키보드 전환 불편 (숫자 ↔ 텍스트)

#### 개선안
```
┌──────────────────────────────┐
│ ← 간편 지출결의서            │
├──────────────────────────────┤
│                              │
│ ┌──────────────────────────┐ │
│ │ 🔍 예산 항목 검색        │ │ ← 큰 터치 영역
│ └──────────────────────────┘ │
│                              │
│ 최근 사용                    │
│ ┌────────┐ ┌────────┐       │
│ │ 교통비 │ │ 회의비 │       │ ← 칩 형태
│ └────────┘ └────────┘       │
│                              │
│ ┌──────────────────────────┐ │
│ │ ₩                    원  │ │ ← 숫자 키패드 자동
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 적요 입력...             │ │
│ └──────────────────────────┘ │
│                              │
├──────────────────────────────┤
│     [ 다음 (1/2) ]           │ ← 고정 하단 버튼
└──────────────────────────────┘
```

#### 수락 기준
- [ ] 터치 타겟 최소 48px × 48px
- [ ] 숫자 입력 시 숫자 키패드 자동 표시 (`inputmode="numeric"`)
- [ ] 스와이프로 이전/다음 단계 이동
- [ ] 하단 고정 버튼으로 다음 단계 진행
- [ ] 로딩/제출 중 상태 명확히 표시

---

### 2.4 자주 쓰는 항목 저장 (템플릿)

#### 기능 설명
자주 반복하는 지출 패턴을 템플릿으로 저장하여 재사용

#### 데이터 모델
```typescript
interface ExpenseTemplate {
  id: string;
  userId: string;
  name: string;           // "월례 회의비", "출장 교통비"
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
  description?: string;   // 기본 적요
  defaultAmount?: number; // 기본 금액
  usageCount: number;     // 사용 횟수 (정렬용)
  createdAt: Date;
  updatedAt: Date;
}
```

#### UI 흐름
1. **템플릿 저장**: 작성 완료 후 "템플릿으로 저장" 버튼
2. **템플릿 사용**: 새 작성 시 "템플릿에서 불러오기" 버튼
3. **템플릿 관리**: 마이페이지 또는 설정에서 편집/삭제

#### 수락 기준
- [ ] 완료된 지출결의서를 템플릿으로 저장 가능
- [ ] 템플릿 이름 지정 가능
- [ ] 템플릿에서 새 지출결의서 생성 가능
- [ ] 사용자별 최대 20개 템플릿 저장
- [ ] 템플릿 편집/삭제 가능

---

## 3. 기술 구현 (Technical Implementation)

### 3.1 프로젝트 구조
```
components/
  simple-expense-form/
    SimpleExpenseWizard.tsx     # 2단계 마법사 컨테이너
    BudgetSearchInput.tsx       # 통합 예산 검색
    RecentBudgetChips.tsx       # 최근/즐겨찾기 항목
    AmountInput.tsx             # 금액 입력 (숫자 키패드)
    SavedAccountSelector.tsx    # 저장된 계좌 선택
    TemplateManager.tsx         # 템플릿 관리

lib/
  schemas/
    expense-template-schema.ts  # 템플릿 스키마

app/
  api/
    expense-templates/
      route.ts                  # GET, POST
      [id]/
        route.ts                # PUT, DELETE
    budget/
      search/
        route.ts                # 예산 항목 통합 검색

prisma/
  schema.prisma                 # ExpenseTemplate 모델 추가
```

### 3.2 API 엔드포인트

#### 예산 항목 검색
```
GET /api/budget/search?q={keyword}&limit=10
Response: {
  items: [
    {
      id: string,
      category: string,
      subcategory: string,
      detail: string,
      fullPath: "사무행정비 > 회의비 > 다과비"
    }
  ],
  recent: [...],   // 사용자 최근 사용
  favorites: [...] // 사용자 즐겨찾기
}
```

#### 템플릿 CRUD
```
GET    /api/expense-templates          # 목록 조회
POST   /api/expense-templates          # 생성
PUT    /api/expense-templates/:id      # 수정
DELETE /api/expense-templates/:id      # 삭제
```

### 3.3 데이터베이스 변경

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

model BudgetFavorite {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  budgetDetailId  String
  budgetDetail    BudgetDetail @relation(fields: [budgetDetailId], references: [id])
  createdAt       DateTime @default(now())

  @@unique([userId, budgetDetailId])
}
```

---

## 4. 테스트 전략 (Testing Strategy)

### 단위 테스트
- `BudgetSearchInput`: 검색어 입력, 결과 표시, 선택 동작
- `AmountInput`: 숫자 입력, 포맷팅, 계산
- `TemplateManager`: CRUD 동작

### 통합 테스트
- `/api/budget/search`: 검색 API 응답 검증
- `/api/expense-templates`: CRUD API 검증

### E2E 테스트
- 전체 작성 흐름 (검색 → 금액 입력 → 계좌 선택 → 제출)
- 템플릿 저장 및 불러오기
- 모바일 뷰포트에서의 동작

---

## 5. 경계 조건 (Boundaries)

### 항상 해야 할 것 (Always)
- 기존 일반 지출결의서 기능은 그대로 유지
- 기존 간편 지출결의서 데이터 호환성 유지
- 사용자 데이터(템플릿, 즐겨찾기) 안전하게 보호

### 먼저 물어볼 것 (Ask First)
- 기존 UI 레이아웃 대폭 변경 시
- 새로운 권한/역할 추가 시
- 데이터 마이그레이션 필요 시

### 절대 하지 말 것 (Never)
- 기존 지출결의서 데이터 삭제/손상
- 사용자 동의 없이 개인 정보 노출
- 결재 프로세스 우회

---

## 6. 구현 우선순위

### Phase 1: 핵심 개선 (1주)
1. 예산 항목 통합 검색 API
2. 최근 사용 항목 표시
3. 2단계 마법사 UI

### Phase 2: 모바일 최적화 (1주)
4. 모바일 전용 UI 개선
5. 터치 최적화
6. 숫자 키패드 연동

### Phase 3: 템플릿 기능 (1주)
7. 템플릿 저장/불러오기
8. 즐겨찾기 기능
9. 템플릿 관리 UI

---

## 7. 검증 체크리스트

- [ ] 지출결의서 작성 시간 측정 (목표: 2분 이내)
- [ ] 모바일에서 전체 흐름 테스트
- [ ] 기존 데이터와의 호환성 확인
- [ ] 결재 프로세스 정상 동작 확인
- [ ] 성능 테스트 (검색 응답 시간 < 200ms)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2026-05-04 | 초안 작성 |
