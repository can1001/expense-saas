# 작업 내역 (2026-02-07)

## 1. 지출결의서 프린트 양식 개선

### 변경 내용

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 배경색 | `#f0f0f0` | `#f8f8f8` (더 부드러운 회색) |
| 예시 행 배경 | `#fffde7` (노란색) | `#f0f7ff` (연한 파란색) |
| 예시 행 텍스트 | `#666` | `#0066cc` (파란색) |
| 합계 행 상단 | 일반 테두리 | `border-top: 3px double #000` (이중선) |

### 수정 파일
- `components/print/PrintHeader.tsx`
- `components/print/PrintItems.tsx`
- `components/print/PrintFooter.tsx`

---

## 2. 알림 시스템 구현 (SMS / 카카오 알림톡)

### 개요
지출결의서 제출 및 결재 시 SMS와 카카오 알림톡을 발송하는 기능 구현

### 알림 발송 시점
| 이벤트 | 수신자 | 설명 |
|--------|--------|------|
| 제출 (SUBMIT) | 다음 결재자 | 결재 요청 알림 |
| 승인 (APPROVE) | 신청자 + 다음 결재자 | 승인 알림 및 다음 결재 요청 |
| 반려 (REJECT) | 신청자 | 반려 사유 포함 알림 |
| 회수 (WITHDRAW) | 대기중 결재자 | 회수 알림 |
| 지급완료 (PAYMENT_COMPLETE) | 신청자 | 지급 완료 알림 |

### 생성된 파일

#### 데이터베이스 스키마 (`prisma/schema.prisma`)
```prisma
// User 모델에 추가
phoneNumber String?  // 휴대폰 번호

// 새 모델
model NotificationPreference { ... }  // 사용자별 알림 설정
model NotificationLog { ... }         // 발송 로그

// 새 enum
enum NotificationChannel { SMS, KAKAO }
enum NotificationEventType { SUBMIT, APPROVE, REJECT, WITHDRAW, PAYMENT_COMPLETE }
enum NotificationStatus { PENDING, SENT, FAILED }
```

#### 알림 서비스 (`lib/services/notification/`)
| 파일 | 설명 |
|------|------|
| `types.ts` | 타입 정의 (NotificationRecipient, NotificationContext 등) |
| `templates.ts` | 메시지 템플릿 및 변수 치환 함수 |
| `sms-provider.ts` | NHN Cloud SMS 발송 클래스 |
| `kakao-provider.ts` | 카카오 알림톡 발송 클래스 |
| `notification-service.ts` | 통합 알림 서비스 (메인) |
| `index.ts` | 모듈 export |

#### 수정된 API 라우트
| 파일 | 추가된 기능 |
|------|------------|
| `app/api/expenses/[id]/submit/route.ts` | 첫 번째 결재자에게 알림 발송 |
| `app/api/expenses/[id]/approve/route.ts` | 신청자 + 다음 결재자에게 알림 발송 |
| `app/api/expenses/[id]/reject/route.ts` | 신청자에게 반려 알림 발송 |
| `app/api/expenses/[id]/payment-status/route.ts` | 지급완료 시 신청자에게 알림 발송 |

### 메시지 템플릿 (SMS)

```
[지출결의] {{applicantName}}님이 {{amount}}원 결재 요청. 확인: {{url}}
[지출결의] {{approverName}}님이 {{amount}}원 승인 (최종승인)
[지출결의] 결재 반려. 사유: {{reason}}
[지출결의] {{amount}}원 지급 완료 ({{date}})
```

### 환경변수 설정

```bash
# .env.local에 추가

# 알림 활성화
NOTIFICATION_ENABLED="true"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# NHN Cloud SMS (필수)
NHN_SMS_APP_KEY=""
NHN_SMS_SECRET_KEY=""
NHN_SMS_SENDER_NUMBER=""  # 사전등록 필요

# Kakao Alimtalk (선택)
KAKAO_ALIMTALK_APP_KEY=""
KAKAO_ALIMTALK_SECRET_KEY=""
KAKAO_ALIMTALK_SENDER_KEY=""
```

### 배포 체크리스트

- [ ] 데이터베이스 마이그레이션 (`npx prisma db push`)
- [ ] NHN Cloud SMS 가입 및 발신번호 등록
- [ ] 환경변수 설정
- [ ] (선택) 카카오 비즈니스 채널 개설 및 템플릿 심사

### 동작 방식

1. **테스트 모드** (환경변수 미설정)
   - 실제 발송 없이 로그만 기록
   - 개발/테스트 환경에서 사용

2. **운영 모드** (환경변수 설정)
   - 실제 SMS/카카오 알림톡 발송
   - `User.phoneNumber` 필드에 전화번호가 있어야 발송됨

3. **카카오 미설정 시**
   - SMS로 자동 대체 발송

### 예상 비용 (월 500건 기준)

| 서비스 | 단가 | 월 예상 비용 |
|--------|------|-------------|
| NHN SMS | ~12원/건 | ~30,000원 |
| 카카오 알림톡 | ~8원/건 | ~20,000원 |
| **합계** | | **~50,000원** |

---

## 파일 변경 요약

### 신규 생성
- `lib/services/notification/types.ts`
- `lib/services/notification/templates.ts`
- `lib/services/notification/sms-provider.ts`
- `lib/services/notification/kakao-provider.ts`
- `lib/services/notification/notification-service.ts`
- `lib/services/notification/index.ts`
- `docs/2026-02-07-work-summary.md` (이 파일)

### 수정
- `prisma/schema.prisma` - 알림 관련 모델/enum 추가
- `components/print/PrintHeader.tsx` - 배경색 변경
- `components/print/PrintItems.tsx` - 예시 행 파란색, 합계 이중선
- `components/print/PrintFooter.tsx` - 배경색 변경
- `app/api/expenses/[id]/submit/route.ts` - 알림 트리거 추가
- `app/api/expenses/[id]/approve/route.ts` - 알림 트리거 추가
- `app/api/expenses/[id]/reject/route.ts` - 알림 트리거 추가
- `app/api/expenses/[id]/payment-status/route.ts` - 알림 트리거 추가

---

## 3. 단가 입력 버그 수정

### 문제
단가(unitPrice) 입력 시 1원 단위가 예상치 못하게 변경되는 현상

### 원인
`react-hook-form`의 `valueAsNumber: true`와 커스텀 `onChange` 핸들러가 동시에 값을 처리하여 충돌 발생

```tsx
// 문제가 있던 코드
{...register(`items.${index}.unitPrice`, {
  valueAsNumber: true,  // react-hook-form이 숫자로 변환
  onChange: (e) => handleUnitPriceOrQuantityChange(...),  // 커스텀 핸들러도 변환
})}
```

### 해결 방법
- 커스텀 `onChange` 핸들러 제거
- `useEffect`를 사용하여 금액(amount) 자동 계산 로직 분리

```tsx
// 수정된 코드
useEffect(() => {
  items?.forEach((item, index) => {
    if (item) {
      const calculatedAmount = calculateAmount(item.unitPrice || 0, item.quantity || 0);
      if (item.amount !== calculatedAmount) {
        setValue(`items.${index}.amount`, calculatedAmount);
      }
    }
  });
}, [items, setValue]);

// input에서는 valueAsNumber만 사용
{...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
```

### 수정 파일
- `components/expense-form/ItemsSection.tsx`
- `components/simple-expense-form/SimpleItemsSection.tsx`

---

## 4. 지출결의서 유효성 검증 에러 메시지 개선

### 문제
"항목 정보를 확인해주세요" 라는 모호한 에러 메시지만 표시되어 어떤 항목의 어떤 필드에 문제가 있는지 알 수 없었음

### 해결 방법
각 항목별로 구체적인 필드 에러를 표시하도록 개선

```tsx
// 변경 후
{Array.isArray(errors.items) && errors.items.map((itemError, idx) => {
  const fieldErrors: string[] = [];
  if (itemError.budgetCategory) fieldErrors.push(`예산(항): ${itemError.budgetCategory.message}`);
  if (itemError.budgetSubcategory) fieldErrors.push(`예산(목): ${itemError.budgetSubcategory.message}`);
  if (itemError.budgetDetail) fieldErrors.push(`세목: ${itemError.budgetDetail.message}`);
  if (itemError.description) fieldErrors.push(`적요: ${itemError.description.message}`);
  if (itemError.unitPrice) fieldErrors.push(`단가: ${itemError.unitPrice.message}`);
  if (itemError.quantity) fieldErrors.push(`수량: ${itemError.quantity.message}`);
  if (itemError.amount) fieldErrors.push(`금액: ${itemError.amount.message}`);
  return (
    <li key={idx}>
      <span className="font-medium">[{idx + 1}행]</span> {fieldErrors.join(', ')}
    </li>
  );
})}
```

### 수정 파일
- `components/ExpenseForm.tsx`
- `components/SimpleExpenseForm.tsx`

---

## 5. Render 배포 설정 개선

### 문제
프로덕션 배포 시 Prisma 스키마 변경사항이 DB에 반영되지 않아 500 에러 발생 (P2022: column does not exist)

### 원인
빌드 명령어에 `prisma db push`가 포함되어 있지 않았음

### 해결 방법
Render Build Command 수정:

```bash
# 변경 전
npm install && npm run build

# 변경 후
npm install && npx prisma db push && npm run build
```

### 효과
- 배포 시 자동으로 스키마 동기화
- 새 컬럼/테이블 추가 시 수동 작업 불필요

---

## 6. 알림 시스템 운영 확인 방법

### 확인 방법

| 방법 | 설명 |
|------|------|
| **DB 로그** | `NotificationLog` 테이블에서 발송 기록 확인 |
| **서버 로그** | Render Dashboard → Logs에서 `[NotificationService]` 로그 확인 |
| **환경변수** | `NOTIFICATION_ENABLED=true` 설정 확인 |

### 로그 테이블 필드

| 필드 | 설명 |
|------|------|
| `status` | `SENT` (성공), `FAILED` (실패) |
| `channel` | `SMS` 또는 `KAKAO` |
| `eventType` | 발송 이벤트 유형 |
| `errorMessage` | 실패 시 에러 메시지 |

---

## 7. 사용자 연락처 필드 추가

### 개요
알림 발송을 위해 사용자 등록/수정 화면에 연락처(phoneNumber) 입력 필드 추가

### 변경 내용

#### UI 변경
- 사용자 등록 폼에 연락처 필드 추가
- 사용자 수정 폼에 연락처 필드 추가
- 형식: `010-1234-5678`

#### API 변경
- POST `/api/users` - phoneNumber 파라미터 추가
- PUT `/api/users/[id]` - phoneNumber 파라미터 추가

### 수정 파일
- `app/admin/users/new/page.tsx` - 등록 폼에 연락처 필드 추가
- `app/admin/users/[id]/edit/page.tsx` - 수정 폼에 연락처 필드 추가
- `app/api/users/route.ts` - POST API에서 phoneNumber 처리
- `app/api/users/[id]/route.ts` - PUT API에서 phoneNumber 처리
- `lib/services/user-service.ts` - createUser, updateUser 함수에 phoneNumber 추가

### 사용 방법
1. 관리자 → 사용자 관리 이동
2. 사용자 추가 또는 수정
3. 연락처 필드에 전화번호 입력
4. 저장 후 해당 사용자에게 알림 발송 가능

---

## 8. 환경변수 샘플 파일 업데이트

### 변경 내용
`.env.example` 파일에 알림 시스템 관련 환경변수 샘플 추가

```bash
# 알림 시스템 (NHN Notification Hub)
NOTIFICATION_ENABLED="true"
NOTIFICATION_HUB_APP_KEY=""
NOTIFICATION_HUB_USER_ACCESS_KEY=""
NOTIFICATION_HUB_SECRET_ACCESS_KEY=""
NOTIFICATION_HUB_SMS_SENDER=""
NOTIFICATION_HUB_KAKAO_SENDER_KEY=""

# 카카오 알림톡 템플릿 코드
KAKAO_TEMPLATE_SUBMIT=""
KAKAO_TEMPLATE_APPROVE=""
KAKAO_TEMPLATE_REJECT=""
KAKAO_TEMPLATE_WITHDRAW=""
KAKAO_TEMPLATE_PAYMENT_COMPLETE=""
```

---

## 파일 변경 요약 (최종)

### 신규 생성
- `lib/services/notification/types.ts`
- `lib/services/notification/templates.ts`
- `lib/services/notification/sms-provider.ts`
- `lib/services/notification/kakao-provider.ts`
- `lib/services/notification/notification-service.ts`
- `lib/services/notification/index.ts`
- `docs/2026-02-07-work-summary.md` (이 파일)

### 수정
- `prisma/schema.prisma` - 알림 관련 모델/enum 추가
- `components/print/PrintHeader.tsx` - 배경색 변경
- `components/print/PrintItems.tsx` - 예시 행 파란색, 합계 이중선
- `components/print/PrintFooter.tsx` - 배경색 변경
- `components/ExpenseForm.tsx` - 유효성 검증 에러 메시지 개선
- `components/SimpleExpenseForm.tsx` - 유효성 검증 에러 메시지 개선
- `components/expense-form/ItemsSection.tsx` - 단가 입력 버그 수정
- `components/simple-expense-form/SimpleItemsSection.tsx` - 단가 입력 버그 수정
- `app/admin/users/new/page.tsx` - 연락처 필드 추가
- `app/admin/users/[id]/edit/page.tsx` - 연락처 필드 추가
- `app/api/users/route.ts` - phoneNumber 처리 추가
- `app/api/users/[id]/route.ts` - phoneNumber 처리 추가
- `lib/services/user-service.ts` - createUser, updateUser에 phoneNumber 추가
- `app/api/expenses/[id]/submit/route.ts` - 알림 트리거 추가
- `app/api/expenses/[id]/approve/route.ts` - 알림 트리거 추가
- `app/api/expenses/[id]/reject/route.ts` - 알림 트리거 추가
- `app/api/expenses/[id]/payment-status/route.ts` - 알림 트리거 추가
- `.env.example` - 알림 환경변수 샘플 추가

### 배포 설정
- Render Build Command: `npm install && npx prisma db push && npm run build`
