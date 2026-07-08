# API 라우트 Tenant 마이그레이션 가이드

## 개요

SaaS 멀티테넌시 지원을 위해 기존 API 라우트를 `withTenant` 래퍼로 감싸면 자동으로 tenant 격리가 적용됩니다.

## 작동 원리

```
┌─────────────────────────────────────────────────────────────┐
│  요청 흐름                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 클라이언트 요청                                           │
│     chungyeon.expense-saas.com/api/expenses                  │
│                            │                                 │
│                            ▼                                 │
│  2. Edge Middleware                                          │
│     - subdomain 추출 (chungyeon)                             │
│     - x-tenant-subdomain 헤더 설정                            │
│                            │                                 │
│                            ▼                                 │
│  3. API Route Handler                                        │
│     withTenant(async (request, { tenant }) => { ... })       │
│     - 헤더에서 subdomain 읽음                                 │
│     - DB에서 tenant 조회 (캐시 확인)                          │
│     - AsyncLocalStorage에 tenantId 저장                       │
│                            │                                 │
│                            ▼                                 │
│  4. Prisma 쿼리 실행                                          │
│     prisma.user.findMany()                                   │
│     - Prisma Extension이 tenantId 자동 추가                   │
│     - WHERE tenantId = 'chungyeon-tenant-id'                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 마이그레이션 단계

### 방법 1: 기존 코드 최소 수정 (권장)

`withTenant` 래퍼로 기존 핸들러를 감싸면 됩니다.

**기존 코드:**
```typescript
// app/api/expenses/route.ts
export async function GET(request: NextRequest) {
  const expenses = await prisma.expense.findMany();
  return NextResponse.json({ expenses });
}
```

**변경 후:**
```typescript
// app/api/expenses/route.ts
import { withTenant } from '@/lib/api-utils';

export const GET = withTenant(async (request, { tenant }) => {
  // prisma 쿼리는 자동으로 tenantId 필터 적용
  const expenses = await prisma.expense.findMany();
  return NextResponse.json({ expenses });
});
```

### 방법 2: Tenant 필수 API

tenant가 없으면 401 에러를 반환합니다.

```typescript
import { withRequiredTenant } from '@/lib/api-utils';

export const GET = withRequiredTenant(async (request, { tenant }) => {
  // tenant는 항상 존재 (TypeScript 타입 보장)
  console.log('Tenant:', tenant.tenantId, tenant.subdomain);

  const expenses = await prisma.expense.findMany();
  return NextResponse.json({ expenses });
});
```

### 방법 3: 플랫폼 레벨 API (tenant 없음)

SuperAdmin 또는 시스템 API는 `prismaBase`를 사용합니다.

```typescript
// app/api/platform/tenants/route.ts
import { prismaBase } from '@/lib/prisma';

export async function GET() {
  // 모든 테넌트 조회 (필터링 없음)
  const tenants = await prismaBase.tenant.findMany();
  return NextResponse.json({ tenants });
}
```

## 개발 환경 테스트

### 쿼리 파라미터로 tenant 지정

로컬 개발 시 subdomain 없이 tenant를 테스트할 수 있습니다:

```bash
# chungyeon 테넌트로 테스트
curl "http://localhost:3000/api/expenses?tenant=chungyeon"

# somang 테넌트로 테스트
curl "http://localhost:3000/api/expenses?tenant=somang"
```

### 테넌트 데이터 시드

```typescript
// prisma/seeds/tenant-seed.ts
import { prismaBase } from '@/lib/prisma';

await prismaBase.tenant.create({
  data: {
    name: '청연교회',
    subdomain: 'chungyeon',
    orgType: 'CHURCH',
    plan: 'PRO',
  },
});
```

## 주의사항

### 1. Prisma Client 선택

| 클라이언트 | 용도 | tenant 필터링 |
|-----------|------|--------------|
| `prisma` | 일반 API | ✅ 자동 적용 |
| `prismaBase` | 플랫폼/관리자 | ❌ 없음 |

### 2. 트랜잭션

트랜잭션 내에서도 tenant 필터링이 적용됩니다:

```typescript
export const POST = withTenant(async (request, { tenant }) => {
  // 트랜잭션 내의 모든 쿼리에 tenantId 적용
  await prisma.$transaction(async (tx) => {
    await tx.expense.create({ data: { ... } }); // tenantId 자동 추가
    await tx.expenseItem.create({ data: { ... } }); // tenantId 자동 추가
  });
});
```

### 3. 관계 데이터

부모-자식 관계에서 자식 모델에도 tenantId가 추가됩니다:

```typescript
// 자동으로 expense와 items 모두 tenantId 설정
await prisma.expense.create({
  data: {
    committee: '기획위원회',
    department: '재정팀',
    items: {
      create: [
        { description: '식비', amount: 50000 },
      ],
    },
  },
});
```

### 4. findUnique 주의

`findUnique`는 unique 필드 조건만 사용 가능하므로, 결과 반환 후 tenantId를 검증합니다.
다른 테넌트의 데이터는 `null`을 반환합니다.

```typescript
// id로 조회하지만, 다른 테넌트 데이터면 null 반환
const expense = await prisma.expense.findUnique({
  where: { id: 'some-id' },
});
```

## 마이그레이션 체크리스트

- [ ] `withTenant` 또는 `withRequiredTenant` 래퍼 적용
- [ ] 플랫폼 레벨 API는 `prismaBase` 사용
- [ ] 개발 환경에서 `?tenant=xxx` 쿼리로 테스트
- [ ] 기존 데이터에 tenantId 마이그레이션 (별도 스크립트)
- [ ] E2E 테스트에 tenant 파라미터 추가

## 관련 파일

- `lib/prisma.ts` - Prisma 클라이언트
- `lib/prisma-tenant-extension.ts` - Tenant 필터링 Extension
- `lib/tenant-context.ts` - AsyncLocalStorage 컨텍스트
- `lib/tenant.ts` - Tenant 조회 서비스
- `lib/api-utils.ts` - API 라우트 유틸리티
- `middleware.ts` - Edge Middleware
