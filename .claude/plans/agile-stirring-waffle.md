# 지급 완료 시 출납(인) 프린트 기능

## 요구사항
- 지급 완료(COMPLETED) 처리된 지출결의서 프린트 시 "출납(인)" 표시
- 출납 담당자 서명/도장 + 지급일자 표시

---

## 현재 상태
- `paymentStatus: COMPLETED` 시 `paymentCompletedBy` (처리자명), `paymentCompletedAt` (처리일시) 저장됨
- 하지만 **출납 서명 데이터**는 저장되지 않음

---

## 구현 방안

### 1. 데이터베이스 스키마 확장

**파일**: `prisma/schema.prisma`

```prisma
model Expense {
  // 기존 지급 완료 필드들
  paymentCompletedAt      DateTime?
  paymentCompletedBy      String?
  paymentNote             String?

  // 새로 추가: 출납 서명 데이터
  paymentSignatureType    String?      // "signature" | "stamp"
  paymentSignatureData    String?  @db.Text  // base64 이미지
}
```

### 2. 타입 정의 업데이트

**파일**: `lib/types/index.ts`

```typescript
export interface Expense {
  // ... 기존 필드
  paymentSignatureType?: string | null;
  paymentSignatureData?: string | null;
}
```

### 3. 지급 완료 API 수정

**파일**: `app/api/expenses/[id]/payment-status/route.ts`

- 지급 완료 처리 시 서명 데이터 저장
- Request Body에 `signature` 필드 추가

```typescript
// 변경 후 요청 본문
{
  paymentStatus: "COMPLETED",
  note?: string,
  signature: {
    type: "signature" | "stamp",
    signatureId?: string,  // 저장된 서명 ID
    data?: string          // 또는 base64 데이터
  }
}
```

### 4. PaymentStatusModal 수정

**파일**: `components/PaymentStatusModal.tsx`

- 지급 완료(COMPLETED) 선택 시 서명 선택 UI 추가
- SignatureSelector 컴포넌트 활용

### 5. PrintFooter 확장

**파일**: `components/print/PrintFooter.tsx`

- 기존 3행 테이블을 4행으로 확장
- 새 행: "출 납" | 서명이미지 + (인) + 지급일자

```
Row 1: 청구일자 | 청구인 + (인) + 서명
Row 2: 입금은행 | 계좌번호
Row 3: 예금주   | 청구팀(부)
Row 4: 출 납   | 서명 + (인) + 지급일자  ← 신규 (지급완료 시에만)
```

---

## 수정 대상 파일 (6개)

| 파일 | 변경 내용 |
|------|-----------|
| `prisma/schema.prisma` | 출납 서명 필드 추가 |
| `lib/types/index.ts` | Expense 타입에 필드 추가 |
| `app/api/expenses/[id]/payment-status/route.ts` | 서명 저장 로직 |
| `components/PaymentStatusModal.tsx` | 서명 선택 UI |
| `components/print/PrintFooter.tsx` | 출납(인) 렌더링 |
| `components/print/types.ts` | Expense 타입 확장 (필요시) |

---

## 검증 방법
1. `npm run db:push` - 스키마 적용
2. 지급 완료 처리 시 서명 선택 UI 확인
3. 지급 완료된 지출결의서 프린트 시 출납(인) 표시 확인
4. `npm run build` 성공 확인
