# 브라우저에서 푸시 알림 구독하기

## 사전 조건

- VAPID 키가 서버에 설정되어 있어야 함
- HTTPS 환경 (localhost는 예외)
- 지원 브라우저: Chrome, Firefox, Edge, Safari (iOS 16.4+)

---

## 방법 1: 브라우저 콘솔에서 직접 실행

### 단계별 안내

1. **http://localhost:4001 접속 후 로그인**

2. **개발자 도구 열기**
   - Windows/Linux: `F12` 또는 `Ctrl+Shift+I`
   - Mac: `Cmd+Option+I`

3. **Console 탭에서 아래 코드 실행:**

```javascript
// 1. VAPID 공개키 가져오기
const keyRes = await fetch('/api/push/vapid-public-key');
const { publicKey } = await keyRes.json();
console.log('VAPID 키:', publicKey);

// 2. 알림 권한 요청
const permission = await Notification.requestPermission();
console.log('알림 권한:', permission);

if (permission !== 'granted') {
  throw new Error('알림 권한이 거부되었습니다.');
}

// 3. 서비스 워커 준비
const registration = await navigator.serviceWorker.ready;
console.log('서비스 워커 준비됨');

// 4. 푸시 구독
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: publicKey
});
console.log('구독 정보:', subscription);

// 5. 서버에 구독 등록
const res = await fetch('/api/push/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subscription: subscription.toJSON(),
    deviceName: navigator.userAgent.includes('Mobile') ? '모바일' : 'PC 브라우저'
  })
});
const result = await res.json();
console.log('구독 등록 결과:', result);
```

4. **테스트 푸시 발송:**

```javascript
const testRes = await fetch('/api/push/test', { method: 'POST' });
console.log('테스트 푸시:', await testRes.json());
```

5. **알림 팝업이 표시되면 성공!**

---

## 방법 2: 한 줄 코드 (복사-붙여넣기용)

```javascript
(async()=>{const k=await(await fetch('/api/push/vapid-public-key')).json();if(await Notification.requestPermission()!=='granted')throw'권한 거부';const r=await navigator.serviceWorker.ready;const s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:k.publicKey});await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:s.toJSON(),deviceName:'Browser'})});const t=await(await fetch('/api/push/test',{method:'POST'})).json();console.log('결과:',t)})()
```

---

## 구독 상태 확인

```javascript
// 현재 구독 상태 확인
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();
console.log('현재 구독:', sub ? '구독 중' : '미구독');
if (sub) console.log('엔드포인트:', sub.endpoint);
```

---

## 구독 해제

### 브라우저에서 해제
```javascript
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();
if (sub) {
  await sub.unsubscribe();
  console.log('브라우저 구독 해제됨');
}
```

### 서버에서 해제
```javascript
// 특정 구독 해제
await fetch('/api/push/unsubscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ endpoint: '구독_엔드포인트_URL' })
});

// 모든 구독 해제
await fetch('/api/push/unsubscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ all: true })
});
```

---

## 문제 해결

### "VAPID 키가 설정되지 않았습니다"
```bash
# .env 파일에 VAPID 키 설정
npx web-push generate-vapid-keys

# 출력된 키를 .env에 추가
VAPID_PUBLIC_KEY="생성된_공개키"
VAPID_PRIVATE_KEY="생성된_개인키"
VAPID_SUBJECT="mailto:admin@example.com"
```

### "알림 권한이 거부되었습니다"
1. 브라우저 주소창 왼쪽 자물쇠/정보 아이콘 클릭
2. "알림" 권한을 "허용"으로 변경
3. 페이지 새로고침 후 다시 시도

### "서비스 워커를 찾을 수 없습니다"
1. 개발자 도구 → Application → Service Workers 확인
2. `sw.js`가 활성화되어 있는지 확인
3. 없으면 페이지 새로고침 또는 캐시 삭제 후 재시도

### iOS Safari에서 동작하지 않음
- iOS 16.4 이상 필요
- **PWA로 홈 화면에 추가**해야 푸시 알림 동작
- Safari 브라우저에서 직접 열면 동작하지 않음

---

## 브라우저별 지원 현황

| 브라우저 | 데스크톱 | 모바일 | 비고 |
|---------|---------|--------|------|
| Chrome | ✅ | ✅ | 완전 지원 |
| Firefox | ✅ | ✅ | 완전 지원 |
| Edge | ✅ | ✅ | 완전 지원 |
| Safari (macOS) | ✅ | - | macOS 13+ |
| Safari (iOS) | - | ⚠️ | PWA 모드에서만, iOS 16.4+ |
| Samsung Internet | - | ✅ | 완전 지원 |

---

## 관련 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/push/vapid-public-key` | GET | VAPID 공개키 조회 |
| `/api/push/subscribe` | POST | 푸시 구독 등록 |
| `/api/push/unsubscribe` | POST | 푸시 구독 해제 |
| `/api/push/test` | POST | 테스트 푸시 발송 |
