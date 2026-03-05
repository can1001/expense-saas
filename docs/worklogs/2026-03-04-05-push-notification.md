# Push Notification 구현 및 검증 (2026-03-04 ~ 05)

## 개요

PWA 앱에서 결재 이벤트 발생 시 Web Push 알림을 발송하는 기능 구현 및 검증 작업.

---

## 1. 환경 설정

### 1.1 VAPID 키 생성
```bash
npx web-push generate-vapid-keys
```

### 1.2 Render 환경 변수 설정
```
VAPID_PUBLIC_KEY=BPxxx...
VAPID_PRIVATE_KEY=xxx...
VAPID_SUBJECT=mailto:admin@church.org
NOTIFICATION_ENABLED=true
```

**참고 문서:** `docs/troubleshooting/render-push-notification-setup.md`

---

## 2. 주요 수정 사항

### 2.1 iOS PWA Service Worker 등록 문제 해결

**문제:** iOS Safari PWA에서 `navigator.serviceWorker.ready`가 영원히 대기

**원인:** iOS PWA에서 Service Worker가 자동 등록되지 않음

**해결:** `lib/hooks/usePushNotification.ts`에 수동 등록 로직 추가

```typescript
const ensureServiceWorkerRegistered = async () => {
  const registrations = await navigator.serviceWorker.getRegistrations();

  if (registrations.length > 0 && registrations[0].active) {
    return registrations[0];
  }

  // SW 수동 등록
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });

  // 활성화 대기
  if (registration.installing) {
    await new Promise((resolve) => {
      registration.installing?.addEventListener('statechange', (e) => {
        if ((e.target as ServiceWorker).state === 'activated') {
          resolve();
        }
      });
    });
  }

  return registration;
};
```

**커밋:** `957da73 fix: Service Worker 수동 등록 로직 추가`

---

### 2.2 알림 이벤트별 userId 전달

**문제:** Web Push 발송 시 userId가 전달되지 않아 푸시 실패

**원인:** `notificationService`의 알림 메서드들이 userId를 recipient에 포함하지 않음

**해결:** 모든 알림 메서드 시그니처 수정 및 라우트 업데이트

| 이벤트 | 수신자 | 수정 파일 |
|--------|--------|----------|
| SUBMIT | 결재자 | `submit/route.ts` |
| APPROVE | 신청자 + 다음 결재자 | `approve/route.ts` |
| REJECT | 신청자 | `reject/route.ts` |
| WITHDRAW | 대기 결재자들 | `withdraw/route.ts` (신규 구현) |
| PAYMENT_COMPLETE | 신청자 | `payment-status/route.ts` |

**notification-service.ts 변경 예시:**
```typescript
async notifyOnSubmit(
  expenseId: string,
  approverPhone: string,
  approverUserId: string,  // 추가됨
  approverName: string,
  context: ...
)
```

**커밋:**
- `e931fbb fix: 반려 시 푸시 알림에 userId 전달`
- `7d13a87 feat: 모든 알림 이벤트에 Web Push userId 전달`

---

### 2.3 테스트 스크립트 수정

#### 세션 쿠키 인증 방식 수정

**문제:** 테스트 스크립트가 `user` 쿠키를 사용했으나, 서버는 `session` 쿠키 사용

**해결:** `scripts/test-push-notification.ts` 쿠키 처리 수정

```typescript
// 변경 전
return `user=${userCookieValue}`;

// 변경 후
return `session=${data.user.id}`;
```

**커밋:** `b4af21d fix: 테스트 스크립트 세션 쿠키 인증 방식 수정`

#### 구독 해제 테스트 보호

**문제:** 테스트 6 (모든 구독 해제)이 프로덕션 DB에서 실제 PushSubscription 삭제

**해결:** 기본적으로 skip 처리, 환경변수로 활성화

```typescript
if (process.env.TEST_ALLOW_UNSUBSCRIBE !== 'true') {
  addResult('모든 구독 해제', true, '(SKIP) 프로덕션 보호');
  return;
}
```

**커밋:** `2573b2c fix: 테스트 스크립트 구독 해제 테스트 기본 skip 처리`

---

### 2.4 SMS/KakaoTalk 임시 비활성화

**목적:** Web Push 테스트 집중을 위해 SMS/KAKAO 채널 임시 주석 처리

**파일:** `lib/services/notification/notification-service.ts`

```typescript
// [임시 비활성화] SMS/KAKAO - Web Push만 사용
// if (!preference || preference.smsEnabled) {
//   channels.push('SMS');
// }
// if (!preference || preference.kakaoEnabled) {
//   channels.push('KAKAO');
// }
if (!preference || preference.webPushEnabled) {
  channels.push('WEB_PUSH');
}
```

**커밋:** `886ddd5 chore: SMS/KakaoTalk 알림 임시 비활성화`

---

## 3. 테스트 방법

### 3.1 API 테스트 스크립트
```bash
# 환경변수 설정
export TEST_BASE_URL=http://localhost:3000
export TEST_USER_ID=청연정혜종
export TEST_USER_PASSWORD=****

# 실행
npx ts-node scripts/test-push-notification.ts
```

### 3.2 브라우저 테스트 (Playwright)
```bash
npx playwright test scripts/test-push-browser.ts --headed
```

### 3.3 수동 테스트
1. `/mypage/notifications`에서 "알림 허용" 클릭
2. 지출결의서 제출/승인/반려 등 결재 액션 수행
3. 수신자에게 푸시 알림 도착 확인

---

## 4. 데이터베이스 테이블

### NotificationLog
일반 알림 발송 로그 (SMS, KAKAO, WEB_PUSH 통합)

| 컬럼 | 설명 |
|------|------|
| channel | SMS, KAKAO, WEB_PUSH |
| eventType | SUBMIT, APPROVE, REJECT, WITHDRAW, PAYMENT_COMPLETE |
| status | PENDING, SENT, FAILED |
| errorMessage | 실패 시 에러 메시지 |

### WebPushLog
Web Push 전용 상세 로그

| 컬럼 | 설명 |
|------|------|
| userId | 수신자 ID |
| expenseId | 관련 지출결의서 ID |
| title | 푸시 제목 |
| body | 푸시 본문 |
| status | SENT, FAILED |
| errorMessage | 실패 시 상세 에러 |

### PushSubscription
사용자별 푸시 구독 정보

| 컬럼 | 설명 |
|------|------|
| userId | 사용자 ID |
| endpoint | 푸시 서비스 엔드포인트 |
| p256dh | 암호화 키 |
| auth | 인증 키 |
| isActive | 활성화 여부 |
| failedCount | 연속 실패 횟수 (5회 초과 시 비활성화) |

---

## 5. 트러블슈팅

### 5.1 "모든 구독에 발송 실패" 에러

**원인 1:** 구독이 만료됨 (410 Gone)
- 해결: 사용자가 `/mypage/notifications`에서 재구독

**원인 2:** VAPID 키 불일치
- 해결: Render 환경변수 확인, 키 재설정 후 재배포

**원인 3:** 테스트 스크립트가 구독 삭제
- 해결: `TEST_ALLOW_UNSUBSCRIBE=true` 없이 테스트 실행 확인

### 5.2 iOS에서 푸시 구독 실패

**원인:** iOS 16.4 미만 또는 홈 화면에 추가하지 않음

**해결:**
1. iOS 16.4 이상 확인
2. Safari에서 "홈 화면에 추가" 후 앱 실행
3. `/mypage/notifications`에서 "알림 허용" 클릭

### 5.3 NotificationLog는 SENT인데 알림 안 옴

**확인 사항:**
1. `WebPushLog` 테이블에서 실제 발송 결과 확인
2. `PushSubscription.isActive`가 true인지 확인
3. 브라우저 알림 권한이 "허용"인지 확인

---

## 6. 관련 파일 목록

### 핵심 파일
- `lib/services/notification/notification-service.ts` - 알림 서비스
- `lib/services/notification/web-push-provider.ts` - Web Push 프로바이더
- `lib/hooks/usePushNotification.ts` - 클라이언트 훅

### API 라우트
- `app/api/push/subscribe/route.ts` - 구독 등록
- `app/api/push/unsubscribe/route.ts` - 구독 해제
- `app/api/push/test/route.ts` - 테스트 발송
- `app/api/push/vapid-public-key/route.ts` - VAPID 공개키

### 결재 라우트 (알림 발송 포함)
- `app/api/expenses/[id]/submit/route.ts`
- `app/api/expenses/[id]/approve/route.ts`
- `app/api/expenses/[id]/reject/route.ts`
- `app/api/expenses/[id]/withdraw/route.ts`
- `app/api/expenses/[id]/payment-status/route.ts`

### 테스트 스크립트
- `scripts/test-push-notification.ts` - API 테스트
- `scripts/test-push-browser.ts` - Playwright 테스트
- `scripts/test-notification.ts` - 알림 서비스 직접 테스트

### UI
- `app/mypage/notifications/page.tsx` - 알림 설정 페이지
- `public/sw.js` - Service Worker

---

## 7. 향후 작업

- [ ] SMS/KakaoTalk 연동 활성화 (주석 해제)
- [ ] 알림 히스토리 UI 구현
- [ ] 알림 클릭 시 해당 지출결의서로 이동 검증
- [ ] 오프라인 알림 큐잉 (Background Sync 활용)
