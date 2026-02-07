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
