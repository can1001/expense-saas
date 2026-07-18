# 카카오 로그인 설정 가이드

> 2026-07-18 M3 게이트 완료 기준. 아키텍처/보안 설계는
> [EXP-2026-ARC-003-kakao-login.md](./EXP-2026-ARC-003-kakao-login.md),
> 계정 매칭 정책은 [AUTH_ACCOUNT_MATCHING_POLICY.md](./AUTH_ACCOUNT_MATCHING_POLICY.md) 참고.

## 개요 (동작 흐름)

```
[브라우저]                         [서버]                        [카카오]
로그인 페이지에서 카카오 버튼 클릭
  → Kakao.Auth.login() 팝업 ──────────────────────────────────→ 동의/인증
  ← access_token ←──────────────────────────────────────────────┘
  → POST /api/auth/kakao ────→ kapi.kakao.com/v2/user/me 검증 ─→
                               (회원번호만 사용, 토큰은 세션에 쓰지 않음)
                               AuthAccount(provider=kakao) 조회
  ← 자체 JWT(user_token 쿠키) ←┘   연결 없으면 linked:false → 초대 안내 화면
```

- 카카오 토큰은 **"누구인지" 확인에만** 사용하고, 세션은 항상 자체 JWT로 발급한다.
- 이메일 자동 병합은 하지 않는다 — 신규 사용자는 **초대 토큰**(`/invite/[token]`)으로만 연결된다.
- 소속(테넌트) 결정은 일반 로그인과 동일하게 Membership이 담당한다.

## 카카오 개발자 콘솔 설정

| 항목 | 값/상태 | 비고 |
|---|---|---|
| 앱 | **지출결의서 SaaS** (ID `1517130`) | [developers.kakao.com/console/app/1517130](https://developers.kakao.com/console/app/1517130) |
| 카카오 로그인 | **ON** | 제품 설정 > 카카오 로그인 > 일반 |
| OpenID Connect | **OFF 유지** | 서버가 액세스 토큰+kapi 방식만 지원. `KAKAO_USE_OIDC=true`면 503 — 코드 지원 전까지 켜지 말 것 |
| JS SDK 도메인 | `http://localhost:3000`<br>`https://chungyeon-consulting.expense-saas.com`<br>`https://expense-saas.com` | 앱 설정 > 앱 > 플랫폼 키 > Default JS Key 수정. **미등록 도메인에서는 JS 키 사용 불가** |
| 리다이렉트 URI | 미등록 | 팝업 방식(`Kakao.Auth.login`)이라 불필요. SDK v2(authorize)로 전환 시 필요 |
| 동의항목 | 설정 안 함 | 회원번호(id)만 사용하므로 추가 동의 불필요 |
| 키 해시 | 해당 없음 | Android 네이티브 전용 |

### ⚠️ 새 테넌트 오픈 시 필수 절차

JS SDK 도메인은 **와일드카드를 지원하지 않는다**. 새 테넌트 서브도메인
(예: `newchurch.expense-saas.com`)을 오픈하면 콘솔의 **Default JS Key 수정 화면에서
해당 도메인을 추가**해야 그 테넌트에서 카카오 버튼이 동작한다.

## 환경변수

`.env` (로컬) / Render 환경변수 (운영) — 실제 키 값은 콘솔의 "플랫폼 키" 페이지에서 확인:

```bash
KAKAO_REST_API_KEY="<REST API 키>"       # 서버측 kapi 토큰 검증용. 미설정 시 카카오 로그인 API가 503
NEXT_PUBLIC_KAKAO_JS_KEY="<JavaScript 키>" # 클라이언트 SDK 로드·초기화용. 미설정 시 SDK 미로드 → 버튼이 안내만 표시
KAKAO_USE_OIDC="false"                    # OIDC 분기 — 현재 미지원 (true 시 503)
```

- 두 키 모두 미설정이어도 **코드는 죽지 않는다** (graceful degradation — 버튼 안내/503).
- `NEXT_PUBLIC_*`은 빌드 타임에 번들에 박히므로, Render에서는 **빌드 환경변수**로 설정해야 한다.

## 관련 코드

| 파일 | 역할 |
|---|---|
| `components/KakaoSdkLoader.tsx` | JS 키 설정 시에만 구(v1) SDK 로드 + `Kakao.init()` (`app/layout.tsx`에서 렌더) |
| `lib/services/kakao.ts` | `verifyKakaoAccessToken()` — kapi 검증, 회원번호 추출 |
| `lib/auth/kakao-verify.ts` | 검증 에러 → HTTP 응답 매핑 공용 헬퍼 |
| `app/api/auth/kakao/route.ts` | 카카오 로그인 (검증 → AuthAccount 조회 → 자체 JWT 발급) |
| `app/api/auth/link-kakao/route.ts` | 기존 가입자의 카카오 연결/해제 (마이페이지) |
| `app/api/auth/accept-invitation/route.ts` | 초대 토큰 + 카카오 결합 가입 |
| `app/login/page.tsx`, `app/invite/[token]/page.tsx`, `app/mypage/kakao/page.tsx` | 버튼 UI (SDK 부재 시 안내) |

주의: 로그인 버튼들은 `Kakao.Auth.login`(**v1 SDK 팝업 콜백**)을 사용한다.
SDK v2(`kakao_js_sdk`)는 이 API가 없으므로, 로더의 SDK URL을 바꾸려면 버튼 코드도 함께
`Kakao.Auth.authorize`(리다이렉트) 방식으로 전환하고 콘솔에 리다이렉트 URI를 등록해야 한다.

## API 에러 매핑

| 상황 | 응답 |
|---|---|
| `KAKAO_REST_API_KEY` 미설정 | 503 "카카오 로그인이 설정되지 않았습니다" |
| `KAKAO_USE_OIDC=true` (미지원) | 503 "카카오 OIDC 로그인은 아직 지원되지 않습니다" |
| 카카오 토큰 만료/위조 | 401 "카카오 토큰 검증에 실패했습니다" |
| 검증 성공, AuthAccount 연결 없음 | 200 `{ linked: false }` → 초대 안내 화면 (JWT 미발급) |

## 로컬 테스트

```bash
pnpm run dev
# http://localhost:3000/login?tenant=chungyeon-consulting → "카카오로 로그인" 클릭
```

- SDK 로드 확인: 개발자도구 콘솔에서 `window.Kakao.isInitialized()` → `true`
- 연결된 계정이 없으면 "초대가 필요합니다" 화면이 정상 (자동 가입 안 됨 — 의도된 동작)

## 운영 배포 체크리스트

- [ ] Render 환경변수에 `KAKAO_REST_API_KEY`, `NEXT_PUBLIC_KAKAO_JS_KEY` 설정 (JS 키는 빌드 시 주입)
- [ ] 서비스 도메인이 콘솔 JS SDK 도메인 목록에 있는지 확인
- [ ] 배포 후 로그인 페이지에서 카카오 버튼 클릭 → 팝업 → 초대 안내/로그인 동작 확인
