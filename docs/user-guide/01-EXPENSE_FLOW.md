# 지출결의서 작성 Flow

지출결의서 시스템의 작성 흐름과 데이터 구조를 설명합니다.

---

## 전체 Flow 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 (클라이언트)                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 예산 정보 선택                                               │
│     위원회 → 사역팀/부 → 예산(항) → 예산(목)                      │
│     [BudgetSection.tsx]                                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 세부 항목 입력 (1~10개)                                       │
│     예산(세목) 선택 → 적요 입력 → 단가/수량 → 금액 자동계산         │
│     [ItemsSection.tsx]                                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 신청 정보                                                    │
│     청구일자, 청구팀(자동생성), 청구인, 직책                       │
│     [ApplicantSection.tsx]                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 은행 정보                                                    │
│     저장된 계좌 선택 또는 직접 입력                                │
│     [BankAccountSelector.tsx]                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. 첨부파일 (선택)                                               │
│     영수증 이미지 업로드 (최대 10개, 각 5MB)                       │
│     [FileUpload.tsx]                                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. 결재선 미리보기                                               │
│     1차(담당자) → 2차(회계) → 3차(재정팀장)                        │
│     [ApprovalLinePreview.tsx]                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
               ┌──────────┐      ┌──────────┐
               │   저장   │      │   제출   │
               │ (DRAFT)  │      │(PENDING) │
               └──────────┘      └────┬─────┘
                                      │
                                      ▼
                           ┌─────────────────┐
                           │  서명/도장 선택  │
                           │ [SignatureSelector]│
                           └────────┬────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │   결재 진행     │
                           └─────────────────┘
```

---

## 페이지 구조

### 신규 작성

| 항목 | 내용 |
|------|------|
| **경로** | `/expenses/new` |
| **파일** | `app/expenses/new/page.tsx` |
| **컴포넌트** | `ExpenseForm` |

### 수정

| 항목 | 내용 |
|------|------|
| **경로** | `/expenses/[id]/edit` |
| **파일** | `app/expenses/[id]/edit/page.tsx` |
| **컴포넌트** | `ExpenseForm` (expenseId props 전달) |

**수정 가능 상태**:
- `DRAFT` (작성중)
- `REJECTED` (반려됨)
- `WITHDRAWN` (회수됨)
- `APPROVED_FINAL` + `paymentStatus='PENDING'` (승인완료, 지급대기)

---

## 컴포넌트 구성

```
ExpenseForm.tsx (메인 폼)
├── BudgetSection.tsx          # 예산 정보 (위원회/사역팀/항/목)
├── ExpenseDateSection.tsx     # 지출일자 (수정 모드에서만 표시)
├── ItemsSection.tsx           # 세부 항목 (1~10개)
├── ApplicantSection.tsx       # 신청 정보 (청구일자/청구인/직책)
├── BankAccountSelector.tsx    # 은행 정보
├── FileUpload.tsx             # 첨부파일
├── ApprovalLinePreview.tsx    # 결재선 미리보기
└── SignatureSelector.tsx      # 서명/도장 선택 (제출 시)
```

### 각 컴포넌트 역할

| 컴포넌트 | 역할 | 필수 여부 |
|----------|------|----------|
| BudgetSection | 5단계 예산 계층 선택 (위원회→사역팀→항→목) | 필수 |
| ExpenseDateSection | 지출일자 입력 | 수정 시에만 |
| ItemsSection | 세부 항목 관리, 금액 자동 계산 | 필수 |
| ApplicantSection | 청구인 정보, 청구팀 자동 생성 | 필수 |
| BankAccountSelector | 은행 계좌 선택/입력 | 필수 |
| FileUpload | 영수증 이미지 첨부 | 선택 |
| ApprovalLinePreview | 결재선 미리보기, 예산 현황 | 정보 제공 |
| SignatureSelector | 서명/도장 선택 | 제출 시 필수 |

---

## 데이터 흐름

### 폼 데이터 구조

```typescript
interface ExpenseFormData {
  // 예산 정보
  committee: string;           // 위원회
  department: string;          // 사역팀(부)

  // 지출일자 (수정 모드에서만)
  expenseDate?: string;        // YYYY-MM-DD

  // 세부 항목 (1~10개)
  items: ExpenseItemData[];

  // 신청 정보
  requestDate: string;         // 청구일자 (YYYY-MM-DD)
  requestTeam: string;         // 청구팀 (자동생성: 위원회 + 사역팀)
  applicantName: string;       // 청구인
  applicantTitle?: string;     // 직책

  // 은행 정보
  bankName: string;            // 은행명
  accountNumber: string;       // 계좌번호
  accountHolder: string;       // 예금주
}

interface ExpenseItemData {
  budgetCategory: string;      // 예산(항)
  budgetSubcategory: string;   // 예산(목)
  budgetDetail: string;        // 예산(세목)
  description: string;         // 적요
  unitPrice: number;           // 단가
  quantity: number;            // 수량
  amount: number;              // 금액 (자동계산)
}
```

### 금액 계산 규칙

```javascript
// 단가 × 수량
amount = unitPrice * quantity;

// 총 청구금액
requestAmount = items.reduce((sum, item) => sum + item.amount, 0);
```

### 청구팀 자동 생성

```javascript
// lib/domain/request-team.ts
requestTeam = `${committee} ${department}`;
// 예: "재정위원회 재정팀"
```

---

## API 엔드포인트

### POST /api/expenses (신규 생성)

**요청**:
```json
{
  "committee": "재정위원회",
  "department": "재정팀",
  "requestDate": "2026-03-03",
  "applicantName": "홍길동",
  "applicantTitle": "팀원",
  "bankName": "국민은행",
  "accountNumber": "123-456-789012",
  "accountHolder": "홍길동",
  "items": [
    {
      "budgetCategory": "사무행정비",
      "budgetSubcategory": "회의접대비",
      "budgetDetail": "아웃팅비_재정팀",
      "description": "재정팀 회식비",
      "unitPrice": 50000,
      "quantity": 10,
      "amount": 500000
    }
  ],
  "status": "DRAFT"
}
```

**응답** (201 Created):
```json
{
  "id": "clxxxxx",
  "status": "DRAFT",
  "requestAmount": 500000,
  "items": [...],
  "createdAt": "2026-03-03T..."
}
```

### PUT /api/expenses/[id] (수정)

- 기존 항목 전체 삭제 후 새로 생성
- `partial()` 검증으로 부분 수정 가능

### POST /api/expenses/[id]/submit (제출)

- 상태: `DRAFT` → `PENDING`
- 결재선 자동 산출
- 전결 단계 자동 승인
- 청구인 서명 저장

---

## 결재 상태 (ApprovalStatus)

```
DRAFT            작성중 (제출 전)
    │
    ▼ [제출]
PENDING          결재 대기 (1차 결재 대기)
    │
    ├─▶ [1차 승인] ──▶ APPROVED_STEP_1 (2차 결재 대기)
    │                      │
    │                      ├─▶ [2차 승인] ──▶ APPROVED_STEP_2 (3차 결재 대기)
    │                      │                      │
    │                      │                      └─▶ [3차 승인] ──▶ APPROVED_FINAL
    │                      │
    │                      └─▶ [반려] ──▶ REJECTED
    │
    ├─▶ [반려] ──▶ REJECTED
    │
    └─▶ [회수] ──▶ WITHDRAWN
```

---

## 결재선 산출 규칙

### 기본 3단계 결재

```
1차 결재: 세목 담당자 (팀장)
2차 결재: 회계
3차 결재: 재정팀장
```

### 전결 처리

세목 담당자가 재정팀장인 경우:
- 1차 결재 자동 승인 (전결)
- 2차 결재부터 수동 진행

---

## 오프라인 저장

온라인 연결이 없는 경우:

```
[폼 작성] → [저장 클릭] → [IndexedDB 저장] → [온라인 복귀 시 자동 동기화]
```

- **저장 위치**: IndexedDB (`expenses` 스토어)
- **상태**: `pending_sync`
- **동기화**: Background Sync API 또는 수동 동기화

---

## 관련 파일 경로

| 기능 | 파일 경로 |
|------|----------|
| 메인 폼 | `components/ExpenseForm.tsx` |
| 예산 섹션 | `components/expense-form/BudgetSection.tsx` |
| 항목 섹션 | `components/expense-form/ItemsSection.tsx` |
| 신청 섹션 | `components/expense-form/ApplicantSection.tsx` |
| 은행 섹션 | `components/expense-form/BankAccountSelector.tsx` |
| 폼 스키마 | `lib/schemas/expense-schema.ts` |
| API (생성) | `app/api/expenses/route.ts` |
| API (수정) | `app/api/expenses/[id]/route.ts` |
| API (제출) | `app/api/expenses/[id]/submit/route.ts` |
| 오프라인 저장 | `lib/db/expense-store.ts` |
