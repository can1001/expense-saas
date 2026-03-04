# 웹 푸시 알림(Web Push) 기능 분석 및 테스트 가이드

## 1. 개요

지출결의서 관리 시스템의 웹 푸시 알림 기능은 **Web Push API 표준(W3C)**을 기반으로 하며, VAPID(Voluntary Application Server Identification) 키를 사용한 보안 메커니즘을 갖추고 있습니다.

---

## 2. 아키텍처 및 핵심 컴포넌트

### 2.1 서비스 워커 (Service Worker)
- **파일**: `public/sw.js`
- **역할**:
  - Workbox 기반 PWA 캐싱 전략 관리
  - 푸시 알림 수신 및 표시
  - 오프라인 지원

### 2.2 웹 푸시 프로바이더
- **파일**: `lib/services/notification/web-push-provider.ts`
- **클래스**: `WebPushProvider`
- **주요 메서드**:

| 메서드 | 역할 | 권한 |
|--------|------|------|
| `getPublicKey()` | VAPID 공개키 반환 | 공개 |
| `subscribe()` | 푸시 구독 등록/업데이트 | 인증 필요 |
| `unsubscribe()` | 특정 구독 해제 | 인증 필요 |
| `unsubscribeAll()` | 모든 구독 해제 | 인증 필요 |
| `sendToUser()` | 사용자에게 푸시 발송 | 서버 내부 |
| `getSubscriptions()` | 활성 구독 목록 조회 | 인증 필요 |

### 2.3 알림 서비스
- **파일**: `lib/services/notification/notification-service.ts`
- **클래스**: `NotificationService`
- **지원 채널**: SMS, KAKAO (알림톡), WEB_PUSH

---

## 3. API 엔드포인트

### 3.1 푸시 구독 관리 API

| 엔드포인트 | 메서드 | 설명 | 권한 |
|-----------|--------|------|------|
| `/api/push/vapid-public-key` | GET | VAPID 공개키 조회 | 공개 |
| `/api/push/subscribe` | POST | 푸시 구독 등록 | 로그인 필수 |
| `/api/push/unsubscribe` | POST | 푸시 구독 해제 | 로그인 필수 |
| `/api/push/test` | POST | 테스트 푸시 발송 | 로그인 필수 |

### 3.2 상세 스펙

#### GET /api/push/vapid-public-key
```json
// 응답 (200)
{
  "publicKey": "BCy_AAAAA..."
}

// 응답 (503) - 키 미설정
{
  "error": "VAPID 키가 설정되지 않았습니다."
}
```

#### POST /api/push/subscribe
```json
// 요청
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "BG...",
      "auth": "5Y..."
    }
  },
  "deviceName": "iPhone 12"
}

// 응답 (200)
{
  "success": true,
  "subscriptionId": "clxxx..."
}
```

#### POST /api/push/unsubscribe
```json
// 요청 (특정 구독)
{
  "endpoint": "https://fcm.googleapis.com/..."
}

// 요청 (모든 구독)
{
  "all": true
}

// 응답 (200)
{
  "success": true,
  "message": "구독이 해제되었습니다."
}
```

#### POST /api/push/test
```json
// 응답 (200)
{
  "success": true,
  "message": "테스트 푸시 알림이 발송되었습니다. (성공: 2, 실패: 0)",
  "results": [...]
}
```

---

## 4. 푸시 알림 흐름

### 4.1 초기 구독 흐름
```
클라이언트 (브라우저)
    ↓ 1. navigator.serviceWorker.register()
    ↓ 2. serviceWorkerRegistration.pushManager.subscribe()
    ↓ 3. GET /api/push/vapid-public-key
    ↓ 4. POST /api/push/subscribe
    ↓
서버 (webPushProvider)
    ↓ 5. PushSubscription 레코드 생성
    ↓ 6. 200 OK
```

### 4.2 이벤트 발생 시 발송 흐름
```
결재/결제 이벤트 발생
    ↓
notificationService.notifyOn{Event}()
    ↓
webPushProvider.sendToUser()
    ↓
활성 PushSubscription 조회 → 발송
    ↓
WebPushLog 기록
```

---

## 5. 알림 트리거 이벤트

| 이벤트 | API 경로 | 수신자 | 알림 내용 |
|--------|---------|--------|----------|
| **SUBMIT** | `POST /api/expenses/[id]/submit` | 결재자 | 새 결재 요청 |
| **APPROVE** | `POST /api/expenses/[id]/approve` | 신청자 | 결재 승인 |
| **REJECT** | `POST /api/expenses/[id]/reject` | 신청자 | 결재 반려 |
| **WITHDRAW** | `POST /api/expenses/[id]/withdraw` | 결재자 | 결재 회수 |
| **PAYMENT_COMPLETE** | `PUT /api/expenses/[id]/payment-status` | 신청자 | 지급 완료 |

---

## 6. 데이터베이스 스키마

### PushSubscription
```prisma
model PushSubscription {
  id          String   @id @default(cuid())
  userId      String
  endpoint    String   @db.Text
  p256dh      String   @db.Text
  auth        String   @db.Text
  userAgent   String?  @db.Text
  deviceName  String?
  isActive    Boolean  @default(true)
  failedCount Int      @default(0)  // >= 5: 자동 비활성화
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, endpoint])
}
```

### WebPushLog
```prisma
model WebPushLog {
  id           String   @id @default(cuid())
  userId       String?
  expenseId    String?
  eventType    NotificationEventType
  title        String
  body         String
  url          String?
  status       NotificationStatus @default(PENDING)
  errorMessage String?
  sentAt       DateTime?
  createdAt    DateTime @default(now())
}
```

---

## 7. 환경 변수 설정

### 필수 설정 (VAPID 키)
```bash
VAPID_PUBLIC_KEY="BCy_AAA..."      # Base64 공개키
VAPID_PRIVATE_KEY="lq6F9jG..."     # Base64 개인키
VAPID_SUBJECT="mailto:admin@example.com"
```

### VAPID 키 생성
```bash
npx web-push generate-vapid-keys
```

### 알림 서비스 설정 (선택)
```bash
NOTIFICATION_ENABLED="true"
NOTIFICATION_HUB_APP_KEY=""
NOTIFICATION_HUB_USER_ACCESS_KEY=""
NOTIFICATION_HUB_SECRET_ACCESS_KEY=""
NOTIFICATION_HUB_SMS_SENDER="01012345678"
```

---

## 8. 테스트 계획

### 8.1 사전 준비 확인

| 항목 | 확인 방법 | 예상 결과 |
|------|----------|----------|
| VAPID 키 | `GET /api/push/vapid-public-key` | publicKey 반환 |
| 서비스 워커 | DevTools → Application → Service Workers | sw.js 활성화 |
| 알림 권한 | 브라우저 설정 | "허용" 상태 |

### 8.2 기본 기능 테스트

1. **VAPID 공개키 조회**
2. **구독 등록** (브라우저 콘솔)
3. **테스트 푸시 발송**
4. **구독 해제**

### 8.3 이벤트별 알림 테스트

```
[계정 A: 신청자]           [계정 B: 결재자]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 푸시 구독 등록         1. 푸시 구독 등록
2. 지출결의서 제출
                         2. → SUBMIT 알림 수신 ✓
                         3. 결재 승인
4. → APPROVE 알림 수신 ✓
5. (관리자) 지급완료
6. → PAYMENT_COMPLETE 알림 수신 ✓
```

### 8.4 브라우저별 지원

| 브라우저 | 지원 | 비고 |
|---------|------|------|
| Chrome (Desktop/Android) | ✅ | 기본 테스트 대상 |
| Safari (iOS 16.4+) | ✅ | PWA 모드에서만 |
| Safari (macOS 13+) | ✅ | |
| Firefox | ✅ | |
| Edge | ✅ | |

---

## 9. 문제 해결

| 증상 | 원인 | 해결책 |
|------|------|-------|
| "VAPID 키 미설정" | 환경변수 누락 | `.env`에 VAPID 키 설정 |
| 알림 미수신 | Service Worker 미설치 | DevTools에서 확인/재설치 |
| 구독 자동 비활성화 | 5회 연속 실패 | 재구독 필요 |
| 401 에러 | 인증 만료 | 재로그인 |

---

## 10. 보안 권장사항

1. **VAPID 개인키는 서버에서만 관리** (클라이언트 노출 금지)
2. **모든 구독 API는 인증 필수**
3. **연속 실패 시 자동 비활성화** (failedCount >= 5)
4. **만료된 구독 즉시 제거** (410/404 응답)

---

## 11. 참고 파일

- `public/sw.js` - 서비스 워커
- `lib/services/notification/web-push-provider.ts` - 웹 푸시 프로바이더
- `lib/services/notification/notification-service.ts` - 알림 서비스
- `lib/services/notification/templates.ts` - 알림 템플릿
- `app/api/push/*/route.ts` - API 엔드포인트
