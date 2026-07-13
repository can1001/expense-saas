# SPEC — 풀 RBAC 확장 및 권한 시스템 리팩터링

> 상태: Draft · 작성일: 2026-07-13 · 대상 시스템: 지출결의서 관리 SaaS (멀티테넌트)
> 관련 문서: `SPEC_MULTI_TENANCY.md`, `SPEC_LOGIN_SECURITY_FIX.md`, `docs/APPROVAL_LINE.md`, `lib/constants/menu-permissions.ts`

---

## 1. 배경 (Background)

시스템은 "인증 없음(open access)"에서 출발해 멀티테넌트 SaaS로 진화했고, 그 과정에서 권한(authorization) 로직이 **세 갈래로 파편화**된 채 축적되었다.

1. **DB 불리언 플래그** — `Role`의 5개 플래그(`canApprove`, `canManageExpense`, `canAccessAdmin`, `canExportData`, `canRegisterUsers`)를 로그인 시 JWT에 스냅샷(`lib/auth/user.ts:55`, `app/api/auth/login/route.ts:149`).
2. **하드코딩 역할 배열** — `lib/constants/menu-permissions.ts`의 기능별 역할 리스트(`EXTENDED_MENU_ROLES`, `APPROVAL_MENU_ROLES`, `ADMIN_MENU_ROLES`, `APPROVED_EDIT_ROLES` …)와 역할별 경로 화이트리스트(`ROLE_ADMIN_MENU_PATHS`).
3. **라우트별 지역 상수** — 15개+ API 파일에 `FULL_ACCESS_ROLES` / `OFFERING_ALLOWED_ROLES` / `ACCOUNT_VIEW_ROLES` 등 유사 배열을 각자 복붙.

커밋 `3080f09`("회계·행정간사·재정팀원 대시보드/보고서 API 403 수정")은 이 파편화의 **증상**이다. 클라이언트 메뉴 가드(방식 2: 역할 코드 기반)는 접근을 허용했지만 데이터 API(방식 1: `canAccessAdmin` 불리언)는 403을 반환했고, 이를 맞추기 위해 `withAdminMenu`라는 **네 번째** 가드를 추가해야 했다. 근본 원인(단일 권한 출처의 부재)은 남아 있으므로 같은 유형의 버그가 계속 재발한다.

## 2. 문제 정의 (Problem Statement)

조사로 확인된 구체적 결함(증거 포함):

| # | 문제 | 증거 |
|---|------|------|
| P1 | **권한 판정이 두 갈래(불리언 플래그 vs 역할 배열)로 병존**하며 서로 다른 결과를 낼 수 있음 | `withAdmin`(`canAccessAdmin`) vs `ROLE_ADMIN_MENU_PATHS`; 커밋 `3080f09` |
| P2 | **JWT가 로그인 시점 `User.role` 기준 권한을 스냅샷** → 역할/권한 변경이 재로그인(24h) 전까지 반영 안 됨. 게다가 실제 유효 역할은 `UserYearRole`에서 계산(`getEffectiveRole`)되는데 로그인은 `User.role`만 사용 → 불일치 | `login/route.ts:149`, `user-service.ts:410`, `expenses/route.ts:45` |
| P3 | **역할 배열이 15개+ 파일에 복붙** → 역할 추가 시 전수 수정, 누락 위험 | `expenses/route.ts:15`, `admin/offerings/*` (4곳), `youth-night/**` (5곳), `expenses/[id]/route.ts:40` |
| P4 | **`finance_member`(재정팀원) 지원이 파일마다 누락/포함이 뒤섞임** | `getRolePermissions` switch(케이스 없음→권한 0), `getDisplayRole.ts:27`, `user-service.ts:20`(ROLE_STEP_MAP), `useRoles.ts:25`, `users/route.ts:87`(누락) vs `users/year-roles/route.ts:75`(포함) |
| P5 | **가드가 전혀 없는 API 라우트** — 인증·테넌트 격리 미보장 | `budget/search`, `budget/simple`, `budget/usage-details`, `budget/hierarchy/export`, `upload/delete` |
| P6 | **역할이 DB enum이 아닌 String**, 유효 코드가 스키마 주석에만 존재하고 그 주석조차 `finance_member` 누락 | `schema.prisma:707-708`, `Role.code`, `User.role`, `UserYearRole.role` |
| P7 | **메타데이터 중복 정의**: `ROLE_NAMES` 3중(`menu-permissions.ts:10`, `user-service.ts:30`, Role 테이블), 역할 우선순위 2중·불일치(`getDisplayRole.ts` 4종 vs `user-service.ts` 6종) | 상동 |
| P8 | **클라이언트/서버 권한 배열이 별도 관리** → 드리프트 | `Header.tsx:31` `NOTIFICATION_ALLOWED_ROLES` vs 서버 라우트 |
| P9 | **전용 `useUser`/UserContext 부재** — Header·AdminLayout·HomeClient 등이 `/api/auth/me`를 각자 fetch | `Header.tsx:298`, `AdminLayout.tsx`, `HomeClient.tsx` |
| P10 | **이중 가드 + 인라인 체크가 서로 다른 기준** | `admin/quarterly-report/export/route.ts` (래퍼 `withAdminMenu` + 인라인 `QUARTERLY_REPORT_EXPORT_ALLOWED_ROLES`) |
| P11 | **역할 검증(validRoles) 라우트 간 불일치** — 사용자 생성은 finance_member 거부, 연도역할은 허용 | `users/route.ts:87` vs `users/year-roles/route.ts:75`; `users/upload/route.ts:17`(한글명 매핑에 '재정팀원' 없음) |
| P12 | **에러 응답 형식 불일치** | `'이 작업을 수행할 권한이 없습니다.'` vs `'권한이 없습니다.'` vs `'자동이체 접근 권한이 없습니다.'` |
| P13 | (보안) **`USER_JWT_SECRET`이 `.env.example`에 없고 미설정 시 하드코딩 폴백** 사용 | `lib/auth/user.ts:11`, `proxy.ts:19` |

## 3. 목표 / 비목표 (Goals / Non-Goals)

### 3.1 목표
- **G1 — 단일 권한 출처(Single Source of Truth).** "어떤 권한이 존재하는가"는 코드 레지스트리 1곳, "역할이 어떤 권한을 갖는가"는 DB(`Role`) 1곳에서만 정의한다.
- **G2 — 하나의 인가 함수.** 서버 API 가드와 클라이언트 메뉴/버튼 노출이 **동일한** `hasPermission(session, permission)`을 사용한다. 방식 1·2·3·4를 하나로 수렴.
- **G3 — 세분화 권한(fine-grained permission).** `resource:action[.scope]` 형태의 permission으로 확장. 데이터 접근 범위(전체/부서/본인)도 permission으로 표현.
- **G4 — 유효 권한의 정합성.** `User.role` + `UserYearRole`(다중·연도별 역할)을 합집합으로 해석한 **effective permission set**을 로그인·API·클라이언트에서 동일하게 사용.
- **G5 — 실시간 반영.** 역할↔권한 매핑 변경이 재로그인 없이(또는 짧은 캐시 TTL 내) 반영.
- **G6 — 커스텀 역할 지원.** 테넌트별 `Role`(이미 `tenantId` 스코프)에 permission을 자유 배정 가능. orgType(CHURCH/COMPANY 등)에 따라 기본 프리셋과 표시 용어를 분기하되 permission 코드는 공통.
- **G7 — 하드닝.** 가드 없는 라우트 제거, `USER_JWT_SECRET` 필수화, 에러 응답 형식 통일.

### 3.2 비목표 (이번 리팩터링 범위 밖)
- 결재선/승인 워크플로 규칙 자체의 변경(`ApprovalLine`/`ApprovalStep` 로직은 유지, permission 체크만 통일).
- SuperAdmin(플랫폼) 인증을 테넌트 RBAC로 통합 — **별도 체계 유지**.
- 테넌트 격리 메커니즘(`prisma-tenant-extension.ts`) 변경 — 유지.
- 레거시 `session` 인증(`lib/auth.ts`) 제거는 **선택적 후속**(Phase 5 stretch).
- 권한 편집 관리자 UI 신규 구축은 **선택적 stretch**(핵심은 백엔드 모델·가드 통일).

## 4. 대상 설계 (Target Design)

### 4.1 개념 모델

```
User ─┬─ role (permanent, 주로 admin/user)
      └─ UserYearRole[] (연도별·부서별 기능 역할: finance_head, accountant, team_leader, …)
                    │
       effective roles = { User.role } ∪ { UserYearRole.role (해당 연도) }
                    │
Role(code, tenantId) ── permissions: string[]  ◀── 코드 레지스트리로 검증
                    │
       effective permissions = ⋃ role.permissions  (∪ 사용자 개별 grant − revoke)
                    │
       hasPermission(session, 'expense:approve') → boolean
```

### 4.2 권한 레지스트리 (코드, 단일 출처)

`lib/auth/permissions.ts` — permission 카탈로그를 **코드에서 타입 안전하게** 정의(무엇이 존재하는가의 유일 출처).

```ts
// 예시(초안). resource:action[.scope]
export const PERMISSIONS = {
  // 지출결의서
  EXPENSE_READ_OWN:        'expense:read.own',
  EXPENSE_READ_DEPARTMENT: 'expense:read.department',
  EXPENSE_READ_ALL:        'expense:read.all',
  EXPENSE_CREATE:          'expense:create',
  EXPENSE_APPROVE:         'expense:approve',
  EXPENSE_EDIT_APPROVED:   'expense:edit_approved',  // 최종승인 후 수정 (APPROVED_EDIT_ROLES)
  EXPENSE_PAYMENT_MANAGE:  'expense:payment_manage',
  EXPENSE_BULK_UPLOAD:     'expense:bulk_upload',
  EXPENSE_EXPORT:          'expense:export',
  SIMPLE_EXPENSE_USE:      'simple_expense:use',      // 간편 지출결의서 (EXTENDED_MENU)
  // 자동이체
  RECURRING_READ:          'recurring:read',
  RECURRING_MANAGE_ALL:    'recurring:manage_all',    // 본인 외 전체
  // 관리자 대시보드 · 보고서
  ADMIN_DASHBOARD_READ:    'admin:dashboard.read',
  REPORT_BUDGET_EXEC_READ: 'report:budget_execution.read',
  REPORT_HR_ADMIN_READ:    'report:hr_admin.read',
  REPORT_QUARTERLY_READ:   'report:quarterly.read',
  REPORT_CUMULATIVE_READ:  'report:cumulative.read',
  REPORT_FINANCIAL_READ:   'report:financial.read',
  REPORT_EXPORT:           'report:export',
  // 조직/예산 관리
  COMMITTEE_MANAGE:        'committee:manage',
  DEPARTMENT_MANAGE:       'department:manage',
  BUDGET_MANAGER_MANAGE:   'budget_manager:manage',
  BUDGET_VIEW:             'budget:view',
  OFFERING_MANAGE:         'offering:manage',         // 교회 전용(orgType 분기)
  // 사용자/역할/설정
  USER_READ:               'user:read',
  USER_REGISTER:           'user:register',
  USER_MANAGE:             'user:manage',
  ROLE_MANAGE:             'role:manage',
  SETTINGS_MANAGE:         'settings:manage',
  NOTIFICATION_SEND:       'notification:send',
  // 청소년부 모듈(선택)
  YOUTH_MANAGE:            'youth:manage',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
```

> 카탈로그는 초안이다. Phase 0에서 **현재 동작을 정확히 재현**하도록 각 permission이 어떤 역할 집합에 대응하는지 골든 테스트로 고정한 뒤 확정한다(§8.1).

### 4.3 역할별 기본 프리셋 (코드, seed·fallback용)

`ROLE_PERMISSION_PRESETS: Record<RoleCode, Permission[]>` — 신규 테넌트 seed와 DB 미설정 시 fallback에 사용. **런타임 권한 판정의 출처는 DB `Role.permissions`이며, 프리셋은 seed/fallback 전용**이다.

### 4.4 역할 × 권한 매트릭스 (초안)

현재 코드에서 역참조해 도출. `✔`=허용. (Phase 0 골든 테스트로 확정)

| Permission ＼ Role | admin | finance_head | accountant | finance_member | team_leader | admin_assistant | user |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| expense:read.own | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| expense:read.department | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| expense:read.all | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| expense:create | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| expense:approve | ✔ | ✔ | ✔ | | ✔ | | |
| expense:edit_approved | ✔ | ✔ | ✔ | | | ✔ | |
| expense:payment_manage | ✔ | ✔ | ✔ | | | ✔ | |
| expense:bulk_upload | ✔ | | | | | ✔ | |
| expense:export | ✔ | ✔ | | | | | |
| simple_expense:use | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| recurring:read / manage_all | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| admin:dashboard.read | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| report:budget_execution.read | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| report:hr_admin.read | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| report:quarterly.read | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| report:cumulative.read | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| report:financial.read | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| offering:manage (교회 전용) | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| committee/department/budget_manager:manage, budget:view | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| expense:bulk_upload | ✔ | | | | | ✔ | |
| notification:send | ✔ | ✔ | ✔ | | | ✔ | |
| user:register | ✔ | (개별 플래그) | | | | | |
| user:manage / role:manage / settings:manage | ✔ | | | | | | |

> `user:register`는 현재 역할 플래그(`Role.canRegisterUsers`) + 사용자 개별 플래그(`User.canRegisterUsers`)의 OR이다(§4.6 개별 grant로 일반화).

### 4.5 데이터 모델 변경

**`Role`** — 5개 불리언 플래그를 permission 배열로 대체.

```prisma
model Role {
  id          String   @id @default(cuid())
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  code        String
  name        String
  description String?
  stepNumber  Int?
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)

  permissions String[] // ◀ 신규: permission 코드 배열 (Postgres text[])

  // canApprove / canManageExpense / canAccessAdmin / canExportData / canRegisterUsers
  //   → Phase 1~4 동안 유지(dual-read), Phase 5에서 제거

  users         User[]         @relation("UserRole")
  userYearRoles UserYearRole[] @relation("YearRole")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([tenantId, code])   // ◀ 테넌트 내 code 유니크 명시(현재 주석만 존재)
}
```

**설계 선택 — `Role.permissions String[]` vs 정규화 `Permission` + `RolePermission` 조인 테이블**

| | `String[]` (권장) | 조인 테이블 |
|---|---|---|
| 규모 적합성 | ✔ permission ~30개, 테넌트별 역할 소수 | 오버엔지니어링 |
| "권한 X 가진 역할 조회" | 배열 contains 쿼리 | 조인으로 용이 |
| 무결성 | 코드 레지스트리로 검증(런타임) | FK로 DB 강제 |
| 마이그레이션 비용 | 낮음 | 높음(테이블 2개 + 시드) |

→ **권장: `Role.permissions String[]`.** permission 카탈로그는 코드에서 타입 안전하게 관리하고, 쓰기 시 레지스트리로 검증한다. 현 규모에서 조인 테이블은 복잡성 대비 이득이 없다.

**역할 코드 무결성(P6)** — DB enum 전환은 마이그레이션 비용이 크므로, `RoleCode` 상수/Zod enum을 **애플리케이션 레이어 단일 출처**로 두고 모든 validRoles 하드코딩(P11)을 이것으로 대체한다. (DB enum 전환은 Open Question OQ2.)

### 4.6 사용자 개별 권한 override (선택)

현재 `User.canRegisterUsers` 개별 플래그를 일반화. 필요 시:
```prisma
grantedPermissions String[]  // 역할 외 추가 부여
revokedPermissions String[]  // 역할에서 제외
```
`user:register`는 이 메커니즘의 첫 사례가 된다. **YAGNI 원칙**상 실제 요구가 있는 `user:register`만 우선 이관하고 일반 override는 Open Question(OQ3).

### 4.7 인가 함수 (단일 출처)

`lib/auth/permissions.ts`:
```ts
// 세션의 effective permission 집합 계산
resolvePermissions(session): Set<Permission>
// 서버·클라이언트 공통 판정
hasPermission(session, permission: Permission): boolean
hasAnyPermission(session, ...permissions): boolean
```

**서버 가드** — `lib/auth/user.ts`의 가드를 permission 코드 기반으로 통일:
```ts
export const GET = withPermission(PERMISSIONS.ADMIN_DASHBOARD_READ, handleGet);
```
`withAdmin` / `withAdminMenu` / 불리언 `withPermission` / 라우트별 인라인 배열 → 전부 `withPermission(code)`로 수렴. 데이터 범위(read.own/department/all)는 핸들러에서 `hasPermission`으로 분기(현 `expenses/route.ts:63` 로직을 permission 기반으로 교체).

**클라이언트** — 메뉴를 데이터로 선언:
```ts
{ href: '/admin/budget-execution', label: '사역비 집행', requiredPermission: PERMISSIONS.REPORT_BUDGET_EXEC_READ }
```
`filterMenu(menu, session)`가 `hasPermission`으로 필터. `ROLE_ADMIN_MENU_PATHS` 및 기능별 역할 배열 전부 제거.

### 4.8 토큰 / 세션 (P2 해결)

**현재**: JWT에 `User.role` 기준 권한 5개를 스냅샷 → stale + effectiveRole 불일치.

**변경(권장)**: JWT는 **신원 + effective role 코드 목록**만 담고, permission은 요청 시 서버에서 역할 정의(캐시)로 해석한다.
```ts
// JWT payload
{ sub, tenantId, userid, username, roles: string[] /* effective */, }
```
- 서버: `withAuth`가 `resolvePermissions`로 permission 집합을 계산(테넌트 역할 정의는 5분 캐시, 역할 수정 시 무효화 — `lib/tenant.ts` 캐시 패턴 재사용).
- 클라이언트: `/api/auth/me`가 `permissions: string[]`을 반환, `UserProvider`(신규 Context)가 보관(P9 해결).
- 효과: 역할 권한 변경이 재로그인 없이 반영(G5), effectiveRole/연도역할과 로그인이 동일 경로 사용(G4).

> 대안(경량): 기존처럼 JWT에 permission 배열을 담되 로그인·`/me`가 **동일한 `resolvePermissions`를 사용**하도록만 통일. G5(실시간 반영)는 포기하나 변경 범위가 작다. → §11 리스크에서 선택.

## 5. 영향 범위 (Impact Surface)

- API 라우트 **약 124개**, 이 중 가드 사용 파일 약 99개(`withAuth` ~111, `withAdmin` 38, `withSuperAdmin` 24, `withAdminMenu` 6, `withPermission` 4 호출).
- `menu-permissions.ts` import 16개 파일.
- 하드코딩 역할 배열 보유 15개+ 파일(§P3).
- 클라이언트 권한 분기: `Header.tsx`, `HomeClient.tsx`, `AdminLayout.tsx`, `AdminSidebar.tsx`.
- 스키마 마이그레이션: `Role`(permissions 추가), seed(`prisma/seed.ts`, 테넌트별 역할 시드).

## 6. 마이그레이션 전략 (단계별, 하위 호환)

각 Phase는 독립 배포 가능하고 이전 Phase 대비 **동작 불변(behavior-preserving)**을 원칙으로 한다.

- **Phase 0 — 기반(비파괴).** 권한 레지스트리(`PERMISSIONS`), 프리셋(`ROLE_PERMISSION_PRESETS`), `resolvePermissions`/`hasPermission` 구현. 단, 초기 구현은 **현재의 불리언 플래그 + 역할 배열로부터 permission을 유도**해 기존 동작을 100% 재현. 골든 테스트(§8.1)로 고정. 아직 호출부 교체 없음.
- **Phase 1 — 스키마.** `Role.permissions String[]` 추가, `@@unique([tenantId, code])` 명시. 마이그레이션으로 기존 역할을 프리셋 기준 backfill. `resolvePermissions`를 **dual-read**(permissions[] 있으면 사용, 없으면 플래그/배열 유도)로 전환. `RoleCode`/validRoles 단일 상수 도입, P11 하드코딩 검증 배열 이관.
- **Phase 2 — 서버 가드 통일.** 모든 API를 `withPermission(code)`로 교체. 인라인 역할 배열(P3)·이중 가드(P10) 제거. **가드 없는 라우트(P5)에 가드 추가.** 에러 응답 형식 통일(P12). orgType 분기(offering 등) 유지.
- **Phase 3 — 클라이언트 통일.** `UserProvider`/`useUser` 도입(P9), 메뉴를 `requiredPermission` 데이터로 선언, `filterMenu(hasPermission)` 적용. `menu-permissions.ts`의 역할 배열/경로 화이트리스트 제거. `NOTIFICATION_ALLOWED_ROLES`(P8) 등 컴포넌트 하드코딩 제거.
- **Phase 4 — 토큰/세션 정합.** JWT를 roles-only로 전환, permission 서버 해석(캐시)로 이동(§4.8). 로그인·`/me`가 동일 `resolvePermissions` 사용(P2 해결). `USER_JWT_SECRET` 필수화 + `.env.example` 문서화(P13).
- **Phase 5 — 정리(파괴적, 최종).** `Role`/JWT/`UserSession`에서 5개 불리언 플래그 제거, `getRolePermissions` switch 제거(P4 잔재 제거). `ROLE_NAMES`/우선순위 단일화(P7). (stretch) 레거시 `session` 인증·`extractSubdomain` 중복 정리.

## 7. 작업 분해 (Task Breakdown)

> `planning-and-task-breakdown` 스킬로 각 Phase를 세부 태스크로 분해하고, 태스크마다 수용 기준·의존성을 부여한다. 아래는 상위 태스크.

- **T0.1** permission 카탈로그·프리셋·매트릭스 확정(현행 역참조 + 골든 테스트)
- **T0.2** `resolvePermissions`/`hasPermission` + 유도 어댑터(기존 동작 재현) + 테스트
- **T1.1** Prisma `Role.permissions` 추가 + 마이그레이션 + backfill 스크립트
- **T1.2** `RoleCode`/validRoles 단일 상수, 하드코딩 검증 배열(P11) 이관
- **T1.3** `resolvePermissions` dual-read 전환
- **T2.1** 서버 가드 permission 코드화(라우트군별: expenses / admin-reports / offerings / recurring / users / youth / budget)
- **T2.2** 무가드 라우트에 가드 추가(P5), 이중 가드 제거(P10), 에러 형식 통일(P12)
- **T3.1** `UserProvider`/`useUser` + `/api/auth/me` permission 반환
- **T3.2** 메뉴 데이터화(`requiredPermission`) + `filterMenu`, 컴포넌트 하드코딩 제거
- **T4.1** JWT roles-only 전환 + 서버 permission 해석(캐시·무효화)
- **T4.2** `USER_JWT_SECRET` 필수화 + `.env.example`
- **T5.1** 불리언 플래그·`getRolePermissions` switch 제거, 메타데이터 단일화
- **T5.2** (stretch) 레거시 `session` 인증 정리, 권한 편집 관리자 UI

## 8. 검증 / 테스트 전략

### 8.1 골든(특성화) 테스트 — Phase 0 선행 필수
리팩터링 전, **모든 (역할 × 라우트/메뉴) 조합의 현재 허용/거부 결과를 스냅샷**하는 테스트를 작성한다. `role ∈ {admin, finance_head, accountant, finance_member, team_leader, admin_assistant, user}` × 주요 API·메뉴. 이후 모든 Phase에서 이 스냅샷이 **불변**이어야 한다(의도된 변경은 명시적으로 스냅샷 갱신).
- 특히 커밋 `3080f09`가 다룬 admin 리포트 6종, `finance_member`/`admin_assistant`의 대시보드·보고서 접근이 회귀하지 않음을 고정.

### 8.2 단위 테스트
- `resolvePermissions`: 단일역할/다중 UserYearRole/연도 경계/admin 특권/개별 grant.
- `hasPermission`: 각 permission × 프리셋.

### 8.3 통합/E2E
- 기존 `e2e/`·`lib/__tests__/tenant-isolation.test.ts` 재사용. 역할별 로그인 → 메뉴 노출과 API 응답(200/403)이 **일치**함을 검증(P1 재발 방지의 핵심 게이트).

### 8.4 수용 기준 (Acceptance Criteria)
- **AC1** 클라이언트에 노출된 모든 메뉴·버튼은 대응 API가 200을 반환한다(노출=허용). 반대로 숨겨진 메뉴의 API는 403. (P1)
- **AC2** 권한 판정 로직은 `hasPermission` 1곳을 통해서만 이뤄진다. `grep`으로 `role === '...'` / 지역 역할 배열이 인가 목적에 남아 있지 않다(데이터 조회 편의용 제외, 그마저도 상수화). (P3, P8)
- **AC3** 관리자가 `Role.permissions`를 바꾸면 (Phase 4 기준) 재로그인 없이 캐시 TTL 내 반영된다. (P2, G5)
- **AC4** `finance_member` 포함 7개 역할 전체가 모든 경로에서 일관되게 처리된다(누락 0). (P4, P11)
- **AC5** 가드 없는 API 라우트가 0이다(의도적 공개 라우트는 명시적 화이트리스트 + 주석). (P5)
- **AC6** 골든 테스트 스냅샷이 리팩터링 전후 동일(의도된 diff는 리뷰 승인). (전체)
- **AC7** `USER_JWT_SECRET` 미설정 시 프로덕션 부팅 실패(폴백 제거). (P13)

## 9. 롤백 계획
- Phase 0~3은 동작 불변 + dual-read이므로 각 Phase 커밋 단위 revert 가능.
- Phase 4(JWT 구조 변경)는 토큰 하위호환 위험 → 배포 시 **기존 토큰도 검증 가능하도록** 한 릴리스간 both-shape 허용 후 다음 릴리스에서 정리. 문제 시 이전 로그인 응답 형태로 revert.
- Phase 5(플래그 제거)는 최종·비가역 → AC6 골든 테스트 그린 확인 후에만 진행.

## 10. 리스크 & 완화
| 리스크 | 영향 | 완화 |
|---|---|---|
| 매트릭스 오도출로 권한 축소/확대 | 사용자 접근 불가 또는 과다 노출 | 현행 역참조 + 골든 테스트로 고정, Phase별 동작 불변 |
| 124개 라우트 대량 수정 중 누락 | 일부 라우트 회귀 | 라우트군별 분할(T2.1), 통합 테스트로 게이트 |
| JWT 구조 변경(Phase 4) | 기존 세션 무효화/로그인 루프 | both-shape 허용 한 릴리스, `6a89705`(로그인 루프) 재발 주의 |
| permission 서버 해석 +쿼리 | 지연 | 테넌트 역할 정의 5분 캐시(기존 패턴), 무효화 훅 |
| 캐시 무효화 누락 | stale 권한 | 역할/사용자역할 쓰기 경로에서 `invalidate` 호출, TTL 상한 |

## 11. 미해결 질문 (Open Questions)
- **OQ1** Phase 4의 토큰 전략: roles-only + 서버 해석(실시간성 ↑, 요청당 캐시조회) vs permission 스냅샷 통일(변경 작음, 실시간성 ↓). → 권장은 roles-only이나 실시간 반영 요구 강도에 따라 결정.
- **OQ2** `Role.code`/`User.role`을 DB enum으로 승격할지, 애플리케이션 레이어 `RoleCode` 상수로만 강제할지. (테넌트 커스텀 역할이 임의 code를 가질 수 있으면 enum 불가 → 아마 상수 유지)
- **OQ3** 사용자 개별 permission override(`grantedPermissions`/`revokedPermissions`)를 지금 도입할지, `user:register`만 이관하고 뒤로 미룰지.
- **OQ4** 권한 편집 관리자 UI를 이번 범위에 포함할지(현재 `Role` 편집은 `app/admin/roles`, `hooks/useRoles.ts` 존재).
- **OQ5** 레거시 `session` 인증(`lib/auth.ts`, `me`/`logout` 병행 참조)을 Phase 5에서 제거할지 유지할지.
- **OQ6** 매트릭스 초안(§4.4)의 각 셀은 현행 역참조 기반 **추정**이다. 실제 정책과 일치하는지 도메인 확인 필요(특히 `expense:export`, `notification:send`, `offering:manage`의 역할 범위).

## 12. 참고 — 현행 코드 지도
- 인가: `lib/auth/user.ts`(가드), `lib/constants/menu-permissions.ts`(역할 배열/경로), `lib/services/user-service.ts`(`getEffectiveRole`, `ROLE_PRIORITY`)
- 세션/토큰: `app/api/auth/login/route.ts`, `app/api/auth/me/route.ts`, `proxy.ts`
- 테넌트 격리: `lib/prisma-tenant-extension.ts`, `lib/tenant-context.ts`, `lib/tenant.ts`
- 클라이언트: `components/Header.tsx`, `components/HomeClient.tsx`, `components/admin/AdminLayout.tsx`, `components/admin/AdminSidebar.tsx`, `hooks/useRoles.ts`
- 스키마: `prisma/schema.prisma`(`Role` 711-742, `User` 745-795, `UserYearRole` 798-823)
