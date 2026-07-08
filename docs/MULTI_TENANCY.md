# 멀티테넌시 (Multi-Tenancy) 아키텍처

> 지출결의서 시스템의 SaaS 전환을 위한 멀티테넌시 구현 문서

## 목차

1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [테넌트 모델](#테넌트-모델)
4. [인증 시스템](#인증-시스템)
5. [데이터 격리](#데이터-격리)
6. [플랫폼 관리](#플랫폼-관리)
7. [사용 방법](#사용-방법)
8. [개발 가이드](#개발-가이드)

---

## 개요

### 멀티테넌시란?

하나의 애플리케이션 인스턴스에서 여러 조직(테넌트)이 독립적으로 서비스를 이용할 수 있는 아키텍처입니다.

### 주요 특징

- **Row-Level Isolation**: 모든 데이터에 `tenantId` 적용
- **서브도메인 기반 접근**: `chungyeon.expense-saas.com`
- **자동 필터링**: Prisma Extension으로 테넌트별 데이터 자동 격리
- **플랫폼 관리**: SuperAdmin을 통한 중앙 관리

---

## 아키텍처

### 요청 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│  Client (chungyeon.expense-saas.com)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js Middleware                                             │
│  - 서브도메인 추출 (extractSubdomain)                            │
│  - x-tenant-subdomain 헤더 설정                                  │
│  - JWT 토큰 검증                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Route (withAuth wrapper)                                   │
│  - 사용자 인증 (JWT)                                             │
│  - 서브도메인 ↔ 테넌트 일치 검증                                  │
│  - 테넌트 컨텍스트 설정 (AsyncLocalStorage)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Prisma Extension (tenantExtension)                             │
│  - findMany/findFirst: tenantId 자동 필터                        │
│  - create: tenantId 자동 주입                                    │
│  - update/delete: tenantId 조건 자동 추가                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Neon)                                              │
│  - 모든 테이블에 tenantId 컬럼                                    │
│  - 인덱스 최적화                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 핵심 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| Middleware | `middleware.ts` | 서브도메인 추출, 헤더 설정 |
| Tenant Context | `lib/tenant-context.ts` | AsyncLocalStorage 기반 컨텍스트 |
| Tenant Helper | `lib/tenant.ts` | 테넌트 조회, 캐싱 |
| Prisma Extension | `lib/prisma-tenant-extension.ts` | 자동 필터링 |
| Auth Wrapper | `lib/auth/user.ts` | withAuth, withAdmin |
| SuperAdmin Auth | `lib/auth/super-admin.ts` | 플랫폼 관리자 인증 |

---

## 테넌트 모델

### 스키마

```prisma
model Tenant {
  id            String   @id @default(cuid())
  name          String   // "청연교회"
  subdomain     String   @unique // "chungyeon"
  customDomain  String?  @unique // "expense.chungyeon.org"

  orgType       OrgType  @default(CHURCH)
  plan          PlanType @default(FREE)

  maxUsers      Int      @default(10)
  maxStorageMB  Int      @default(1024)
  currentUsers  Int      @default(0)

  isActive      Boolean  @default(true)
  // ... 관계
}
```

### 요금제 (PlanType)

| 요금제 | 사용자 | 스토리지 | 설명 |
|--------|--------|----------|------|
| FREE | 10명 | 1GB | 무료 |
| BASIC | 50명 | 10GB | 기본 |
| PRO | 200명 | 50GB | 프로 |
| ENTERPRISE | 무제한 | 무제한 | 기업 |

### 조직 유형 (OrgType)

- `CHURCH`: 교회
- `NONPROFIT`: 비영리 단체
- `SCHOOL`: 학교
- `COMPANY`: 기업
- `OTHER`: 기타

---

## 인증 시스템

### 테넌트 사용자 인증

```typescript
// JWT 토큰 구조
interface UserJWTPayload {
  sub: string;        // 사용자 ID
  tenantId: string;   // 테넌트 ID
  userid: string;     // 로그인 ID
  username: string;   // 표시 이름
  role: string;       // 역할 코드
  permissions: {
    canApprove: boolean;
    canManageExpense: boolean;
    canAccessAdmin: boolean;
    canExportData: boolean;
    canRegisterUsers: boolean;
  };
}
```

### API 보호 래퍼

```typescript
// 인증 필요
export const GET = withAuth(handleGet);

// 관리자 권한 필요
export const POST = withAdmin(handlePost);

// 특정 권한 필요
export const DELETE = withPermission('canManageExpense', handleDelete);
```

### SuperAdmin 인증

플랫폼 전체를 관리하는 별도의 인증 체계:

```typescript
// SuperAdmin 전용
export const GET = withSuperAdmin(handleGet);
```

---

## 데이터 격리

### Prisma Extension

```typescript
// lib/prisma-tenant-extension.ts
export function createTenantExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            const tenantId = getTenantIdOptional();
            if (tenantId && TENANT_SCOPED_MODELS.includes(model)) {
              args.where = { ...args.where, tenantId };
            }
            return query(args);
          },
          async create({ model, args, query }) {
            const tenantId = getTenantIdOptional();
            if (tenantId && TENANT_SCOPED_MODELS.includes(model)) {
              args.data = { ...args.data, tenantId };
            }
            return query(args);
          },
          // update, delete 등...
        },
      },
    })
  );
}
```

### 테넌트 범위 모델

다음 모델들은 자동으로 tenantId 필터링이 적용됩니다:

- `User`, `Role`, `Committee`, `Department`
- `Expense`, `ExpenseItem`, `ExpenseAttachment`
- `SimpleExpense`, `RecurringExpense`
- `BudgetCategory`, `BudgetSubcategory`, `BudgetDetail`
- `Curriculum`, `Lesson`, `Attendance`, `QuizResponse`
- 기타 모든 비즈니스 모델

### 서브도메인 검증

```typescript
// withAuth에서 서브도메인-테넌트 일치 확인
if (requestedTenant) {
  const resolvedTenant = await findTenantBySubdomain(requestedTenant);

  if (resolvedTenant.tenantId !== user.tenantId) {
    return NextResponse.json(
      { error: '이 조직에 대한 접근 권한이 없습니다.' },
      { status: 403 }
    );
  }
}
```

---

## 플랫폼 관리

### 관리자 UI

| 페이지 | 경로 | 기능 |
|--------|------|------|
| 로그인 | `/platform/login` | SuperAdmin 로그인 |
| 대시보드 | `/platform/dashboard` | 통계, 테넌트 요약 |
| 테넌트 목록 | `/platform/tenants` | 검색, 필터, 생성 |
| 테넌트 상세 | `/platform/tenants/[id]` | 정보, 사용량, 관리 |

### API 엔드포인트

```
POST   /api/platform/auth/login     # SuperAdmin 로그인
POST   /api/platform/auth/logout    # 로그아웃
GET    /api/platform/auth/me        # 현재 관리자 정보

GET    /api/platform/tenants        # 테넌트 목록
POST   /api/platform/tenants        # 테넌트 생성
GET    /api/platform/tenants/[id]   # 테넌트 상세
PATCH  /api/platform/tenants/[id]   # 테넌트 수정
DELETE /api/platform/tenants/[id]   # 테넌트 삭제

GET    /api/platform/tenants/[id]/stats  # 테넌트 통계
GET    /api/platform/tenants/[id]/users  # 사용자 목록
```

---

## 사용 방법

### 초기 설정

```bash
# 1. SuperAdmin 생성
npm run db:seed:super-admin

# 2. 샘플 테넌트 생성
npm run db:seed:tenants
```

### 접속 방법

| 환경 | URL | 설명 |
|------|-----|------|
| 로컬 개발 | `http://localhost:3000?tenant=chungyeon` | 쿼리 파라미터 |
| 프로덕션 | `https://chungyeon.expense-saas.com` | 서브도메인 |
| 플랫폼 관리 | `https://expense-saas.com/platform/login` | SuperAdmin |

### 테스트 계정

시드 데이터 실행 후 생성되는 계정:

| 테넌트 | 아이디 | 비밀번호 | 역할 |
|--------|--------|----------|------|
| 청연교회 | `chungyeonadmin` | `TenantAdmin123!` | 관리자 |
| 청연교회 | `chungyeonuser` | `TenantAdmin123!` | 사용자 |
| 소망교회 | `somangadmin` | `TenantAdmin123!` | 관리자 |
| 테스트 | `testadmin` | `TenantAdmin123!` | 관리자 |

---

## 개발 가이드

### 새 API 라우트 생성

```typescript
// app/api/example/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

const handleGet: UserApiHandler = async (request, { user }) => {
  // prisma는 자동으로 tenantId 필터링 적용
  const items = await prisma.expense.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ items });
};

export const GET = withAuth(handleGet);
```

### 테넌트 없이 조회 (플랫폼 레벨)

```typescript
import { prismaBase } from '@/lib/prisma';

// prismaBase는 테넌트 필터링 없이 전체 데이터 접근
const allTenants = await prismaBase.tenant.findMany();
```

### 테넌트 컨텍스트 수동 설정

```typescript
import { withTenantAsync } from '@/lib/tenant-context';

await withTenantAsync({ tenantId: 'xxx', subdomain: 'chungyeon' }, async () => {
  // 이 블록 내에서는 해당 테넌트 컨텍스트 적용
  const expenses = await prisma.expense.findMany();
});
```

---

## 보안 고려사항

### Cross-Tenant 접근 방지

1. **withAuth**: 서브도메인과 사용자 테넌트 일치 검증
2. **Prisma Extension**: 모든 쿼리에 tenantId 자동 적용
3. **JWT 토큰**: tenantId 포함, 변조 불가

### 민감 데이터 보호

- 비밀번호: bcrypt 해시
- JWT: HS256 서명
- 쿠키: HttpOnly, SameSite, Secure

### 감사 로그

- `ApprovalLog`: 결재 관련 모든 액션 기록
- `UserYearRoleHistory`: 역할 변경 이력
- `BudgetDetailYearHistory`: 예산 변경 이력

---

## 관련 파일

```
lib/
├── tenant-context.ts         # 테넌트 컨텍스트 관리
├── tenant.ts                 # 테넌트 조회/캐싱
├── prisma-tenant-extension.ts # Prisma 자동 필터링
└── auth/
    ├── user.ts               # 사용자 인증 (withAuth)
    └── super-admin.ts        # SuperAdmin 인증

app/
├── api/
│   ├── tenant/info/route.ts  # 테넌트 정보 API
│   └── platform/             # 플랫폼 관리 API
└── platform/                 # 플랫폼 관리 UI

prisma/
├── schema.prisma             # 멀티테넌트 스키마
└── seeds/
    ├── super-admin-seed.ts   # SuperAdmin 시드
    └── tenant-seed.ts        # 테넌트 시드

middleware.ts                 # 서브도메인 추출
```

---

## 마이그레이션 가이드

기존 단일 테넌트 데이터를 멀티테넌트로 마이그레이션:

```bash
# 마이그레이션 스크립트 실행
npx ts-node --project tsconfig.scripts.json scripts/migrate-tenant-id.ts

# 롤백 (필요시)
npx ts-node --project tsconfig.scripts.json scripts/migrate-tenant-id-rollback.ts
```

자세한 내용은 `scripts/migrate-tenant-id.ts` 파일 참조.
