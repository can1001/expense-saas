# 계정 매칭 정책 — AuthAccount (이메일 자동 병합 금지)

> **기준 설계**: `docs/EXP-2026-ARC-003-kakao-login.md` §4
> **점검일**: 2026-07-18 (C5 보안 점검)
> **적용 범위**: 카카오 등 모든 소셜 로그인 provider (naver/google 확장 시에도 동일 적용)

## 1. 원칙

**소셜 프로필의 이메일로 기존 User를 조회·연결(자동 병합)하는 것을 금지한다. 예외 없음.**

카카오 이메일은 선택 동의 항목이라 없을 수 있고, 있어도 사용자가 카카오 계정에서
변경할 수 있다. "카카오 이메일 == 기존 가입 이메일이면 자동 병합" 정책은
공격자가 피해자 이메일로 카카오 계정을 만들어 기존 계정을 탈취하는 벡터가 된다
(ARC-003 §4.1).

계정 매칭의 유일한 식별 키는 **`AuthAccount(provider, providerUserId)`**
(카카오는 회원번호)이며, 연결(link)은 아래 표의 **본인 증명이 있는 경로**에서만
수행한다.

## 2. 매칭 정책 — 3-시나리오 (ARC-003 §4.2)

| 시나리오 | 처리 | 본인 증명 | 구현 |
|---|---|---|---|
| 초대받은 신규 사용자 | 초대 링크 진입 → 카카오 로그인 → 그 자리에서 User 생성 + AuthAccount 연결 | **초대 토큰** | `POST /api/auth/accept-invitation` (`lib/services/invitation.ts`) |
| 기존 가입자의 카카오 연결 | 로그인 상태에서 "카카오 계정 연결" 메뉴로 연결 | **로그인 세션** | `POST /api/auth/link-kakao` (`linkAuthAccount`) |
| 초대 없이 카카오로 진입한 신규 사용자 | 연결·소속 없음 → `linked: false` 응답 → "초대를 받아야 사용 가능" 안내 화면 | (없음 — 아무것도 생성하지 않음) | `POST /api/auth/kakao` + `app/login` 안내 상태 |

위 세 가지 외의 매칭·병합 경로는 존재하지 않으며, 추가하지 않는다.
특히 다음은 **금지**:

- 카카오 프로필 email → `User` 조회 후 자동 연결
- 카카오 프로필 email → 기존 `AuthAccount(provider: "email")` 조회 후 자동 연결
- `linked: false` 상황에서 서버가 임의로 User를 생성하거나 유사 계정을 추천

## 3. 코드 감사 결과 (2026-07-18)

### 3.1 전수 grep — email 기반 조회 부재

```bash
grep -rn "email" app/api/auth lib/services/kakao.ts lib/services/auth-account.ts \
  | grep -iE "find|where|match"
# → (결과 없음)
```

유일한 email 문자열 사용처는 `lib/services/invitation.ts`의
`provider: "email"` AuthAccount 처리(아이디/비밀번호 로그인 수단의 provider 명칭)로,
카카오 프로필 email과 무관한 **userid 기반** 중복 검사다.

### 3.2 구조적 근거

- `User` 모델에 **email 컬럼 자체가 없다** (`prisma/schema.prisma`) —
  email 기반 매칭이 구조적으로 불가능하다. 로그인 식별자는 `userid`.
- `verifyKakaoAccessToken()`(`lib/services/kakao.ts`)은 kapi 응답에서
  **회원번호(`id`)만 추출**해 `{ providerUserId }`로 반환한다. 카카오 프로필의
  email·닉네임 등은 응답 파싱 단계에서 폐기되어 이후 코드에 전달되지 않는다.
- `POST /api/auth/kakao`는 `findUserByProvider('kakao', providerUserId)` 단일
  경로로만 조회하며, 미연결 시 JWT·쿠키 발급 없이 `linked: false`를 반환한다.
- `linkAuthAccount()`는 대상 회원번호가 이미 다른 User에 연결돼 있으면
  한국어 에러로 거부한다 (계정 탈취 방지).

## 4. 회귀 방지 테스트

- `lib/services/__tests__/kakao.test.ts` — kapi 응답에 `kakao_account.email`이
  포함돼도 반환값은 `providerUserId`뿐 (email 폐기).
- `app/api/auth/__tests__/kakao.test.ts` — 카카오 프로필 email이 기존 유저의
  로그인 수단과 같아도, 회원번호 미연결이면 `linked: false` + User 테이블
  email/userid 조회 없음.

새 provider(naver/google)를 추가할 때는 이 문서의 정책을 그대로 따르고,
동일한 회귀 테스트를 provider별로 추가한다.
