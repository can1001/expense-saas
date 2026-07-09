# 멀티테넌시 SaaS 전환 - 검증 및 테스트 계획

## 현재 상태 분석

### ✅ 구현 완료 (100%)

| 영역 | 항목 | 파일 |
|------|------|------|
| **스키마** | Tenant, SuperAdmin 모델 | `prisma/schema.prisma` |
| **스키마** | 모든 모델에 tenantId 필드 | `prisma/schema.prisma` |
| **인프라** | AsyncLocalStorage 컨텍스트 | `lib/tenant-context.ts` |
| **인프라** | Prisma Extension 자동 필터링 | `lib/prisma-tenant-extension.ts` |
| **인프라** | 테넌트 조회/캐싱 | `lib/tenant.ts` |
| **인프라** | 미들웨어 서브도메인 추출 | `middleware.ts` |
| **인증** | withAuth (테넌트 검증 포함) | `lib/auth/user.ts` |
| **인증** | withAdmin | `lib/auth/user.ts` |
| **인증** | withSuperAdmin | `lib/auth/super-admin.ts` |
| **API** | 테넌트 정보 API | `app/api/tenant/info/route.ts` |
| **API** | 플랫폼 API (15개) | `app/api/platform/**` |
| **UI** | 플랫폼 UI (13개 페이지) | `app/platform/**` |
| **UI** | 로그인 페이지 테넌트 표시 | `app/login/page.tsx` |
| **UI** | 헤더 테넌트명 표시 | `components/Header.tsx` |
| **시드** | SuperAdmin 시드 | `prisma/seeds/super-admin-seed.ts` |
| **시드** | Tenant 시드 | `prisma/seeds/tenant-seed.ts` |

### ❌ 누락 항목

| 영역 | 항목 | 우선순위 |
|------|------|----------|
| **테스트** | 테넌트 격리 유닛 테스트 | P1 |
| **테스트** | Prisma Extension 테스트 | P1 |
| **테스트** | 인증 래퍼 테스트 | P1 |
| **테스트** | 플랫폼 API 테스트 | P2 |
| **문서** | 배포 가이드 | P3 |

---

## 의존성 그래프

```
                    ┌─────────────────┐
                    │  schema.prisma  │
                    │  (Tenant 모델)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────────┐ ┌─────────┐ ┌──────────────┐
    │ tenant-context  │ │ tenant  │ │ prisma-      │
    │ (AsyncLocal)    │ │ (조회)  │ │ extension    │
    └────────┬────────┘ └────┬────┘ └──────┬───────┘
             │               │             │
             └───────────────┼─────────────┘
                             ▼
                    ┌─────────────────┐
                    │   middleware    │
                    │ (서브도메인)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────────┐ ┌─────────────┐ ┌──────────────┐
    │   withAuth      │ │ withAdmin   │ │ withSuper    │
    │ (사용자 인증)   │ │ (관리자)    │ │ Admin        │
    └────────┬────────┘ └─────────────┘ └──────┬───────┘
             │                                  │
             ▼                                  ▼
    ┌─────────────────┐                ┌──────────────┐
    │  테넌트 API     │                │ 플랫폼 API   │
    │  (/api/*)       │                │ (/platform)  │
    └─────────────────┘                └──────────────┘
```

---

## 작업 계획 (Vertical Slices)

### Phase 1: 테넌트 격리 테스트 (P1)

#### Task 1.1: Prisma Extension 유닛 테스트
- **파일**: `lib/__tests__/prisma-tenant-extension.test.ts`
- **수락 기준**:
  - [ ] 테넌트 컨텍스트 있을 때 자동 필터링 검증
  - [ ] 테넌트 컨텍스트 없을 때 필터링 건너뜀 검증
  - [ ] create/update/delete 시 tenantId 자동 설정 검증
  - [ ] Cross-tenant 접근 차단 검증
- **검증 방법**: `npm test -- prisma-tenant-extension`

#### Task 1.2: 테넌트 컨텍스트 유닛 테스트
- **파일**: `lib/__tests__/tenant-context.test.ts`
- **수락 기준**:
  - [ ] getTenantId() 정상 동작
  - [ ] getTenantIdOptional() null 반환
  - [ ] withTenant() 컨텍스트 설정 확인
  - [ ] extractSubdomain() 파싱 검증
- **검증 방법**: `npm test -- tenant-context`

#### Task 1.3: 테넌트 조회/캐싱 테스트
- **파일**: `lib/__tests__/tenant.test.ts`
- **수락 기준**:
  - [ ] findTenantBySubdomain() 정상 조회
  - [ ] 비활성 테넌트 null 반환
  - [ ] 캐시 TTL 동작 확인
  - [ ] invalidateTenantCache() 동작 확인
- **검증 방법**: `npm test -- tenant.test`

### ⏸️ Checkpoint 1
- 모든 유닛 테스트 통과 확인
- `npm test` 전체 실행

---

### Phase 2: 인증 래퍼 테스트 (P1)

#### Task 2.1: withAuth 테넌트 검증 테스트
- **파일**: `lib/__tests__/auth-user.test.ts` (기존 auth.test.ts 확장)
- **수락 기준**:
  - [ ] JWT에 tenantId 포함 검증
  - [ ] 서브도메인-테넌트 불일치 시 403 검증
  - [ ] 존재하지 않는 테넌트 404 검증
  - [ ] 테넌트 컨텍스트 자동 설정 검증
- **검증 방법**: `npm test -- auth`

#### Task 2.2: withSuperAdmin 테스트
- **파일**: `lib/__tests__/super-admin.test.ts`
- **수락 기준**:
  - [ ] SuperAdmin JWT 생성/검증
  - [ ] 비활성 SuperAdmin 접근 차단
  - [ ] 쿠키/헤더 토큰 인식
- **검증 방법**: `npm test -- super-admin`

### ⏸️ Checkpoint 2
- 인증 테스트 통과 확인
- `npm test` 전체 실행

---

### Phase 3: 통합 테스트 (P2)

#### Task 3.1: 테넌트 격리 통합 테스트
- **파일**: `lib/__tests__/tenant-isolation.integration.test.ts`
- **수락 기준**:
  - [ ] 테넌트 A 사용자가 테넌트 B 데이터 조회 불가
  - [ ] 테넌트 A 사용자가 테넌트 B 데이터 생성 불가
  - [ ] API 레벨에서 Cross-tenant 차단 확인
- **검증 방법**: `npm test -- tenant-isolation`

#### Task 3.2: 플랫폼 API 테스트
- **파일**: `app/api/platform/__tests__/tenants.test.ts`
- **수락 기준**:
  - [ ] 테넌트 CRUD 동작 확인
  - [ ] SuperAdmin 인증 필수 확인
  - [ ] 테넌트 통계 조회 확인
- **검증 방법**: `npm test -- platform`

### ⏸️ Checkpoint 3
- 통합 테스트 통과 확인
- `npm test` 전체 실행

---

### Phase 4: 수동 검증 (P1)

#### Task 4.1: 로컬 환경 수동 테스트
- **수락 기준**:
  - [ ] SuperAdmin 로그인/로그아웃
  - [ ] 테넌트 생성/수정/삭제
  - [ ] 테넌트 사용자 로그인 (`?tenant=chungyeon`)
  - [ ] 로그인 페이지에 테넌트 정보 표시
  - [ ] 헤더에 테넌트명 표시
- **검증 방법**: 브라우저에서 직접 테스트

#### Task 4.2: 데이터 격리 수동 검증
- **수락 기준**:
  - [ ] 테넌트 A로 로그인 후 지출결의서 생성
  - [ ] 테넌트 B로 로그인 후 A의 데이터 보이지 않음 확인
  - [ ] Prisma Studio에서 tenantId 확인
- **검증 방법**: 브라우저 + Prisma Studio

---

## 환경 변수 체크리스트

```bash
# 필수
DATABASE_URL="postgresql://..."
SESSION_SECRET="..."

# SuperAdmin 인증
SUPER_ADMIN_JWT_SECRET="..."

# 사용자 인증
USER_JWT_SECRET="..."

# 선택 (프로덕션)
BASE_DOMAIN="expense-saas.com"
```

---

## 실행 명령어

```bash
# 1. 시드 실행
npm run db:push
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/super-admin-seed.ts
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/tenant-seed.ts

# 2. 테스트 실행
npm test

# 3. 개발 서버
npm run dev

# 4. 로컬 테스트 URL
# - 플랫폼: http://localhost:3000/platform
# - 테넌트: http://localhost:3000?tenant=chungyeon
```
