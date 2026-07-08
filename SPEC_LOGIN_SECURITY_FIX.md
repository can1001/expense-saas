# 로그인 보안 취약점 수정 스펙

## 1. 목표 (Objective)

### 문제 정의
로그인 폼 제출 시 JavaScript가 로드되기 전에 폼이 제출되면 기본 HTML form 동작으로 GET 요청이 발생하여 사용자의 비밀번호가 URL에 노출됨.

**현재 동작:**
```
POST /login?tenant=chungyeon (정상 접속)
→ 로그인 버튼 클릭
→ GET /login?userid=xxx&password=xxx (비밀번호 노출!)
```

### 보안 위험
1. **URL 노출**: 비밀번호가 브라우저 주소창에 표시
2. **히스토리 저장**: 브라우저 히스토리에 비밀번호 기록
3. **서버 로그**: 웹 서버 액세스 로그에 비밀번호 기록
4. **Referrer 헤더**: 다른 페이지로 이동 시 Referrer 헤더에 포함될 수 있음

### 해결 방안
1. 폼의 기본 동작을 POST로 변경
2. JavaScript 로드 전 폼 제출 방지
3. tenant 파라미터 유지 보장

### 대상 사용자
- 모든 로그인 사용자 (테넌트 사용자, 플랫폼 관리자)

### 성공 기준
- [ ] 로그인 시 비밀번호가 URL에 절대 노출되지 않음
- [ ] JavaScript 비활성화 상태에서도 비밀번호 노출 없음
- [ ] tenant 파라미터가 로그인 프로세스 전체에서 유지됨
- [ ] 정상적인 로그인 기능 유지

---

## 2. 핵심 수정사항 (Commands)

### 2.1 app/login/page.tsx

**변경 전:**
```tsx
<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
  <input name="userid" ... />
  <input name="password" ... />
</form>
```

**변경 후:**
```tsx
<form
  className="mt-8 space-y-6"
  onSubmit={handleSubmit}
  method="post"
  action="/api/auth/login-fallback"
>
  {/* tenant 파라미터 hidden으로 유지 */}
  <input type="hidden" name="tenant" value={tenantSubdomain} />

  {/* 비밀번호 필드는 name 제거하여 GET 제출 시 URL에 포함 안 됨 */}
  <input id="userid" ... />
  <input id="password" ... />
</form>
```

### 2.2 보안 강화 옵션

**Option A: name 속성 동적 추가 (권장)**
- JavaScript 로드 후에만 name 속성 추가
- JS 없이는 폼 데이터가 전송되지 않음

**Option B: POST fallback 엔드포인트**
- `/api/auth/login-fallback` 엔드포인트 생성
- POST로 제출되어도 처리 가능

**Option C: novalidate + required 제거**
- JS 로드 전 제출 자체를 어렵게 만듦

---

## 3. 수정 대상 파일

```
app/
├── login/
│   └── page.tsx              # 테넌트 로그인 폼 수정
└── platform/
    └── login/
        └── page.tsx          # 플랫폼 로그인 폼 수정 (동일 패턴 적용)
```

---

## 4. 코드 스타일

### 폼 보안 패턴
```tsx
// 1. 기본 method를 POST로 설정
<form method="post" action="/api/auth/login" onSubmit={handleSubmit}>

// 2. 민감한 필드는 JS 로드 후 name 추가
const [isHydrated, setIsHydrated] = useState(false);
useEffect(() => setIsHydrated(true), []);

<input
  type="password"
  id="password"
  name={isHydrated ? "password" : undefined}  // JS 로드 전에는 name 없음
  autoComplete="current-password"
/>

// 3. hidden 필드로 컨텍스트 유지
<input type="hidden" name="tenant" value={tenant} />
```

---

## 5. 테스트 전략

### 수동 테스트 체크리스트

**보안 테스트:**
- [ ] 로그인 버튼 클릭 후 URL에 password 파라미터 없음
- [ ] 브라우저 개발자도구 Network 탭에서 POST 요청 확인
- [ ] JavaScript 비활성화 후 로그인 시도 → 비밀번호 노출 없음
- [ ] 서버 로그에 비밀번호 기록 없음

**기능 테스트:**
- [ ] 정상 로그인 성공
- [ ] 잘못된 비밀번호 시 에러 메시지 표시
- [ ] tenant 파라미터 유지 확인
- [ ] "아이디 기억하기" 기능 정상 동작
- [ ] 로그인 후 원래 페이지로 리다이렉트

**엣지 케이스:**
- [ ] 빠른 더블 클릭 시 중복 요청 방지
- [ ] 네트워크 오류 시 적절한 에러 처리
- [ ] 모바일 브라우저에서 정상 동작

---

## 6. 경계 조건 (Boundaries)

### 항상 해야 할 것 (Always Do)
- 폼 method를 "post"로 설정
- 민감한 데이터는 POST body로만 전송
- HTTPS 환경에서만 로그인 허용 (production)
- CSRF 토큰 검증 (향후)

### 확인이 필요한 것 (Ask First)
- JavaScript 비활성화 사용자 지원 범위
- 로그인 실패 시 보안 로깅 정책

### 절대 하면 안 되는 것 (Never Do)
- 비밀번호를 GET 파라미터로 전송
- 비밀번호를 URL에 포함
- 비밀번호를 로그에 기록
- 비밀번호를 평문으로 저장

---

## 7. 구현 순서

1. **Phase 1: 즉시 수정**
   - `app/login/page.tsx` 폼 수정
   - `app/platform/login/page.tsx` 폼 수정

2. **Phase 2: 테스트**
   - 수동 테스트 수행
   - 보안 테스트 확인

3. **Phase 3: 코드 리뷰**
   - 보안 관점 리뷰
   - 엣지 케이스 확인

---

## 8. 관련 파일 참조

- `SPEC_MULTI_TENANCY.md` - 멀티테넌시 스펙 (인증 체계 섹션)
- `app/api/auth/login/route.ts` - 로그인 API
- `middleware.ts` - 테넌트 파라미터 처리
