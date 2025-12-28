# 지출 상태 관리 기능 (지출예정/지출완료)

## 개요

지출결의서가 최종 승인(APPROVED_FINAL) 된 후, 관리자가 실제 지출 진행 상태를 관리할 수 있는 기능을 추가합니다.

---

## 현재 상태 흐름

```
DRAFT → PENDING → APPROVED_STEP_1 → APPROVED_STEP_2 → APPROVED_FINAL
                                                            ↓
                                                         (끝)
```

### 현재 ApprovalStatus
| 상태 | 설명 |
|------|------|
| DRAFT | 작성중 (제출 전) |
| PENDING | 결재 대기 (1차 팀장 결재 대기) |
| APPROVED_STEP_1 | 1차 승인 완료 (2차 회계 결재 대기) |
| APPROVED_STEP_2 | 2차 승인 완료 (3차 재정팀장 결재 대기) |
| APPROVED_FINAL | 최종 승인 완료 |
| REJECTED | 반려 |
| WITHDRAWN | 회수 |

---

## 요구사항

1. 최종 승인된 지출결의서의 지출 상태를 관리
2. 상태: **지출예정** → **지출완료**
3. 관리자만 상태 변경 가능
4. 상태 변경 이력 기록

---

## 설계 방안

### Option A: ApprovalStatus에 새 상태 추가

```prisma
enum ApprovalStatus {
  DRAFT
  PENDING
  APPROVED_STEP_1
  APPROVED_STEP_2
  APPROVED_FINAL      // 최종 승인 (= 지출예정)
  PAYMENT_SCHEDULED   // 지출예정 (명시적)
  PAYMENT_COMPLETED   // 지출완료
  REJECTED
  WITHDRAWN
}
```

**장점**: 단일 필드로 관리, 기존 로직 활용
**단점**: 결재 상태와 지출 상태가 혼합됨

---

### Option B: 별도 PaymentStatus 필드 추가 (권장)

```prisma
model Expense {
  // 기존 필드
  status            ApprovalStatus  @default(DRAFT)

  // 새 필드: 지출 상태 (최종 승인 후 관리)
  paymentStatus     PaymentStatus?  @default(PENDING)
  paymentStatusAt   DateTime?       // 상태 변경 시각
  paymentStatusBy   String?         // 상태 변경자
}

enum PaymentStatus {
  PENDING     // 지출예정 (기본값, 최종 승인 시)
  COMPLETED   // 지출완료
}
```

**장점**:
- 결재 상태와 지출 상태가 명확히 분리
- 기존 결재 로직에 영향 없음
- 확장성 (추가 상태 필요 시 용이)

**단점**:
- 새 필드 추가 필요
- 조회 시 두 필드 모두 확인 필요

---

## 권장안: Option B

결재 흐름과 지출 상태를 분리하여 관리

### 새로운 상태 흐름

```
[결재 흐름]
DRAFT → PENDING → APPROVED_STEP_1 → APPROVED_STEP_2 → APPROVED_FINAL
                                                            ↓
[지출 상태]                                        paymentStatus: PENDING
                                                            ↓
                                                   paymentStatus: COMPLETED
```

### UI 표시 예시

| 결재 상태 | 지출 상태 | 화면 표시 |
|-----------|-----------|-----------|
| APPROVED_FINAL | PENDING | 지출예정 |
| APPROVED_FINAL | COMPLETED | 지출완료 |

---

## 데이터베이스 변경

### Prisma Schema 수정

```prisma
// prisma/schema.prisma

model Expense {
  // ... 기존 필드 ...

  // 지출 상태 관리 (최종 승인 후)
  paymentStatus     PaymentStatus   @default(PENDING)
  paymentCompletedAt DateTime?      // 지출완료 시각
  paymentCompletedBy String?        // 지출완료 처리자
  paymentNote       String?         // 지출 메모 (선택)
}

enum PaymentStatus {
  PENDING     // 지출예정
  COMPLETED   // 지출완료
}
```

### 마이그레이션

```bash
npx prisma db push
# 또는
npx prisma migrate dev --name add-payment-status
```

---

## API 설계

### 1. 지출 상태 변경 API

```
PUT /api/expenses/[id]/payment-status

Request Body:
{
  "paymentStatus": "COMPLETED",  // "PENDING" | "COMPLETED"
  "note": "12월 28일 이체 완료"   // 선택
}

Response:
{
  "success": true,
  "message": "지출완료로 변경되었습니다.",
  "data": {
    "id": "...",
    "paymentStatus": "COMPLETED",
    "paymentCompletedAt": "2025-12-28T10:30:00Z",
    "paymentCompletedBy": "신창국"
  }
}
```

### 2. 권한 체크

- APPROVED_FINAL 상태인 경우에만 변경 가능
- 관리자(admin) 또는 재정팀장만 변경 가능

---

## UI 설계

### 1. 지출결의서 목록 페이지 (`/expenses`)

#### 필터 추가
```
[상태 필터]
- 전체
- 작성중
- 결재중
- 지출예정 ← 새로 추가
- 지출완료 ← 새로 추가
- 반려
```

#### 목록 표시
| 번호 | 청구인 | 금액 | 결재상태 | 지출상태 | 작업 |
|------|--------|------|----------|----------|------|
| 001 | 홍길동 | 100,000 | 최종승인 | 지출예정 | [지출완료] |
| 002 | 김철수 | 50,000 | 최종승인 | 지출완료 | - |

### 2. 지출결의서 상세 페이지 (`/expenses/[id]`)

#### 상태 변경 버튼 (관리자용)
```
┌─────────────────────────────────────────────┐
│ 지출 상태: 지출예정                          │
│                                             │
│ [지출완료로 변경]                            │
└─────────────────────────────────────────────┘
```

#### 지출완료 확인 모달
```
┌─────────────────────────────────────────────┐
│ 지출완료 처리                                │
├─────────────────────────────────────────────┤
│                                             │
│ 이 지출결의서를 지출완료로 처리하시겠습니까?   │
│                                             │
│ 메모 (선택):                                │
│ [12월 28일 이체 완료________________]        │
│                                             │
├─────────────────────────────────────────────┤
│              [취소]  [지출완료 처리]          │
└─────────────────────────────────────────────┘
```

### 3. 결재함 페이지 (`/approvals`)

- 지출예정/지출완료 탭 또는 필터 추가
- 관리자는 지출 상태 일괄 변경 가능

---

## 구현 순서

### Phase 1: 데이터베이스 및 API
1. [ ] Prisma schema에 PaymentStatus enum 추가
2. [ ] Expense 모델에 paymentStatus 관련 필드 추가
3. [ ] 마이그레이션 실행
4. [ ] PUT /api/expenses/[id]/payment-status API 생성
5. [ ] 권한 체크 로직 추가

### Phase 2: UI 구현
6. [ ] 지출결의서 상세 페이지에 지출 상태 표시 및 변경 버튼 추가
7. [ ] PaymentStatusModal 컴포넌트 생성
8. [ ] 지출결의서 목록 페이지에 지출 상태 필터 추가
9. [ ] 목록에 지출 상태 컬럼 추가

### Phase 3: 추가 기능
10. [ ] 감사 로그에 지출 상태 변경 기록
11. [ ] 지출완료 건 엑셀 내보내기 필터
12. [ ] 대시보드에 지출 현황 요약

---

## 관련 파일

### 수정 대상
| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | PaymentStatus enum, 필드 추가 |
| `lib/types.ts` | 타입 정의 추가 |
| `app/expenses/[id]/page.tsx` | 지출 상태 표시 및 변경 UI |
| `app/expenses/page.tsx` | 필터 및 목록 컬럼 추가 |
| `app/api/expenses/[id]/route.ts` | 응답에 paymentStatus 포함 |

### 신규 생성
| 파일 | 내용 |
|------|------|
| `app/api/expenses/[id]/payment-status/route.ts` | 상태 변경 API |
| `components/PaymentStatusModal.tsx` | 상태 변경 모달 |

---

## 고려 사항

### 1. 기존 데이터 처리
- 기존 APPROVED_FINAL 상태의 지출결의서는 paymentStatus: PENDING으로 설정
- 마이그레이션 스크립트 필요

### 2. 상태 되돌리기
- 지출완료 → 지출예정으로 되돌리기 허용 여부?
- 권장: 관리자만 되돌리기 가능

### 3. 알림
- 지출완료 처리 시 작성자에게 알림? (향후 기능)

---

## 참고

- 관련 문서: `docs/APPROVAL_LINE_RULES.md`
- 현재 결재 상태: `prisma/schema.prisma` ApprovalStatus enum
