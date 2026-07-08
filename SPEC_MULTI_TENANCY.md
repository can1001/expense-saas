# 멀티테넌시 SaaS 전환 스펙

## 1. 목표 (Objective)

### 문제 정의
단일 조직용으로 설계된 지출결의서 시스템을 여러 조직이 독립적으로 사용할 수 있는 SaaS 플랫폼으로 전환해야 함.

### 해결 방안
Row-Level Isolation 기반 멀티테넌시 아키텍처 적용:
- 모든 데이터에 `tenantId` 필드 추가
- Prisma Extension으로 자동 필터링
- 서브도메인 기반 테넌트 식별

### 대상 사용자
- **테넌트 관리자**: 각 조직의 시스템 관리자
- **테넌트 사용자**: 각 조직의 일반 사용자
- **SuperAdmin**: 플랫폼 전체 관리자

### 성공 기준
- 테넌트 간 데이터 완전 격리 (Cross-tenant 접근 불가)
- 기존 기능의 정상 동작 유지
- 테넌트 추가/관리 시 코드 수정 불필요

---

## 2. 핵심 기능 (Features)

### 2.1 테넌트 격리

| 구분 | 내용 |
|------|------|
| 격리 방식 | Row-Level Isolation (모든 테이블에 tenantId) |
| 식별 방식 | 서브도메인 (`chungyeon.expense-saas.com`) |
| 컨텍스트 | AsyncLocalStorage (요청 범위) |
| 필터링 | Prisma Extension 자동 적용 |

### 2.2 테넌트 모델

```prisma
model Tenant {
  id            String   @id @default(cuid())
  name          String   // 조직명
  subdomain     String   @unique // 서브도메인
  customDomain  String?  @unique // 커스텀 도메인

  orgType       OrgType  @default(CHURCH)
  plan          PlanType @default(FREE)

  maxUsers      Int      @default(10)
  maxStorageMB  Int      @default(1024)
  currentUsers  Int      @default(0)

  isActive      Boolean  @default(true)
  suspendedAt   DateTime?
  suspendReason String?
}

enum OrgType {
  CHURCH     // 교회
  NONPROFIT  // 비영리
  SCHOOL     // 학교
  COMPANY    // 기업
  OTHER      // 기타
}

enum PlanType {
  FREE       // 무료 (10명, 1GB)
  BASIC      // 기본 (50명, 10GB)
  PRO        // 프로 (200명, 50GB)
  ENTERPRISE // 기업 (무제한)
}
```

### 2.3 테넌트 범위 모델

자동으로 tenantId 필터링이 적용되는 모델:

```
- User, Role, Committee, Department
- Expense, ExpenseItem, ExpenseAttachment
- SimpleExpense, RecurringExpense
- BudgetCategory, BudgetSubcategory, BudgetDetail
- Curriculum, Lesson, Attendance, QuizResponse
- ApprovalLine, ApprovalLineTemplate
- Notification, PushSubscription
- 기타 모든 비즈니스 모델
```

### 2.4 인증 체계

| 유형 | 토큰 | 쿠키 | 검증 함수 |
|------|------|------|----------|
| 테넌트 사용자 | JWT (tenantId 포함) | `token` | `withAuth`, `withAdmin` |
| SuperAdmin | JWT (별도 시크릿) | `super_admin_token` | `withSuperAdmin` |

---

## 3. API 설계 (Commands)

### 3.1 테넌트 정보 API

```
GET /api/tenant/info
```

**요청**
- Headers: `x-tenant-subdomain` 또는 `x-tenant-param`

**응답**
```json
{
  "name": "청연교회",
  "subdomain": "chungyeon",
  "logoUrl": null,
  "orgType": "CHURCH"
}
```

### 3.2 플랫폼 API (SuperAdmin)

```
POST   /api/platform/auth/login     # 로그인
POST   /api/platform/auth/logout    # 로그아웃
GET    /api/platform/auth/me        # 현재 관리자

GET    /api/platform/tenants        # 테넌트 목록
POST   /api/platform/tenants        # 테넌트 생성
GET    /api/platform/tenants/[id]   # 테넌트 상세
PATCH  /api/platform/tenants/[id]   # 테넌트 수정
DELETE /api/platform/tenants/[id]   # 테넌트 삭제

GET    /api/platform/tenants/[id]/stats  # 통계
GET    /api/platform/tenants/[id]/users  # 사용자 목록
```

**테넌트 생성 요청**
```json
{
  "name": "새 교회",
  "subdomain": "newchurch",
  "orgType": "CHURCH",
  "plan": "BASIC",
  "adminEmail": "admin@newchurch.org",
  "adminName": "관리자",
  "adminPassword": "SecurePass123!"
}
```

---

## 4. 프로젝트 구조 (Project Structure)

### 신규 파일

```
lib/
├── tenant-context.ts         # AsyncLocalStorage 컨텍스트
├── tenant.ts                 # 테넌트 조회/캐싱
├── prisma-tenant-extension.ts # Prisma 자동 필터링
└── auth/
    └── super-admin.ts        # SuperAdmin 인증

app/
├── api/
│   ├── tenant/info/route.ts  # 테넌트 정보 API
│   └── platform/             # 플랫폼 API
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── me/route.ts
│       └── tenants/
│           ├── route.ts
│           └── [id]/
│               ├── route.ts
│               ├── stats/route.ts
│               └── users/route.ts
└── platform/                 # 플랫폼 UI
    ├── login/page.tsx
    ├── layout.tsx
    ├── dashboard/page.tsx
    └── tenants/
        ├── page.tsx
        └── [id]/
            ├── page.tsx
            └── users/page.tsx

prisma/
├── schema.prisma             # Tenant, SuperAdmin 추가
└── seeds/
    ├── super-admin-seed.ts
    └── tenant-seed.ts
```

### 수정 파일

```
middleware.ts                 # 서브도메인 추출 로직 추가
lib/prisma.ts                 # Tenant Extension 적용
lib/auth/user.ts              # 서브도메인-테넌트 검증 추가
app/login/page.tsx            # 테넌트 정보 표시
components/Header.tsx         # 테넌트 이름 표시
```

---

## 5. 코드 스타일 (Code Style)

### 테넌트 컨텍스트 접근

```typescript
// 필수 컨텍스트 (없으면 에러)
import { getTenantId } from '@/lib/tenant-context';
const tenantId = getTenantId();

// 선택적 컨텍스트 (없으면 null)
import { getTenantIdOptional } from '@/lib/tenant-context';
const tenantId = getTenantIdOptional();
```

### API 래퍼 사용

```typescript
// 테넌트 사용자 인증
import { withAuth } from '@/lib/auth/user';
export const GET = withAuth(async (req, { user }) => { ... });

// 테넌트 관리자 인증
import { withAdmin } from '@/lib/auth/user';
export const POST = withAdmin(async (req, { user }) => { ... });

// SuperAdmin 인증
import { withSuperAdmin } from '@/lib/auth/super-admin';
export const GET = withSuperAdmin(async (req, { admin }) => { ... });
```

### Prisma 클라이언트

```typescript
// 테넌트 필터링 적용 (일반 사용)
import { prisma } from '@/lib/prisma';
const expenses = await prisma.expense.findMany();

// 필터링 없음 (플랫폼 레벨)
import { prismaBase } from '@/lib/prisma';
const allTenants = await prismaBase.tenant.findMany();
```

---

## 6. 테스트 전략 (Testing Strategy)

### 수동 테스트 체크리스트

**테넌트 격리**
- [ ] 테넌트 A 사용자가 테넌트 B 데이터에 접근 불가
- [ ] 서브도메인과 사용자 테넌트 불일치 시 403 에러
- [ ] Prisma 쿼리에 tenantId 자동 적용 확인

**인증**
- [ ] 테넌트 사용자 로그인/로그아웃
- [ ] SuperAdmin 로그인/로그아웃
- [ ] JWT 토큰에 tenantId 포함 확인

**플랫폼 관리**
- [ ] 테넌트 목록 조회
- [ ] 테넌트 생성/수정/삭제
- [ ] 테넌트 활성화/비활성화
- [ ] 테넌트 통계 조회

**UI**
- [ ] 로그인 페이지에 테넌트 정보 표시
- [ ] 헤더에 테넌트 이름 표시
- [ ] 플랫폼 대시보드 정상 표시

### 엣지 케이스

- [ ] 존재하지 않는 서브도메인 접근 → 404
- [ ] 비활성화된 테넌트 접근 → 404
- [ ] 로그아웃 상태에서 API 호출 → 401
- [ ] 권한 없는 API 호출 → 403

---

## 7. 경계 조건 (Boundaries)

### 항상 해야 할 것 (Always Do)
- 모든 API에서 tenantId 검증
- JWT 토큰에 tenantId 포함
- Prisma Extension으로 자동 필터링
- 서브도메인-테넌트 일치 검증

### 확인이 필요한 것 (Ask First)
- 테넌트 삭제 정책 (soft delete vs hard delete)
- 데이터 백업/복원 방식
- 커스텀 도메인 설정 방법

### 절대 하면 안 되는 것 (Never Do)
- tenantId 없이 데이터 생성/조회
- Cross-tenant 데이터 접근 허용
- 사용자 JWT에서 tenantId 변경 허용
- 비활성화 테넌트 로그인 허용

---

## 8. 구현 순서

1. **Phase 1: 스키마 확장**
   - Tenant, SuperAdmin 모델 추가
   - 모든 모델에 tenantId 추가
   - 마이그레이션 스크립트 작성

2. **Phase 2: 인프라 구현**
   - AsyncLocalStorage 컨텍스트
   - Prisma Extension 필터링
   - 미들웨어 서브도메인 추출

3. **Phase 3: 인증 강화**
   - withAuth 테넌트 검증 추가
   - withSuperAdmin 구현
   - JWT 토큰 구조 변경

4. **Phase 4: 플랫폼 UI**
   - SuperAdmin 로그인
   - 대시보드
   - 테넌트 CRUD

5. **Phase 5: 테넌트 UI**
   - 테넌트 정보 표시
   - 시드 스크립트

---

## 9. 보안 고려사항

### Cross-Tenant 접근 방지

1. **레이어드 보안**
   - Middleware: 서브도메인 추출
   - withAuth: 서브도메인-테넌트 일치 검증
   - Prisma Extension: 자동 tenantId 필터링

2. **JWT 토큰 보안**
   - tenantId 토큰에 포함 (변조 불가)
   - 별도 시크릿으로 서명
   - HttpOnly, Secure 쿠키

3. **데이터베이스 레벨**
   - 모든 테이블 tenantId 인덱스
   - 외래키 제약조건

---

## 10. 관련 문서

- [멀티테넌시 아키텍처](docs/MULTI_TENANCY.md)
- [작업 이력](docs/작업이력.md)
- [README](README.md)
