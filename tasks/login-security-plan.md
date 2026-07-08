# 로그인 보안 취약점 수정 계획

## 개요

**스펙 문서**: `SPEC_LOGIN_SECURITY_FIX.md`
**목표**: GET 방식으로 비밀번호가 노출되는 보안 취약점 수정

---

## 현재 상태 분석

### 영향받는 파일

| 파일 | 문제점 | 우선순위 |
|------|--------|----------|
| `app/login/page.tsx` | form method 미지정, name 속성 상시 존재 | P0 |
| `app/platform/login/page.tsx` | 동일한 문제 | P0 |

### 의존성 그래프

```
app/login/page.tsx
├── useSearchParams() → tenant 파라미터 읽기
├── /api/tenant/info → 테넌트 정보 조회
└── /api/auth/login → 로그인 API (POST)

app/platform/login/page.tsx
└── /api/platform/auth/login → 플랫폼 로그인 API (POST)
```

---

## 구현 태스크

### Phase 1: 테넌트 로그인 페이지 수정

#### Task 1.1: app/login/page.tsx 보안 강화

**작업 내용:**
1. `isHydrated` 상태 추가 (클라이언트 하이드레이션 감지)
2. form에 `method="post"` 추가
3. password 필드의 `name` 속성을 하이드레이션 후에만 추가
4. tenant 파라미터를 상태로 관리하여 로그인 요청에 포함

**수락 기준:**
- [ ] JS 로드 전 폼 제출 시 비밀번호가 URL에 노출되지 않음
- [ ] 정상 로그인 기능 동작
- [ ] tenant 파라미터가 로그인 과정에서 유지됨

---

### Phase 2: 플랫폼 로그인 페이지 수정

#### Task 2.1: app/platform/login/page.tsx 보안 강화

**작업 내용:**
1. `isHydrated` 상태 추가
2. form에 `method="post"` 추가
3. password 필드의 `name` 속성을 하이드레이션 후에만 추가

**수락 기준:**
- [ ] JS 로드 전 폼 제출 시 비밀번호가 URL에 노출되지 않음
- [ ] 정상 로그인 기능 동작

---

### Phase 3: 통합 테스트

#### Task 3.1: 보안 테스트
- [ ] 테넌트 로그인 - 비밀번호 URL 미노출
- [ ] 플랫폼 로그인 - 비밀번호 URL 미노출
- [ ] 서버 로그에 비밀번호 기록 없음

#### Task 3.2: 기능 테스트
- [ ] 테넌트 로그인 성공/실패
- [ ] 플랫폼 로그인 성공/실패
- [ ] 아이디 기억하기 기능

---

## 체크포인트

| 체크포인트 | 완료 조건 | 상태 |
|------------|----------|------|
| CP1 | Task 1.1 완료, 테넌트 로그인 테스트 통과 | Pending |
| CP2 | Task 2.1 완료, 플랫폼 로그인 테스트 통과 | Pending |
| CP3 | 모든 통합 테스트 통과 | Pending |

---

## 예상 변경 코드 패턴

```tsx
// Before
<form onSubmit={handleSubmit}>
  <input name="password" type="password" ... />
</form>

// After
const [isHydrated, setIsHydrated] = useState(false);
useEffect(() => setIsHydrated(true), []);

<form method="post" action="#" onSubmit={handleSubmit}>
  <input
    type="password"
    name={isHydrated ? "password" : undefined}
    ...
  />
</form>
```
