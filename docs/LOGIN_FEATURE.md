# 로그인 기능 분석 및 설계 문서

## 1. 개요

지출결의서 시스템에 간단한 아이디 기반 로그인 기능을 추가합니다.
비밀번호 없이 아이디만으로 로그인하는 MVP 수준의 인증 시스템입니다.

### 1.1 요구사항
- 비밀번호 없이 아이디만으로 로그인
- 5명의 고정된 사용자 지원
- 로그인하지 않으면 주요 기능 접근 불가
- 헤더에 현재 로그인 사용자 표시

### 1.2 사용자 목록

| ID | 사용자명 |
|----|----------|
| 1 | 청연정혜종 |
| 2 | 청연김흥래 |
| 3 | 청연신창국 |
| 4 | 청연윤운문 |
| 5 | 청연송원영 |

---

## 2. 기술 스택 선택

### 2.1 검토한 옵션

| 옵션 | 장점 | 단점 | 결정 |
|------|------|------|------|
| **쿠키 기반 세션** | 단순함, 외부 라이브러리 불필요, Next.js 내장 기능 사용 | 확장성 제한 | **선택** |
| NextAuth.js | 다양한 인증 방식 지원, 확장성 | 현재 요구사항에 과도함 | - |
| JWT 토큰 | 서버 상태 불필요 | 복잡성 증가 | - |

### 2.2 선택 근거
- 비밀번호 없는 단순 로그인
- 5명의 고정 사용자
- MVP 수준의 구현
- 외부 의존성 최소화

---

## 3. 시스템 아키텍처

### 3.1 파일 구조

```
expense-system/
├── lib/
│   ├── users.ts              # 사용자 목록 (하드코딩)
│   └── auth.ts               # 인증 유틸리티 함수
├── app/
│   ├── login/
│   │   └── page.tsx          # 로그인 페이지
│   └── api/
│       └── auth/
│           ├── login/route.ts    # POST: 로그인 처리
│           ├── logout/route.ts   # POST: 로그아웃 처리
│           └── me/route.ts       # GET: 현재 사용자 정보
├── components/
│   └── Header.tsx            # 헤더 (사용자 정보 표시)
└── middleware.ts             # 인증 미들웨어 (보호된 라우트)
```

### 3.2 인증 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                         로그인 흐름                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  사용자   │───▶│ /login   │───▶│ POST     │───▶│ 쿠키     │  │
│  │  접속    │    │ 페이지   │    │ /api/    │    │ 설정     │  │
│  │          │    │          │    │ auth/    │    │ (7일)    │  │
│  └──────────┘    └──────────┘    │ login    │    └──────────┘  │
│                                  └──────────┘          │        │
│                                                        ▼        │
│                                               ┌──────────┐      │
│                                               │ /expenses│      │
│                                               │ 리다이렉트│      │
│                                               └──────────┘      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      보호된 라우트 접근                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │  사용자   │───▶│middleware│───▶│ 세션     │                  │
│  │ /expenses│    │ .ts      │    │ 확인     │                  │
│  │  접근    │    │          │    │          │                  │
│  └──────────┘    └──────────┘    └────┬─────┘                  │
│                                       │                         │
│                         ┌─────────────┴─────────────┐           │
│                         ▼                           ▼           │
│                  ┌──────────┐                ┌──────────┐       │
│                  │ 세션 있음 │                │ 세션 없음 │       │
│                  │ → 통과   │                │ → /login │       │
│                  └──────────┘                │ 리다이렉트│       │
│                                              └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 상세 설계

### 4.1 사용자 데이터 (`lib/users.ts`)

```typescript
export const USERS = [
  { id: '1', username: '청연정혜종' },
  { id: '2', username: '청연김흥래' },
  { id: '3', username: '청연신창국' },
  { id: '4', username: '청연윤운문' },
  { id: '5', username: '청연송원영' },
] as const;

export type User = (typeof USERS)[number];

export function findUserById(id: string): User | undefined;
export function findUserByUsername(username: string): User | undefined;
```

### 4.2 인증 유틸리티 (`lib/auth.ts`)

```typescript
// 세션 쿠키 설정
const SESSION_COOKIE = 'session';
const COOKIE_OPTIONS = {
  httpOnly: true,                              // XSS 방지
  secure: process.env.NODE_ENV === 'production', // HTTPS만 (프로덕션)
  sameSite: 'lax',                             // CSRF 방지
  maxAge: 60 * 60 * 24 * 7,                    // 7일
  path: '/',
};

// 함수
export async function createSession(userId: string): Promise<void>;
export async function deleteSession(): Promise<void>;
export async function getCurrentUser(): Promise<User | null>;
export async function getSessionUserId(): Promise<string | null>;
```

### 4.3 API 엔드포인트

#### POST `/api/auth/login`
```typescript
// Request
{ username: string }

// Response (성공)
{ success: true, user: { id: string, username: string } }

// Response (실패)
{ error: '존재하지 않는 사용자입니다.' }  // 401
{ error: '사용자 이름이 필요합니다.' }    // 400
```

#### POST `/api/auth/logout`
```typescript
// Response
{ success: true }
```

#### GET `/api/auth/me`
```typescript
// Response (로그인됨)
{ user: { id: string, username: string } }

// Response (비로그인)
{ user: null }  // 401
```

### 4.4 미들웨어 (`middleware.ts`)

```typescript
// 보호된 경로
const protectedPaths = ['/expenses', '/approvals'];

// 로그인 후 접근 불가 경로
const authPaths = ['/login'];

// 동작
// 1. protectedPaths 접근 시 세션 없으면 → /login 리다이렉트
// 2. authPaths 접근 시 세션 있으면 → /expenses 리다이렉트
```

### 4.5 로그인 페이지 UI

```
┌──────────────────────────────────────────┐
│                                          │
│         지출결의서 시스템                 │
│    사용자를 선택하여 로그인하세요          │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │ ○ 청연정혜종                      │   │
│   └──────────────────────────────────┘   │
│   ┌──────────────────────────────────┐   │
│   │ ○ 청연김흥래                      │   │
│   └──────────────────────────────────┘   │
│   ┌──────────────────────────────────┐   │
│   │ ○ 청연신창국                      │   │
│   └──────────────────────────────────┘   │
│   ┌──────────────────────────────────┐   │
│   │ ○ 청연윤운문                      │   │
│   └──────────────────────────────────┘   │
│   ┌──────────────────────────────────┐   │
│   │ ○ 청연송원영                      │   │
│   └──────────────────────────────────┘   │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │            로그인                 │   │
│   └──────────────────────────────────┘   │
│                                          │
└──────────────────────────────────────────┘
```

### 4.6 헤더 UI

```
┌──────────────────────────────────────────────────────────────────┐
│ 🏠 지출결의서 관리  │ 지출결의서 │ 결재함 │     👤 청연정혜종  로그아웃 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. 보안 고려사항

| 항목 | 설명 | 구현 |
|------|------|------|
| **httpOnly 쿠키** | JavaScript에서 쿠키 접근 불가 (XSS 방지) | ✅ |
| **secure 플래그** | 프로덕션에서 HTTPS만 허용 | ✅ |
| **sameSite=lax** | CSRF 공격 방지 | ✅ |
| **세션 만료** | 7일 후 자동 만료 | ✅ |

### 5.1 현재 MVP의 보안 제한사항
- 비밀번호 없음 (아이디만으로 로그인)
- 세션 암호화 없음 (userId 직접 저장)
- 역할(Role) 기반 권한 없음

---

## 6. 구현 파일 목록

| 파일 경로 | 설명 | 상태 |
|-----------|------|------|
| `lib/users.ts` | 사용자 목록 정의 | ✅ 완료 |
| `lib/auth.ts` | 인증 유틸리티 함수 | ✅ 완료 |
| `app/api/auth/login/route.ts` | 로그인 API | ✅ 완료 |
| `app/api/auth/logout/route.ts` | 로그아웃 API | ✅ 완료 |
| `app/api/auth/me/route.ts` | 현재 사용자 조회 API | ✅ 완료 |
| `middleware.ts` | 인증 미들웨어 | ✅ 완료 |
| `app/login/page.tsx` | 로그인 페이지 | ✅ 완료 |
| `components/Header.tsx` | 헤더 수정 (사용자 정보 표시) | ✅ 완료 |

---

## 7. 향후 확장 가능성

현재 설계는 다음으로 쉽게 확장 가능:

1. **비밀번호 추가**
   - `lib/users.ts`에 password 필드 추가
   - bcrypt로 해시 저장

2. **사용자 DB 저장**
   - Prisma User 모델 추가
   - 하드코딩된 사용자 목록 제거

3. **역할(Role) 기반 권한 관리**
   - User 모델에 role 필드 추가 (admin, manager, user)
   - 미들웨어에서 역할별 접근 제어

4. **JWT 토큰 방식으로 전환**
   - 쿠키 대신 JWT 토큰 사용
   - 토큰 갱신 로직 추가

5. **소셜 로그인**
   - NextAuth.js 도입
   - Google, Kakao 등 OAuth 연동

---

## 8. 테스트 방법

### 8.1 개발 서버 실행
```bash
npm run dev
```

### 8.2 로그인 테스트
1. http://localhost:3000/expenses 접속
2. 자동으로 /login으로 리다이렉트됨
3. 사용자 선택 후 "로그인" 클릭
4. /expenses로 이동, 헤더에 사용자 이름 표시

### 8.3 로그아웃 테스트
1. 헤더의 "로그아웃" 버튼 클릭
2. /login 페이지로 이동
3. 보호된 경로 접근 시 다시 로그인 요구

### 8.4 API 테스트 (브라우저 콘솔)
```javascript
// 로그인
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: '청연정혜종' })
}).then(r => r.json()).then(console.log);

// 현재 사용자 조회
fetch('/api/auth/me').then(r => r.json()).then(console.log);

// 로그아웃
fetch('/api/auth/logout', { method: 'POST' })
  .then(r => r.json()).then(console.log);
```

---

*문서 작성일: 2025-12-21*
*버전: 1.0*
