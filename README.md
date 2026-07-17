# 지출결의서 SaaS 플랫폼

> 멀티테넌시 지출결의서 관리 시스템 (Multi-Tenant Expense Management SaaS)

## 개요

여러 조직(교회, 비영리단체, 학교, 기업)이 독립적으로 사용할 수 있는 SaaS 형태의 지출결의서 관리 시스템입니다.

### 주요 특징

- **멀티테넌시**: 서브도메인 기반 테넌트 식별 (`chungyeon.expense-saas.com`)
- **데이터 격리**: Row-Level Isolation으로 완전한 데이터 분리
- **플랫폼 관리**: SuperAdmin을 통한 중앙 관리
- **모바일 최적화**: PWA 지원, 반응형 디자인

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7.0 |
| Styling | Tailwind CSS 4 |
| Forms | React Hook Form + Zod |
| PDF | @react-pdf/renderer |
| PWA | next-pwa |

---

## 빠른 시작

### 1. 패키지 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# DATABASE_URL 설정 필요
```

### 3. 데이터베이스 설정

```bash
# 스키마 적용
pnpm run db:push

# SuperAdmin 생성
pnpm run db:seed:super-admin

# 샘플 테넌트 생성 (개발용)
pnpm run db:seed:tenants

# 예산 마스터 데이터 시드
pnpm run db:seed
```

### 4. 개발 서버 실행

```bash
pnpm run dev
```

### 5. 접속

| 환경 | URL |
|------|-----|
| 로컬 개발 | `http://localhost:3000?tenant=chungyeon` |
| 플랫폼 관리 | `http://localhost:3000/platform/login` |

---

## 프로젝트 구조

```
expense-saas/
├── app/
│   ├── api/                  # API Routes
│   │   ├── expenses/         # 지출결의서 API
│   │   ├── budget/           # 예산 API
│   │   ├── tenant/           # 테넌트 정보 API
│   │   └── platform/         # 플랫폼 관리 API
│   ├── expenses/             # 지출결의서 페이지
│   ├── platform/             # 플랫폼 관리 UI
│   └── login/                # 로그인 페이지
├── components/               # UI 컴포넌트
├── lib/
│   ├── prisma.ts             # Prisma 클라이언트
│   ├── tenant-context.ts     # 테넌트 컨텍스트
│   ├── tenant.ts             # 테넌트 헬퍼
│   ├── prisma-tenant-extension.ts  # 자동 필터링
│   └── auth/                 # 인증 모듈
├── prisma/
│   ├── schema.prisma         # DB 스키마
│   └── seeds/                # 시드 스크립트
├── docs/                     # 문서
└── middleware.ts             # 서브도메인 추출
```

---

## 멀티테넌시 아키텍처

### 요청 흐름

```
Client (chungyeon.expense-saas.com)
    ↓
Middleware (서브도메인 추출)
    ↓
API Route (withAuth - 테넌트 검증)
    ↓
Prisma Extension (자동 필터링)
    ↓
PostgreSQL (tenantId 기반 격리)
```

### 핵심 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| Middleware | `middleware.ts` | 서브도메인 추출, 헤더 설정 |
| Tenant Context | `lib/tenant-context.ts` | AsyncLocalStorage 기반 컨텍스트 |
| Prisma Extension | `lib/prisma-tenant-extension.ts` | 자동 tenantId 필터링 |
| Auth Wrapper | `lib/auth/user.ts` | withAuth, withAdmin |
| SuperAdmin Auth | `lib/auth/super-admin.ts` | 플랫폼 관리자 인증 |

자세한 내용: [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md)

---

## API 엔드포인트

### 테넌트 API

```
GET    /api/expenses          # 지출결의서 목록
POST   /api/expenses          # 지출결의서 생성
GET    /api/expenses/[id]     # 상세 조회
PUT    /api/expenses/[id]     # 수정
DELETE /api/expenses/[id]     # 삭제
GET    /api/budget            # 예산 마스터
GET    /api/tenant/info       # 테넌트 정보
```

### 플랫폼 API (SuperAdmin)

```
POST   /api/platform/auth/login     # 로그인
POST   /api/platform/auth/logout    # 로그아웃
GET    /api/platform/auth/me        # 현재 관리자

GET    /api/platform/tenants        # 테넌트 목록
POST   /api/platform/tenants        # 테넌트 생성
GET    /api/platform/tenants/[id]   # 테넌트 상세
PATCH  /api/platform/tenants/[id]   # 테넌트 수정
DELETE /api/platform/tenants/[id]   # 테넌트 삭제
```

---

## 테스트 계정

### SuperAdmin
| 이메일 | 비밀번호 |
|--------|----------|
| `admin@expense-saas.com` | `SuperAdmin123!` |

### 테넌트 사용자
| 테넌트 | 서브도메인 | 아이디 | 비밀번호 |
|--------|-----------|--------|----------|
| 청연교회 | `chungyeon` | `chungyeonadmin` | `TenantAdmin123!` |
| 소망교회 | `somang` | `somangadmin` | `TenantAdmin123!` |
| 테스트 | `test` | `testadmin` | `TenantAdmin123!` |

---

## 개발 명령어

```bash
pnpm run dev              # 개발 서버
pnpm run build            # 프로덕션 빌드
pnpm run start            # 프로덕션 실행

pnpm run db:push          # 스키마 적용
pnpm run db:seed          # 예산 마스터 시드
pnpm run db:seed:super-admin  # SuperAdmin 생성
pnpm run db:seed:tenants  # 샘플 테넌트 생성
pnpm run db:studio        # Prisma Studio
```

---

## 환경 변수

```bash
# 데이터베이스
DATABASE_URL="postgresql://..."

# 앱 설정
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# JWT 시크릿
JWT_SECRET="your-secret-key"
SUPER_ADMIN_JWT_SECRET="super-admin-secret-key"
```

---

## 문서

- [멀티테넌시 아키텍처](docs/MULTI_TENANCY.md)
- [작업 이력](docs/작업이력.md)
- [CLAUDE.md](CLAUDE.md) - Claude Code 설정

---

## 라이선스

Private - All Rights Reserved

---

## 관련 링크

- 프로덕션: `https://{subdomain}.expense-saas.com`
- 플랫폼 관리: `https://expense-saas.com/platform`
