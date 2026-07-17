# TASKS — SaaS 멀티테넌트 고도화 (단일 truth)

> 진행 상태: `PRD_SAAS_MULTITENANT.md` (레포 루트)
> 설계서: `docs/EXP-2026-ARC-001-multitenant-architecture.md` (템플릿/프로비저닝),
> `docs/EXP-2026-ARC-002-mobile-multitenancy.md` (Membership/서버 주도 설정),
> `docs/EXP-2026-ARC-003-kakao-login.md` (카카오 로그인)

## 공통 원칙

1. **복제 후 독립**: 템플릿(전역)과 테넌트 복제본은 FK로 묶지 않는다. `sourceTemplateId`는 String만 저장 (ARC-001 §2.2).
2. **tenantId는 토큰 안에만**: 클라이언트가 바디/쿼리로 tenantId를 보내는 경로를 새로 만들지 않는다. 서버는 `lib/auth/user.ts`의 JWT 클레임과 `lib/tenant-context.ts`로만 스코프 (ARC-002 §3).
3. **인증과 소속의 분리**: 소셜 로그인은 "누구인지"만, 소속은 Membership이 결정 (ARC-003 §1). 카카오 이메일 기반 자동 병합 **금지** (ARC-003 §4).
4. **DB 무실행**: 루프에서 `prisma db push`, `prisma migrate`, 시드/백필 **실행 금지**. 스키마 검증은 `pnpm exec prisma validate` + `pnpm exec prisma generate`, 로직 검증은 vitest(모킹)로 한다. 실행이 필요한 것은 PRD의 M 게이트로 넘긴다.
5. **기존 구조 존중**: Budget 5단계 모델·화면, FastAPI 커토버 결과물(`lib/api/api-base.ts` 등), 기존 로그인 흐름(플래그 off 상태)은 회귀 없어야 한다.
   - **확정 결정 (2026-07-18, 사용자)**: `AccountCategory`(ARC-001 계정과목)와 기존 Budget 5단계(위원회→부서→항→목→세목)는 **공존**한다. AccountCategory는 병행 신규 모델이며 Budget 계층을 대체·수정·연결하지 않는다. 두 구조의 통합 여부는 이번 루프 범위 밖 — 재검토하지 말 것.
6. **기존 관례 준수**: API 라우트는 `app/api/**/route.ts` + `lib/services`/`lib/validators` 계층, 한국어 에러 메시지, vitest는 인접 `__tests__/` 디렉터리 관례를 따른다. 문서의 파일 경로는 작성 시점 기준이므로 grep으로 재확인한다.

---

## Phase A — 템플릿 · 프로비저닝 (ARC-001)

### A1. 스키마 추가 — 템플릿/복제 모델

**Description**: `prisma/schema.prisma`에 아래를 추가한다. 기존 모델은 수정하지 않는다.

- `enum CategoryKind { INCOME EXPENSE }`
- `AccountCategoryTemplate` — 전역 청사진. 필드: id, orgType(OrgType), code(String), name, group(코드대 그룹명), kind(CategoryKind @default(EXPENSE)), sortOrder(Int), isActive(Boolean @default(true)), createdAt/updatedAt. `@@unique([orgType, code])`.
- `AccountCategory` — 테넌트 복제본. 필드: id, tenantId(+Tenant relation), code, name, group, kind, sortOrder, isActive, `sourceTemplateId String?`(**FK 없음**), createdAt/updatedAt. `@@unique([tenantId, code])`, `@@index([tenantId])`.
- `ApprovalLineTemplate` — 전역 결재선 청사진. 필드: id, orgType, name, description?, isDefault(Boolean @default(false)), sortOrder, steps 관계, createdAt/updatedAt.
- `ApprovalStepTemplate` — 필드: id, templateId(+relation, onDelete: Cascade), stepOrder(Int), roleLabel(String — "부서장", "재정부장" 등 역할 표기), createdAt.
- `Tenant`에 `accountCategories AccountCategory[]` 역관계 추가(기존 필드 변경 없음).

기존 `ApprovalLine`/`ApprovalStep`(테넌트 결재선)은 이미 존재하므로 재사용하고, 복제 시 매핑은 A4에서 다룬다.

**Files**: `prisma/schema.prisma`

**Acceptance**:
- 기존 모델의 필드·인덱스 변경 없음 (`git diff`로 확인)
- 템플릿 모델 ↔ 복제 모델 간 Prisma relation 없음 (sourceTemplateId는 String)

**Verify**:
```bash
pnpm exec prisma validate
pnpm exec prisma generate
pnpm exec tsc --noEmit
```

### A2. COMPANY 템플릿 시드 스크립트

**Description**: `prisma/seeds/company-template-seed.ts` 작성. 기존 청연컨설팅 시드(`prisma/seeds/chungyeon-consulting-seed.ts`)의 계정과목을 `AccountCategoryTemplate`(orgType: COMPANY)로 승격한다 (ARC-001 §7-1). 결재선 템플릿 1종(팀장 → 본부장 → 대표, isDefault)도 포함. **upsert 방식**(`@@unique([orgType, code])` 기준) — 재실행 안전해야 한다. 기존 시드 파일의 등록 방식(`prisma/seeds/` 안 다른 시드의 export/실행 패턴)을 그대로 따르되, 루프에서 실제 실행은 하지 않는다.

**Files**: `prisma/seeds/company-template-seed.ts` (신규), 시드 러너 등록 파일(grep으로 확인: `grep -rn "chungyeon-consulting-seed" prisma/ package.json`)

**Acceptance**:
- 청연컨설팅 시드의 지출 계정과목이 코드·이름 보존된 채 템플릿 데이터로 정의됨 (kind: EXPENSE, 수입 항목 있으면 INCOME)
- upsert만 사용, delete 없음

**Verify**:
```bash
pnpm exec tsc --noEmit
pnpm run lint
```

### A3. CHURCH 템플릿 시드 스크립트

**Description**: `prisma/seeds/church-template-seed.ts` 작성 (ARC-001 §5). 계정과목 46건 — 코드 체계는 §5.1 표(10xx 헌금수입 ~ 59xx 상회비·적립·예비)를 따르고, 10xx/19xx는 `kind: INCOME`, 5xxx는 `kind: EXPENSE`. 결재선 템플릿 2종: "일반 지출 결재선"(부서장→재정부장→담임목사, isDefault) + "고액 지출 결재선"(…→당회서기). upsert 방식.

**Files**: `prisma/seeds/church-template-seed.ts` (신규), 시드 러너 등록

**Acceptance**:
- 계정과목 46건 정확히 정의 (그룹·코드대 §5.1과 일치)
- 결재선 2종·단계 구성 §5.2와 일치

**Verify**:
```bash
pnpm exec tsc --noEmit
pnpm run lint
```

### A4. `provisionTenant()` 트랜잭션 서비스

**Description**: `lib/services/provision-tenant.ts` 작성 (ARC-001 §4). 단일 `prisma.$transaction`으로:

1. `Tenant` 생성 — orgType별 기본 settings(A6 기본값 헬퍼 사용) 복사
2. `AccountCategoryTemplate`(해당 orgType) → `AccountCategory` 복제, `sourceTemplateId` 기록
3. `ApprovalLineTemplate` → 기존 `ApprovalLine`/`ApprovalStep` 모델로 복제 (첫 번째/isDefault를 기본값으로). 기존 ApprovalLine 스키마의 필수 필드는 grep으로 확인해 매핑하고, 역할 매칭이 필요한 필드는 roleLabel 텍스트를 보존하는 수준으로 처리(무리한 자동 역할 연결 금지)
4. 테넌트 어드민 `User` 생성 (기존 `lib/auth/user.ts` 해시 관례 사용)

부분 생성 방지: 어느 단계가 실패해도 전부 롤백. 입력/출력 타입은 zod 스키마(`lib/validators` 관례)로 정의.

**Files**: `lib/services/provision-tenant.ts` (신규), `lib/services/__tests__/provision-tenant.test.ts` (신규)

**Acceptance**:
- 단일 트랜잭션 (vitest에서 `$transaction` 사용을 모킹으로 검증)
- 템플릿 없음(해당 orgType 0건)일 때도 Tenant+User는 생성되고 경고 반환
- 복제본에 sourceTemplateId 기록

**Verify**:
```bash
pnpm exec vitest run lib/services/__tests__/provision-tenant.test.ts
pnpm run lint
```

### A5. 플랫폼 어드민 테넌트 생성 전환

**Description**: 플랫폼(슈퍼 어드민) 테넌트 생성 API를 `provisionTenant()` 경유로 전환한다. 현재 생성 경로는 `grep -rn "tenant" app/api/platform --include=route.ts -l`로 찾는다. 기존 요청/응답 계약은 유지하고 내부 구현만 교체. `PlatformActivityLog` 기록 관례가 있으면 유지.

**Files**: `app/api/platform/**/route.ts` 중 테넌트 생성 라우트 (grep으로 특정), 관련 테스트

**Acceptance**:
- 기존 API 계약(요청 바디·응답 형태) 무변경
- 생성 시 orgType 템플릿 복제가 함께 일어남 (테스트로 검증)

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
```

### A6. `Tenant.settings` labels/features 표준화

**Description**: ARC-001 §3.3 구조(`labels`, `features`)를 타입으로 확정하고 헬퍼를 만든다.

- `lib/tenant/settings.ts` (신규): `TenantSettings` 타입(zod), orgType별 기본값(`CHURCH`: incomeModule/offeringLink true·vat/taxInvoice false, `COMPANY`: 반대 — §3.3 표), `resolveTenantSettings(tenant)` — 저장값과 기본값 딥머지.
- 기존 `lib/org-terms.ts`가 하드코딩 레이블을 갖고 있으면, settings.labels가 있을 때 그것을 우선하도록 통합(기존 호출부 시그니처는 유지).
- 운영 원칙 주석: 플래그는 "노출 제어"이지 "데이터 제어"가 아님 (§3.3).

**Files**: `lib/tenant/settings.ts` (신규), `lib/org-terms.ts`, `lib/tenant/__tests__/settings.test.ts` (신규)

**Acceptance**:
- orgType별 기본값이 §3.3 표와 일치 (테스트)
- settings 저장값이 기본값을 부분 override (딥머지 테스트)

**Verify**:
```bash
pnpm exec vitest run lib/tenant
pnpm run lint
```

---

## Phase B — Membership · 서버 주도 설정 (ARC-002)

### B1. `Membership` 모델 + 백필 스크립트

**Description**: ARC-002 §2.2.

- 스키마: `model Membership { id, userId(+User relation), tenantId(+Tenant relation), role String, isDefault Boolean @default(false), createdAt/updatedAt, @@unique([userId, tenantId]), @@index([tenantId]) }`. **`User.tenantId`는 제거하지 않는다** — 점진 전환(기존 코드 전체가 참조 중).
- 백필 스크립트 `scripts/backfill-memberships.ts`: `User.tenantId`가 있는 모든 유저에 Membership upsert (role은 기존 `User.role`이 TENANT_ADMIN성 역할이면 `TENANT_ADMIN`, 아니면 `MEMBER`; isDefault true). dry-run 옵션(`--dry-run`) 포함. **루프에서 실행하지 않는다** (M2 게이트).
- `lib/services/membership.ts`: `getMemberships(userId)`, `assertMembership(userId, tenantId)` 헬퍼.
- `provisionTenant()`(A4)의 어드민 User 생성에 Membership 생성 추가.

**Files**: `prisma/schema.prisma`, `scripts/backfill-memberships.ts` (신규), `lib/services/membership.ts` (신규) + 테스트, `lib/services/provision-tenant.ts`

**Acceptance**:
- User.tenantId 무변경, Membership은 추가 전용
- `assertMembership`이 미소속 시 한국어 메시지로 throw (테스트)

**Verify**:
```bash
pnpm exec prisma validate && pnpm exec prisma generate
pnpm exec vitest run
pnpm run lint
```

### B2. 로그인 확장 — 소속 목록/조직 선택

**Description**: 로그인 API(`app/api/auth/login/route.ts`)를 확장한다 (ARC-002 §2.2).

- 인증 성공 후 `getMemberships()` 조회. **Membership이 없으면 기존 동작(User.tenantId) 그대로** — 백필 전 회귀 방지가 최우선.
- 단일 소속: 기존과 동일하게 해당 tenantId로 토큰 발급.
- 복수 소속: `{ requiresTenantSelection: true, memberships: [{tenantId, tenantName, orgType, role}] }` 응답 + tenantId 없는 **선택용 임시 토큰**(짧은 만료, 별도 클레임 `pendingTenantSelection: true`)을 발급. 최종 토큰은 B3의 switch-tenant로 발급.

**Files**: `app/api/auth/login/route.ts`, `lib/auth/user.ts`, 인접 `__tests__`

**Acceptance**:
- Membership 0건 유저의 로그인 응답이 기존과 바이트 수준 동일 (기존 테스트 무변경 통과)
- 복수 소속 시 최종 토큰이 바로 발급되지 않음 (테스트)

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
```

### B3. `POST /api/auth/switch-tenant`

**Description**: ARC-002 §3.2. 바디 `{ tenantId }` — **이 API가 tenantId를 바디로 받는 유일한 예외**(전환 대상 지정이 목적이고, 서버가 Membership으로 권한 검증하므로 안전).

1. 현재 토큰 검증 (정식 토큰 또는 B2의 선택용 임시 토큰)
2. `assertMembership(userId, tenantId)` — 실패 시 403
3. 새 tenantId 클레임으로 `user_token` 재발급 (기존 `lib/auth/user.ts` 발급 함수 재사용)
4. 응답에 최소 유저/테넌트 정보 반환 (me 응답 관례 참고)

**Files**: `app/api/auth/switch-tenant/route.ts` (신규), `lib/auth/user.ts`, 인접 `__tests__`

**Acceptance**:
- 미소속 tenantId 요청 시 403 + 토큰 무변경 (테스트)
- 토큰의 tenantId를 클라이언트가 직접 바꿀 수 있는 다른 경로 없음

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
```

### B4. `GET /api/me/config`

**Description**: ARC-002 §4.1 응답 계약 그대로 구현: `{ tenant: {id, name, orgType}, labels, features, branding: {logoUrl, primaryColor} }`. `resolveTenantSettings()`(A6) 사용. branding은 `Tenant.logoUrl` + settings의 primaryColor(없으면 기본값). 인증 필수(기존 me 라우트의 인증 헬퍼 재사용).

**Files**: `app/api/me/config/route.ts` (신규), 인접 `__tests__`

**Acceptance**:
- 응답 형태가 §4.1 예시와 키 단위로 일치 (테스트)
- 미인증 401

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
```

### B5. 조직 선택/전환 UI + 서버 주도 렌더링

**Description**: ARC-002 §2.2, §4.2.

- 로그인 후 `requiresTenantSelection`이면 조직 선택 화면 표시 → 선택 시 switch-tenant 호출 → 진입. 단일 소속은 기존 흐름 그대로.
- 설정/프로필 영역(기존 위치 grep: `grep -rn "로그아웃" components app --include=*.tsx -l`)에 "조직 전환" 메뉴 — 복수 소속일 때만 노출.
- `/me/config`를 로그인/전환 시 조회해 컨텍스트로 보관 (`lib/contexts` 관례 확인). 레이블은 하드코딩 대신 config.labels 우선(기존 org-terms 소비처와 자연 연결), `features.incomeModule === false`면 수입(헌금) 메뉴 미노출.
- 캐시: localStorage 캐시 + 포그라운드/포커스 시 재검증 (§4.2 표).

**Files**: 로그인 페이지·네비게이션·컨텍스트 (grep으로 특정: `app/login`, `components/NavBar*`, `lib/contexts/**`), `components/TenantSwitcher.tsx` (신규) 등 + 테스트

**Acceptance**:
- 단일 소속 사용자 UX 무변경
- incomeModule off 테넌트에서 수입 메뉴 미노출 (테스트 또는 명시적 조건 렌더링 확인)

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
pnpm run build
```

### B6. FCM 토픽 테넌트 스코프

**Description**: ARC-002 §6. 현재 FCM 구현(`FcmToken` 모델, `grep -rn "fcm" lib app/api -il`)을 확인하고:

- 토픽 명명을 `tenant_{tenantId}_...` 스코프로 정리 (이미 스코프돼 있으면 검증만 하고 문서화)
- 디바이스 토큰 등록 시 tenantId 저장 확인 (FcmToken에 없으면 스키마에 추가)
- 조직 전환(B3/B5) 시: 이전 테넌트 토픽 구독 해제 → 새 테넌트 토픽 구독. 클라이언트 훅과 서버 양쪽 반영.

**Files**: FCM 관련 lib/api/컴포넌트 (grep으로 특정), 필요시 `prisma/schema.prisma` + 테스트

**Acceptance**:
- 전환 후 이전 테넌트 토픽 구독이 남지 않음 (로직 테스트)
- 토픽 문자열 생성이 단일 유틸로 집중됨

**Verify**:
```bash
pnpm exec prisma validate 2>/dev/null; pnpm exec vitest run
pnpm run lint
```

### B7. 보안 점검 — tenantId 클라이언트 수신 경로 제거

**Description**: ARC-002 §3.1, 체크리스트 마지막 항목. `app/api` 전체에서 요청 바디·쿼리로 tenantId를 받는 경로를 전수 조사한다:

```bash
grep -rn "tenantId" app/api --include=route.ts | grep -viE "getTenant|session|context|token|claim" | sort
```

- 각 발견 지점을 토큰/컨텍스트 기반(`lib/tenant-context.ts`, `lib/auth/user.ts`)으로 교체.
- **예외**: `/api/auth/switch-tenant`(B3 — Membership 검증됨), `/api/platform/**`(슈퍼 어드민 — 별도 인증 경계). 예외는 결과 문서에 사유와 함께 명시.
- 결과를 `docs/SECURITY_TENANT_SCOPE_AUDIT.md`에 표로 기록 (경로 / 처리 / 사유).

**Files**: 발견된 라우트들, `docs/SECURITY_TENANT_SCOPE_AUDIT.md` (신규)

**Acceptance**:
- 위 grep 재실행 시 예외 목록 외 잔여 0건
- 기존 테스트 전체 통과 (계약 회귀 없음)

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
```

---

## Phase C — 카카오 로그인 (ARC-003)

### C1. `AuthAccount` 모델 + email provider 통합

**Description**: ARC-003 §3의 스키마 그대로 `AuthAccount` 추가 (`@@unique([provider, providerUserId])`, `@@index([userId])`, User에 `authAccounts AuthAccount[]`). 통합 방식:

- **기존 로그인 로직은 변경하지 않는다** (userid/password 검증 그대로).
- 백필 스크립트 `scripts/backfill-auth-accounts.ts`: password 있는 유저에 `provider: "email", providerUserId: <userid 또는 email>` upsert. 루프에서 실행 금지(M2 게이트에 병합).
- `lib/services/auth-account.ts`: `findUserByProvider(provider, providerUserId)`, `linkAuthAccount(userId, provider, providerUserId)` 헬퍼 + 테스트.

**Files**: `prisma/schema.prisma`, `scripts/backfill-auth-accounts.ts` (신규), `lib/services/auth-account.ts` (신규) + 테스트

**Acceptance**:
- 기존 로그인 테스트 무변경 통과
- `linkAuthAccount`가 이미 다른 유저에 연결된 (provider, providerUserId)면 한국어 에러 (테스트)

**Verify**:
```bash
pnpm exec prisma validate && pnpm exec prisma generate
pnpm exec vitest run
pnpm run lint
```

### C2. `POST /api/auth/kakao`

**Description**: ARC-003 §2. 바디 `{ kakaoAccessToken }` (또는 OIDC `idToken` — 환경변수 `KAKAO_USE_OIDC`로 분기 가능하게, 초기 구현은 access token + kapi).

1. 서버에서 `kapi.kakao.com/v2/user/me` 호출로 토큰 검증 + 카카오 회원번호 획득. **클라이언트가 보낸 토큰을 그대로 신뢰하지 않는다.**
2. `findUserByProvider("kakao", id)` 조회:
   - 연결 있음 → B2와 동일한 소속 결정 로직 → 자체 `user_token` JWT 발급 (tenantId 클레임 유지 — ARC-002 구조 그대로)
   - 연결 없음 → `{ linked: false }` + 초대 안내용 응답 (C4 화면에서 사용). **이메일 매칭 자동 병합 금지.**
3. 카카오 API 호출은 `lib/services/kakao.ts`로 분리, 테스트에서 fetch 모킹.
4. 환경변수: `KAKAO_REST_API_KEY` 등 — `.env` 없이도 코드가 죽지 않게 미설정 시 503 + 한국어 메시지.

**Files**: `app/api/auth/kakao/route.ts` (신규), `lib/services/kakao.ts` (신규), 인접 `__tests__` (kapi 모킹)

**Acceptance**:
- kapi 검증 실패(401/만료) 시 자체 토큰 미발급 (테스트)
- 카카오 토큰이 세션으로 쓰이지 않음 — 응답은 항상 자체 JWT 쿠키 (§2 핵심 규칙)

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
```

### C3. 초대 플로우

**Description**: ARC-003 §4.2 — 초대 토큰이 본인 증명.

- 스키마: `model Invitation { id, tenantId(+relation), email String?, role String @default("MEMBER"), token String @unique, expiresAt DateTime, acceptedAt DateTime?, invitedById String?, createdAt }`.
- 테넌트 어드민 API: `POST /api/admin/invitations` (생성, 토큰은 랜덤 32바이트), `GET /api/admin/invitations` (목록). 기존 admin 라우트의 권한 검증 관례(grep: `app/api/admin/users`)를 따른다.
- 수락 API: `POST /api/auth/accept-invitation` — 바디 `{ inviteToken, kakaoAccessToken? , userid?, password?, username }`:
  - 초대 토큰 검증(만료·기수락) → User 생성(또는 카카오 로그인 상태면 기존 User) + Membership 생성 + (카카오면) AuthAccount 연결 → 자체 JWT 발급.
- 초대 수락 페이지 `app/invite/[token]/page.tsx`: 카카오로 시작 버튼 + 일반 가입 폼.

**Files**: `prisma/schema.prisma`, `app/api/admin/invitations/route.ts` (신규), `app/api/auth/accept-invitation/route.ts` (신규), `app/invite/[token]/page.tsx` (신규) + 테스트

**Acceptance**:
- 만료/기수락 토큰 재사용 불가 (테스트)
- 수락 시 Membership·AuthAccount가 트랜잭션으로 생성 (부분 생성 없음)

**Verify**:
```bash
pnpm exec prisma validate && pnpm exec prisma generate
pnpm exec vitest run
pnpm run lint
```

### C4. 계정 연결 메뉴 + 미소속 안내

**Description**: ARC-003 §4.2 나머지 두 시나리오.

- **기존 가입자의 카카오 연결**: 로그인 상태의 설정/프로필 화면에 "카카오 계정 연결" — 카카오 인가 → `POST /api/auth/link-kakao` (세션이 본인 증명, `linkAuthAccount` 사용). 연결 해제도 함께 (마지막 로그인 수단이면 해제 거부).
- **초대 없는 카카오 신규 진입**: C2에서 `linked: false`면 "초대를 받아야 사용할 수 있습니다" 안내 화면(`app/login/no-invitation` 또는 로그인 페이지 내 상태)으로 안내.
- 로그인 페이지에 카카오 로그인 버튼 (카카오 디자인 가이드 색상 `#FEE500`, 웹 리다이렉트 방식).

**Files**: `app/api/auth/link-kakao/route.ts` (신규), 설정/프로필 페이지(grep으로 특정), `app/login/**` + 테스트

**Acceptance**:
- 연결 API는 인증 세션 필수 (미인증 401 테스트)
- 마지막 인증 수단 해제 시도 거부 (테스트)

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
```

### C5. 보안 점검 — 자동 병합 부재 확인

**Description**: ARC-003 §7 마지막 항목. 코드 전수 확인:

```bash
grep -rn "email" app/api/auth lib/services/kakao.ts lib/services/auth-account.ts | grep -iE "find|where|match"
```

카카오 프로필의 email로 기존 User를 조회·연결하는 경로가 **없음**을 확인하고, 계정 매칭 정책(초대 기반 3-시나리오 표, §4.2)을 `docs/AUTH_ACCOUNT_MATCHING_POLICY.md`로 문서화. 회귀 방지 테스트 추가: 카카오 email이 기존 유저 email과 같아도 `linked: false`가 반환되는 테스트.

**Files**: `docs/AUTH_ACCOUNT_MATCHING_POLICY.md` (신규), 회귀 테스트

**Acceptance**:
- 자동 병합 부재 회귀 테스트 통과
- 문서에 3-시나리오 표 + 예외 없음 명시

**Verify**:
```bash
pnpm exec vitest run
pnpm run lint
```

---

## 최종 검증

### F1. 린트 전체 그린
```bash
pnpm run lint
```

### F2. 단위 테스트 전체 그린
```bash
pnpm exec vitest run
```

### F3. 프로덕션 빌드
```bash
pnpm run build
```
실패 시 원인을 고치고 재실행. 셋 다 통과해야 완료.
