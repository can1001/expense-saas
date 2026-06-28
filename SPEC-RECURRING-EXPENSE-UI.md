# 자동이체 UI 구현 스펙

## 1. 목표 (Objective)

### 개요
재정팀 전담자가 정기적으로 발생하는 자동이체 지출을 등록하고 관리할 수 있는 UI를 구현합니다.

### 대상 사용자
- **Primary**: 재정팀 전담자 (finance_head, accountant, finance_member)
- 자동이체 템플릿 등록, 수정, 삭제, 일시정지/재개 관리
- 자동 생성된 지출결의서 현황 확인

### 핵심 가치
1. **효율성**: 반복 작업 최소화로 재정팀 업무 부담 감소
2. **투명성**: 자동이체 현황 및 생성 이력 명확하게 파악
3. **일관성**: 기존 지출결의서 UI와 동일한 사용 경험

---

## 2. 기능 요구사항 (Features)

### 2.1 자동이체 목록 페이지 (`/recurring-expenses`)

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 목록 조회 | 등록된 자동이체 템플릿 목록 표시 | P0 |
| 상태 필터 | ACTIVE/PAUSED/COMPLETED/CANCELLED 필터링 | P0 |
| 검색 | 이름, 수취인으로 검색 | P1 |
| 페이지네이션 | 무한 스크롤 또는 페이지 번호 | P0 |
| 신규 등록 | 자동이체 등록 페이지 이동 | P0 |

**목록 항목 표시 정보**:
- 자동이체 이름
- 수취인명
- 기본 금액 (원 단위, 3자리 콤마)
- 주기 (월간/분기/반기/연간)
- 이체일 (매월 N일)
- 다음 생성일
- 상태 배지 (활성/일시정지/완료/취소)
- 최근 생성 지출결의서 수

### 2.2 자동이체 등록/수정 페이지 (`/recurring-expenses/new`, `/recurring-expenses/[id]/edit`)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | text | Y | 자동이체 이름 |
| description | textarea | N | 설명 |
| committee | select | Y | 위원회 (BudgetSelector 연동) |
| department | select | Y | 사역팀/부 (BudgetSelector 연동) |
| budgetCategory | select | Y | 예산(항) |
| budgetSubcategory | select | Y | 예산(목) |
| budgetDetail | select | Y | 예산(세목) |
| recipientName | text | Y | 수취인 이름 |
| bankName | select | Y | 은행명 |
| accountNumber | text | Y | 계좌번호 |
| baseAmount | number | Y | 기본 금액 |
| frequency | select | Y | 주기 (MONTHLY/QUARTERLY/SEMI_ANNUAL/ANNUAL) |
| dayOfMonth | number | Y | 이체일 (1-28) |
| startDate | date | Y | 시작일 |
| endDate | date | N | 종료일 (선택) |
| advanceDays | number | Y | 사전 생성일 (기본: 7일) |

**Acceptance Criteria**:
- [ ] BudgetSelector 컴포넌트로 5단계 예산 항목 선택
- [ ] 이체일은 1-28일만 선택 가능 (월말 일자 문제 방지)
- [ ] 기본 금액 입력 시 자동 콤마 포맷
- [ ] 저장 시 다음 생성일 자동 계산
- [ ] 수정 시 기존 데이터 로드

### 2.3 자동이체 상세 페이지 (`/recurring-expenses/[id]`)

| 섹션 | 내용 |
|------|------|
| 기본 정보 | 이름, 설명, 예산 항목, 수취인, 은행 정보 |
| 주기 설정 | 주기, 이체일, 사전 생성일, 시작/종료일 |
| 상태 관리 | 현재 상태, 일시정지/재개/취소 버튼 |
| 생성 현황 | 다음 생성 예정일, 마지막 생성일 |
| 생성 이력 | 자동 생성된 지출결의서 목록 (최근 10건) |

**액션 버튼**:
- 수정: 수정 페이지로 이동 (ACTIVE/PAUSED만)
- 일시정지: ACTIVE → PAUSED (확인 다이얼로그)
- 재개: PAUSED → ACTIVE
- 취소: → CANCELLED (확인 다이얼로그, 되돌릴 수 없음 경고)
- 즉시 생성: 다음 생성일 전에 수동 생성 (선택 기능, P2)

### 2.4 생성 이력 조회

**생성된 지출결의서 항목 표시**:
- 생성 일시
- 청구 금액
- 상태 (DRAFT/PENDING/APPROVED/REJECTED 등)
- 지출결의서 상세 링크

---

## 3. 프로젝트 구조 (Project Structure)

```
app/
├── recurring-expenses/
│   ├── page.tsx                    # 목록 페이지
│   ├── new/
│   │   └── page.tsx                # 등록 페이지
│   └── [id]/
│       ├── page.tsx                # 상세 페이지
│       └── edit/
│           └── page.tsx            # 수정 페이지

components/
├── recurring-expense/
│   ├── RecurringExpenseList.tsx    # 목록 컴포넌트
│   ├── RecurringExpenseCard.tsx    # 목록 카드 항목
│   ├── RecurringExpenseForm.tsx    # 등록/수정 폼
│   ├── RecurringExpenseDetail.tsx  # 상세 정보 표시
│   ├── RecurringExpenseStatus.tsx  # 상태 배지
│   ├── FrequencySelector.tsx       # 주기 선택
│   ├── DayOfMonthInput.tsx         # 이체일 입력
│   └── GeneratedExpenseList.tsx    # 생성된 지출결의서 목록

hooks/
├── useRecurringExpenses.ts         # 목록 조회 훅
├── useRecurringExpense.ts          # 단일 조회 훅
└── useRecurringExpenseMutation.ts  # 생성/수정/삭제 훅
```

---

## 4. 코드 스타일 (Code Style)

### 컴포넌트 패턴
```tsx
// 기존 지출결의서 컴포넌트와 동일한 패턴 사용
// - React Hook Form + Zod 검증
// - BudgetSelector 재사용
// - Tailwind CSS 스타일링
// - 한글 라벨 및 메시지

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRecurringExpenseSchema } from '@/lib/recurring-expense';
```

### API 호출 패턴
```tsx
// 기존 패턴 유지
const response = await fetch('/api/recurring-expenses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error);
}
```

### 상태 관리
- Server State: fetch + SWR 또는 직접 fetch
- Form State: React Hook Form
- Local State: useState (최소화)

---

## 5. 테스트 전략 (Testing Strategy)

### 단위 테스트
| 대상 | 테스트 내용 |
|------|-------------|
| FrequencySelector | 주기 선택 및 라벨 표시 |
| DayOfMonthInput | 1-28 범위 제한 |
| RecurringExpenseStatus | 상태별 배지 렌더링 |
| RecurringExpenseCard | 정보 표시 및 클릭 이벤트 |

### 통합 테스트
| 시나리오 | 테스트 내용 |
|----------|-------------|
| 등록 플로우 | 폼 입력 → 검증 → API 호출 → 목록 반영 |
| 수정 플로우 | 기존 데이터 로드 → 수정 → 저장 |
| 상태 변경 | 일시정지/재개/취소 액션 |
| 목록 필터 | 상태별 필터링 동작 |

### 테스트 커버리지 목표
- 컴포넌트: 80% 이상
- 훅: 90% 이상

---

## 6. 경계 (Boundaries)

### 항상 해야 할 것 (Always)
- 기존 지출결의서 UI 패턴 및 스타일 따르기
- BudgetSelector 컴포넌트 재사용
- 한글 라벨 및 에러 메시지 사용
- 권한 체크 (재정팀 전용)
- 확인 다이얼로그로 위험 작업 보호

### 확인 후 진행 (Ask First)
- 새로운 공통 컴포넌트 추가
- API 응답 구조 변경
- 상태 전이 규칙 변경

### 절대 하지 말 것 (Never)
- 예산 항목 하드코딩
- 인라인 스타일 사용
- console.log 남기기
- 테스트 없이 커밋
- 취소된 자동이체 복구 기능

---

## 7. API 엔드포인트 (이미 구현됨)

```
GET    /api/recurring-expenses           # 목록 조회
POST   /api/recurring-expenses           # 등록
GET    /api/recurring-expenses/:id       # 상세 조회
PUT    /api/recurring-expenses/:id       # 수정
DELETE /api/recurring-expenses/:id       # 취소 (소프트 삭제)
POST   /api/recurring-expenses/process   # 일괄 생성 (크론잡용)
```

---

## 8. 구현 순서 (Phase)

### Phase 1: 기본 CRUD
- [ ] 목록 페이지 구현
- [ ] 등록 폼 구현
- [ ] 상세 페이지 구현
- [ ] 수정 기능 구현

### Phase 2: 상태 관리
- [ ] 일시정지/재개 기능
- [ ] 취소 기능 (확인 다이얼로그)
- [ ] 상태 배지 표시

### Phase 3: 고급 기능
- [ ] 생성 이력 표시
- [ ] 목록 필터/검색
- [ ] 무한 스크롤

---

## 승인

이 스펙을 검토하고 승인해 주시면 구현을 시작하겠습니다.

- **스펙 파일**: `SPEC-RECURRING-EXPENSE-UI.md`
- **관련 API**: 이미 구현 완료 (`lib/recurring-expense.ts`, `app/api/recurring-expenses/`)
