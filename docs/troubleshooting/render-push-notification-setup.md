# Render 푸시 알림 환경 변수 설정 가이드

## 필수 환경 변수

Render 대시보드에서 다음 **3개의 환경 변수**를 설정해야 합니다:

| 환경 변수 | 설명 | 예시 |
|-----------|------|------|
| `VAPID_PUBLIC_KEY` | VAPID 공개키 | `BEl62i...` (긴 문자열) |
| `VAPID_PRIVATE_KEY` | VAPID 개인키 | `UUxI4O...` (긴 문자열) |
| `VAPID_SUBJECT` | 연락처 이메일 | `mailto:admin@yourchurch.org` |

---

## VAPID 키 생성 방법

로컬에서 다음 명령어로 키를 생성합니다:

```bash
npx web-push generate-vapid-keys
```

출력 예시:

```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8-FbRouADVXc-hK3ltm...

=======================================
```

> **주의**: 생성된 키는 안전하게 보관하세요. 개인키가 유출되면 새로운 키 쌍을 생성해야 합니다.

---

## Render 설정 단계

1. [Render 대시보드](https://dashboard.render.com/) 접속
2. 해당 서비스 선택 (예: `expense-system`)
3. **Environment** 탭 클릭
4. **Add Environment Variable** 클릭
5. 다음 변수들을 추가:

   ```
   VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa...
   VAPID_PRIVATE_KEY=UUxI4O8-FbRouADVXc-hK3ltm...
   VAPID_SUBJECT=mailto:admin@yourchurch.org
   ```

6. **Save Changes** 클릭
7. 서비스가 자동으로 재배포됨

---

## 설정 확인 방법

### 1. API 엔드포인트 확인

배포 후 다음 URL에 접속:

```
https://your-app.onrender.com/api/push/vapid-public-key
```

정상 응답:
```json
{
  "publicKey": "BEl62iUYgUivxIkv69yViEuiBIa..."
}
```

오류 응답 (키 미설정):
```json
{
  "error": "VAPID 키가 설정되지 않았습니다."
}
```

### 2. 테스트 알림 발송

마이페이지 → 알림 설정에서 "테스트 알림 보내기" 버튼으로 확인

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `lib/services/notification/web-push-provider.ts` | VAPID 키 사용 및 푸시 발송 로직 |
| `app/api/push/vapid-public-key/route.ts` | 공개키 반환 API |
| `app/api/push/subscribe/route.ts` | 구독 등록 API |
| `app/api/push/test/route.ts` | 테스트 알림 API |
| `lib/hooks/usePushNotification.ts` | 클라이언트 푸시 훅 |

---

## 문제 해결

### "VAPID 키가 설정되지 않았습니다" 오류

- Render 환경 변수가 올바르게 설정되었는지 확인
- 변수명에 오타가 없는지 확인 (대소문자 구분)
- 서비스가 재배포되었는지 확인

### 알림이 도착하지 않음

1. 브라우저 알림 권한이 허용되었는지 확인
2. HTTPS 환경인지 확인 (localhost 제외)
3. 서비스 워커가 등록되었는지 개발자 도구에서 확인
4. 구독 정보가 서버에 저장되었는지 확인

---

*작성일: 2026-03-04*
