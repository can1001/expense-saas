# 2026-03-03 작업일지: PWA 고급 기능 구현

## 개요

지출결의서 시스템에 PWA 고급 기능 3가지를 구현했습니다:
1. 웹 푸시 알림 (Web Push Notification)
2. 백그라운드 동기화 (Background Sync)
3. 오프라인 데이터 저장 및 동기화 (IndexedDB)

---

## 구현된 기능

### 1. 오프라인 데이터 저장 (IndexedDB)

인터넷 연결 없이도 지출결의서를 작성하고 저장할 수 있는 기능입니다.

#### 추가된 패키지
```bash
npm install dexie uuid
npm install -D @types/uuid
```

#### 신규 파일

| 파일 | 설명 |
|------|------|
| `lib/db/types.ts` | 오프라인 데이터 타입 정의 |
| `lib/db/index.ts` | Dexie.js 기반 IndexedDB 설정 |
| `lib/db/expense-store.ts` | 지출결의서 오프라인 CRUD |
| `lib/db/attachment-store.ts` | 첨부파일 Blob 저장 (최대 5MB) |
| `lib/hooks/useOnlineStatus.ts` | 네트워크 상태 감지 훅 |
| `lib/hooks/useOfflineExpense.ts` | 오프라인 지출결의서 관리 훅 |
| `components/offline/OfflineBanner.tsx` | 오프라인 상태 배너 |
| `components/offline/DraftList.tsx` | 임시저장 목록 |

#### 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/hooks/useExpenseFormSubmit.ts` | 오프라인 시 IndexedDB 저장 분기 추가 |

#### 동기화 상태

| 상태 | 설명 |
|------|------|
| `draft` | 임시저장 (동기화 대상 아님) |
| `pending_sync` | 동기화 대기 중 |
| `syncing` | 동기화 진행 중 |
| `synced` | 동기화 완료 |
| `conflict` | 충돌 발생 (수동 해결 필요) |
| `failed` | 동기화 실패 |

---

### 2. 백그라운드 동기화 (Background Sync)

오프라인에서 제출한 데이터가 온라인 복귀 시 자동으로 동기화되는 기능입니다.

#### 신규 파일

| 파일 | 설명 |
|------|------|
| `worker/index.ts` | 커스텀 Service Worker (sync, push 이벤트 핸들러) |
| `lib/sync/sync-manager.ts` | 동기화 큐 관리 및 실행 |
| `lib/sync/conflict-resolver.ts` | 충돌 감지 및 해결 로직 |
| `components/sync/SyncStatusIndicator.tsx` | 동기화 상태 표시 UI |

#### 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `next.config.ts` | `customWorkerDir: "worker"`, `fallbacks` 설정 추가 |

#### 브라우저 지원

| 브라우저 | Background Sync | 대체 방식 |
|----------|----------------|----------|
| Chrome | O | - |
| Edge | O | - |
| Firefox | X | 온라인 이벤트 기반 |
| Safari | X | 온라인 이벤트 기반 |

#### 재시도 정책
- 최대 재시도 횟수: 3회
- 재시도 간격: 지수 백오프 (1분, 2분, 4분)

---

### 3. 웹 푸시 알림 (Web Push Notification)

결재 이벤트 발생 시 브라우저 푸시 알림을 받을 수 있는 기능입니다.

#### 추가된 패키지
```bash
npm install web-push
npm install -D @types/web-push
```

#### Prisma 스키마 변경

```prisma
// NotificationChannel enum에 추가
WEB_PUSH

// NotificationPreference 모델에 추가
webPushEnabled  Boolean  @default(true)

// 신규 모델
model PushSubscription {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(...)
  endpoint    String   @db.Text
  p256dh      String   @db.Text
  auth        String   @db.Text
  userAgent   String?  @db.Text
  deviceName  String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([userId, endpoint])
  @@index([userId])
}

model WebPushLog {
  id              String   @id @default(cuid())
  subscriptionId  String
  eventType       NotificationEventType
  expenseId       String?
  status          String
  errorMessage    String?  @db.Text
  createdAt       DateTime @default(now())
  @@index([subscriptionId])
  @@index([expenseId])
}
```

#### 신규 파일

| 파일 | 설명 |
|------|------|
| `lib/services/notification/web-push-provider.ts` | VAPID 기반 웹 푸시 발송 |
| `app/api/push/vapid-public-key/route.ts` | GET: VAPID 공개키 반환 |
| `app/api/push/subscribe/route.ts` | POST: 푸시 구독 등록 |
| `app/api/push/unsubscribe/route.ts` | POST: 푸시 구독 해제 |
| `app/api/push/test/route.ts` | POST: 테스트 알림 발송 |
| `lib/hooks/usePushNotification.ts` | 푸시 알림 관리 훅 |

#### 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/services/notification/notification-service.ts` | WEB_PUSH 채널 추가, `sendToChannel`에 웹 푸시 처리 로직 |

#### 필요한 환경 변수

```bash
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@example.com"
```

#### VAPID 키 생성 방법
```bash
npx web-push generate-vapid-keys
```

---

## 파일 변경 요약

### 신규 파일 (20개)

```
lib/db/
├── types.ts
├── index.ts
├── expense-store.ts
└── attachment-store.ts

lib/sync/
├── sync-manager.ts
├── conflict-resolver.ts
└── index.ts

lib/hooks/
├── useOnlineStatus.ts
├── useOfflineExpense.ts
└── usePushNotification.ts

lib/services/notification/
└── web-push-provider.ts

components/offline/
├── OfflineBanner.tsx
├── DraftList.tsx
└── index.ts

components/sync/
├── SyncStatusIndicator.tsx
└── index.ts

app/api/push/
├── vapid-public-key/route.ts
├── subscribe/route.ts
├── unsubscribe/route.ts
└── test/route.ts

worker/
└── index.ts
```

### 수정된 파일 (5개)

| 파일 | 변경 내용 |
|------|----------|
| `package.json` | dexie, uuid, web-push 의존성 추가 |
| `next.config.ts` | customWorkerDir, fallbacks 설정 |
| `prisma/schema.prisma` | PushSubscription, WebPushLog 모델 추가 |
| `lib/hooks/useExpenseFormSubmit.ts` | 오프라인 저장 로직 추가 |
| `lib/services/notification/notification-service.ts` | WEB_PUSH 채널 지원 |
| `PWA_GUIDE.md` | 구현된 기능 문서화 |

---

## 배포 전 체크리스트

- [ ] VAPID 키 생성 및 환경 변수 설정
- [ ] `npx prisma db push` 실행 (PushSubscription 테이블 생성)
- [ ] Service Worker 빌드 확인 (`npm run build`)
- [ ] 웹 푸시 테스트 (`/api/push/test`)

---

## 테스트 방법

### 오프라인 저장 테스트
1. Chrome DevTools > Network > Offline 활성화
2. 지출결의서 작성 후 저장
3. Application > IndexedDB에서 데이터 확인
4. 온라인 복귀 후 자동 동기화 확인

### 백그라운드 동기화 테스트
1. 오프라인에서 제출 시도
2. Application > Service Workers > Background Sync 확인
3. 온라인 복귀 시 자동 재전송 확인

### 웹 푸시 테스트
1. 권한 요청 후 구독 등록
2. `/api/push/test` API 호출
3. 브라우저 알림 수신 확인

---

## 커밋 정보

```
commit 5367c26
Author: [작성자]
Date: 2026-03-03

feat: PWA 고급 기능 구현 (웹 푸시, 백그라운드 동기화, 오프라인 저장)

- 웹 푸시 알림: VAPID 기반 web-push 연동, API 엔드포인트 추가
- 백그라운드 동기화: Custom Service Worker, SyncManager 구현
- 오프라인 데이터 저장: Dexie.js 기반 IndexedDB 저장소 구현
- notification-service에 WEB_PUSH 채널 추가
- Prisma 스키마에 PushSubscription 모델 추가
- PWA_GUIDE.md 업데이트
```

---

*작성일: 2026-03-03*
