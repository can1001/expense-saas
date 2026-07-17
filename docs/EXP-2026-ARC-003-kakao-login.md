# 지출결의서 SaaS 소셜 로그인(카카오) 연동 설계서

| 항목 | 내용 |
|---|---|
| 문서번호 | EXP-2026-ARC-003 |
| 프로젝트 | expense-saas (지출결의서 플랫폼) |
| 대상 | 카카오 로그인 (추후 네이버·구글 확장 고려) |
| 작성일 | 2026-07-18 |
| 작성 | ㈜청연컨설팅 |
| 관련문서 | EXP-2026-ARC-001 (멀티테넌트 아키텍처), EXP-2026-ARC-002 (모바일 멀티테넌시) |

---

## 1. 설계 원칙

**소셜 로그인은 "이 사람이 누구인지"만 담당한다. "어느 조직 소속인지"는 여전히 Membership이 결정한다.**

인증(Authentication)과 테넌트 소속(Membership)을 분리하면, 카카오를 붙여도 ARC-002의 토큰 스코프·조직 전환·FCM 구조가 그대로 유지된다.

## 2. 인증 흐름

```
[앱] Kakao Android SDK 로그인 → 카카오 액세스 토큰 획득
  → [서버] POST /auth/kakao { kakaoAccessToken }
  → [서버] kapi.kakao.com/v2/user/me 호출 — 토큰 검증 + 프로필(회원번호) 조회
  → AuthAccount에서 기존 연결 계정 조회 또는 신규 연결
  → 자체 JWT 발급 (tenantId 클레임 포함 — ARC-002 §3 구조 유지)
```

### 핵심 규칙

| 규칙 | 이유 |
|---|---|
| 카카오 토큰을 자체 세션으로 사용하지 않는다 | 검증 후 **자체 JWT로 교환** — 이후 API 스코프·조직 전환·FCM이 기존 구조 그대로 동작 |
| 카카오 토큰 검증은 반드시 서버에서 | 앱이 보낸 토큰을 신뢰하지 않고 kapi(또는 OIDC) 검증 |

## 3. 소셜 계정 연결 모델

`User`에 kakaoId 컬럼을 직접 추가하지 않고 별도 테이블로 분리한다. 네이버·구글 추가 시 스키마 변경이 없다.

```prisma
model AuthAccount {
  id             String @id @default(cuid())
  userId         String
  user           User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       String // "kakao" | "email" | "naver" | "google" ...
  providerUserId String // 카카오 회원번호(id)
  createdAt      DateTime @default(now())

  @@unique([provider, providerUserId])
  @@index([userId])
}
```

- 하나의 User에 복수 AuthAccount 연결 가능 (이메일 + 카카오 병행).
- 이메일/비밀번호 로그인도 `provider: "email"`인 AuthAccount로 통일하면 인증 경로가 일원화된다.

## 4. 계정 매칭 — 가장 중요한 함정

### 4.1 위험

카카오 이메일은 **선택 동의 항목이라 없을 수 있고, 있어도 사용자가 변경 가능하다.**

→ "카카오 이메일 == 기존 가입 이메일이면 자동 병합" 정책은 **계정 탈취 벡터**가 된다. 금지.

### 4.2 안전한 매칭 정책 (초대 기반)

B2B SaaS 특성상 사용자는 테넌트 어드민의 **초대**로 유입된다. 이를 본인 증명 수단으로 활용한다.

| 시나리오 | 처리 |
|---|---|
| 초대받은 신규 사용자 | 초대 이메일의 링크/코드로 진입 → 카카오 로그인 → 그 자리에서 AuthAccount 연결. **초대 토큰이 본인 증명 역할** |
| 기존 이메일 가입자의 카카오 연결 | 로그인된 상태에서 "카카오 계정 연결" 메뉴로 연결 (세션이 본인 증명) |
| 초대 없이 카카오로 진입한 신규 사용자 | 소속 테넌트 없음 → "초대를 받아야 사용 가능" 안내 화면 |

## 5. 구현 옵션: OIDC

카카오 개발자 콘솔에서 **OpenID Connect 활성화** 시:

- 로그인 응답에 `id_token`(JWT) 포함 → 서버가 공개키로 서명 검증
- `kapi.kakao.com/v2/user/me` 호출 1회 절감
- 검증 항목: 서명, `iss`(kauth.kakao.com), `aud`(앱 키), `exp`

초기 구현은 액세스 토큰 + kapi 방식으로 시작해도 무방하나, OIDC가 호출 비용·표준성 면에서 우세.

## 6. 제품 관점 참고

교회 테넌트에 카카오 로그인 효과가 특히 크다. 장년층 사용자에게 이메일/비밀번호 대비 진입 장벽이 현저히 낮아, 청연교회 파일럿에서 채택률 차이가 체감될 것으로 예상. **CHURCH 파일럿 전 카카오 연동 완료를 권장.**

## 7. 구현 체크리스트

- [ ] 카카오 개발자 콘솔: 앱 등록, Android 키 해시 등록, (권장) OIDC 활성화
- [ ] `AuthAccount` 모델 추가, 기존 이메일 로그인도 `provider: "email"`로 통합
- [ ] `POST /auth/kakao` — 토큰 검증 + AuthAccount 조회/연결 + 자체 JWT 발급
- [ ] 초대 플로우: 초대 토큰 + 카카오 로그인 결합 (초대 수락 시 AuthAccount 연결)
- [ ] 로그인 상태에서 "카카오 계정 연결" 메뉴
- [ ] 초대 없는 신규 카카오 사용자 → 안내 화면 (테넌트 미소속 상태 처리)
- [ ] 이메일 자동 병합 경로 부재 확인 (보안 점검)
- [ ] 앱: Kakao Android SDK 연동, 로그인 버튼 (카카오 디자인 가이드 준수)
