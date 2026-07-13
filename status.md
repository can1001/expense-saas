# RBAC 리팩터링 — 진행 상황 (status.md)

목표: `spec_rbac_refactoring.md`의 수용 기준 AC1~AC7 전부 구현 + 각 AC 대응 테스트 통과.
제약: `spec_rbac_refactoring.md` 수정 금지. 매 턴 이 파일에 진행 기록.

## 수용 기준 체크리스트 (전부 완료 — 전체 스위트 2047 통과 / 86 파일)
- [x] **AC1** 노출된 메뉴/버튼 = 대응 API 200, 숨김 메뉴 = 403 (메뉴-가드 parity)
      → `lib/auth/__tests__/menu-guard-parity.test.ts` (25). 클라 필터·서버 가드가 동일 permission 사용, 전 역할×전 경로 일치.
- [x] **AC2** 인가는 `hasPermission` 단일 경로로만
      → `lib/auth/__tests__/authz-single-source.test.ts` 스캐너(app/·components/ 역할배열 리터럴 0). menu-permissions 전량 파생, 라우트/컴포넌트 인가배열 → `roleHasPermission`.
- [x] **AC3** `Role.permissions` 변경이 재로그인 없이 반영
      → `lib/auth/__tests__/role-permission-cache.test.ts` (8). `getTenantRoleResolver`(TTL 캐시)+`invalidateRolePermissionCache`(역할 CRUD에 배선)+`withPermissions` 가드. schema에 `Role.permissions String[]` 추가.
- [x] **AC4** finance_member 포함 7개 역할 일관 (누락 0)
      → `permissions.test.ts` (프리셋/한글명/골든 전 역할). P11: users validation → `ROLE_CODES`, year-roles → `YEAR_ROLE_CODES`, upload 한글맵 + finance_member.
- [x] **AC5** 가드 없는 API 라우트 0
      → `lib/auth/__tests__/route-guard-coverage.test.ts` (3) + 공개 허용목록. 7개 미가드 라우트 `withAuth` 래핑(크로스테넌트 누출 수정 겸함).
- [x] **AC6** 골든 매트릭스 안정 (의도된 변경만)
      → `permissions.test.ts` GOLDEN(31 permission×7 역할) + 기존 `menu-permissions.test.ts` 105 무변경 통과가 동작 보존 증명.
- [x] **AC7** `USER_JWT_SECRET` 미설정 시 프로덕션 부팅 실패
      → `lib/auth/__tests__/jwt-secret.test.ts` (7). `lib/auth/jwt-secret.ts` + user.ts/proxy.ts 배선 + `.env.example`.

## 검증 요약
- 전체 스위트: **2047 passed / 86 files** (`npx vitest run`).
- 소스(비테스트) 타입에러 0. tsc 전체 에러 176 = 리팩터링 전 baseline과 동일(전부 기존 테스트 파일의 기존 에러).
- 신규 AC 테스트: permissions(60) + jwt-secret(7) + role-permission-cache(8) + route-guard-coverage(3) + menu-guard-parity(25) + authz-single-source(3).

## 설계 결정 로그
- 골든 테스트는 **현행의 불일치(P1/P4/P10)를 버그로 간주**하고 스펙 §4.4 매트릭스를 정본 정책으로 인코딩한다(AC6의 "의도된 diff" 조항 적용). 즉 매트릭스 테스트가 정책의 단일 출처가 되어, 이후 프리셋 변경이 매트릭스를 바꾸면 테스트가 깨지므로 의도적 변경만 통과.
- `Role.permissions String[]` 채택(조인 테이블 대신). permission 카탈로그는 코드 레지스트리에서 타입 안전 관리.
- `report:export`는 현행 quarterly-export 순효과(admin/finance_head/accountant/finance_member)에 맞춤. `expense:export`(canExportData)는 admin/finance_head.

## 턴별 로그
### Turn 1 (2026-07-13)
- 스펙 작성 완료(이전 세션). 테스트 인프라 파악: Vitest+jsdom, 커버리지 90/90/84/90, 전역 mock `test/setup.ts`.
- 착수: `lib/auth/permissions.ts`(레지스트리·프리셋·resolver·hasPermission) 작성 예정, 골든 매트릭스 테스트로 AC4/AC6 착수.

### Turn 2 (2026-07-13)
구현 완료 + 테스트 통과:
- **AC4/AC6** `lib/auth/permissions.ts` — ROLE_CODES(7종), PERMISSIONS 카탈로그(31종), ROLE_PERMISSION_PRESETS(스펙 §4.4 매트릭스), resolvePermissions/hasPermission/hasAny/hasAll. 골든 매트릭스 테스트 `__tests__/permissions.test.ts` **52 통과**. 7개 역할 전부 프리셋/한글명 보유(finance_member 누락 0).
- **AC7** `lib/auth/jwt-secret.ts` — 프로덕션 미설정 시 throw. `user.ts`/`proxy.ts` 배선, `.env.example` 문서화. 테스트 `__tests__/jwt-secret.test.ts` **7 통과**. 기존 `auth-user.test.ts` 여전히 통과.
- **AC3** `lib/auth/role-permission-cache.ts` — 테넌트별 역할→권한 TTL 캐시 + 무효화, DB 빈값은 프리셋 폴백. 테스트 `__tests__/role-permission-cache.test.ts` **8 통과** (무효화 즉시 반영/TTL 만료 재적재/테넌트 분리 검증).
- **AC5(진행)** 미가드 라우트 전수 조사 완료. 공개 허용목록: login/logout/signup/platform-auth/vapid-public-key/tenant-info. 가드 필요 7개: budget/search(직접 완료), budget/{hierarchy/export, simple, simple/all-details, usage-details, upload}, upload/delete → 서브에이전트가 withAuth 래핑 중. (미가드 = 테넌트 격리 미적용 크로스테넌트 누출이므로 보안 수정 겸함)

다음: AC5 래핑 검증 + 스캐너 테스트, AC1/AC2(가드·메뉴를 permission 기반 단일화).

### Turn 3 (2026-07-13) — 완료
- **AC5**: 미가드 6개 라우트 서브에이전트로 withAuth 래핑 + `route-guard-coverage.test.ts` 스캐너(공개 허용목록). budget/upload GET 시그니처 변경으로 usage-details.test 16건 시그니처 보정.
- **AC1/AC2**: `menu-permissions.ts` 전량을 permission 프리셋에서 파생하도록 재작성(기존 105 특성화 테스트 무변경 통과 = 동작 보존). `withPermissions` permission-코드 가드 추가(user.ts). `menu-guard-parity.test.ts`(25)로 메뉴=가드 parity, `authz-single-source.test.ts`로 역할배열 리터럴 0 검증.
- **인가배열 마이그레이션**: 서브에이전트로 17개 파일(expenses 데이터스코프·offerings·youth·notification 등) `roleHasPermission(role, PERMISSIONS.X)` 로 교체. offerings 4개는 프리셋(5역할)≠기존(4역할)이라 서브가 SKIP → 직접 OFFERING_MANAGE 정렬(AC1 P1 수정: finance_member 헌금메뉴=API 일치). 매핑 검증: FULL_ACCESS≡READ_ALL, ACCOUNT_VIEW≡PAYMENT_MANAGE, NOTIFICATION≡NOTIFICATION_SEND, QUARTERLY_EXPORT≡REPORT_EXPORT, youth≡YOUTH_MANAGE(프리셋 4역할로 보정).
- **P11**: users 검증배열 → ROLE_CODES/YEAR_ROLE_CODES, upload 한글맵/타입에 finance_member, `PROTECTED_SYSTEM_ROLE_CODES`/`isProtectedSystemRole` 로 roles 편집 보호 상수화.
- **AC3 배선**: schema `Role.permissions String[]` 추가 + prisma generate. roles POST/PUT/DELETE 에 `invalidateRolePermissionCache(tenantId)` + `permissions` 필드(sanitizePermissions) 수용.
- 최종: 전체 2047 통과, 소스 타입에러 0, tsc baseline(176) 유지.

## 후속(스펙 Phase 4/5) 진행 중
### Turn 4 (2026-07-13) — Phase 4a 완료
- **withAdmin(38) + withPermission(flag)(4) → withPermissions(permission) 전면 이관 완료.** 스크립트로 31개 파일 결정적 치환 + import 정리. 매핑: 조직관리(committees/departments)=메뉴 permission 정렬, 예산마스터=신규 `BUDGET_MASTER_MANAGE`({admin,finance_head} 현행 보존), users/roles/settings=admin 전용, approve/reject=EXPENSE_APPROVE, export=EXPENSE_EXPORT.
- `BUDGET_MASTER_MANAGE` permission 신규 + 골든 매트릭스 갱신.
- 결과: 소스 타입에러 0, 전체 **2048 통과**. 이제 모든 API 가드가 hasPermission 단일 경로(withPermissions/withAdminMenu).
- 남음: (B) JWT roles-only 전환, (C) Role 불리언 컬럼 제거+getRolePermissions 삭제.

### Turn 5 (2026-07-13) — Phase 4b + Step C(코드) 완료
- **(B) JWT roles-only 전환 완료.** JWT payload = {신원, role, roles, granted} — 권한 객체를 굽지 않음. verifyUserToken이 roles(+granted)에서 레거시 플래그를 deriveLegacyFlags로 파생(하위호환). 구 토큰(permissions 객체)도 호환. login은 getRolePermissions 대신 roles+deriveLegacyFlags 사용. UserSession에 roles/granted 추가. 검증: token-roles-only.test.ts(8) — payload에 roles 有/permissions 無.
- **(C) 불리언 플래그 인가 코드 제거 완료.** getRolePermissions·레거시 withPermission(flag)·withAdmin 삭제(전 라우트 미사용). Permission(불리언) 타입 삭제. test/setup.ts mock + auth-user.test.ts 갱신(withPermissions 기반).
- 결과: 소스 타입에러 0, 전체 **2056 통과 / 87 파일**. 인가 경로에서 불리언 플래그 완전 제거.

## 남은 작업 — Role 불리언 컬럼 물리 제거 (Phase 5 최종, DB·UI 조율 필요)
5개 컬럼은 인가와 완전 분리됨(가드·JWT·세션 모두 permission 기반). 레거시 표시/편집 용도로만 잔존.
물리 제거는 이번 세션(무DB·무시각검증) 보류. 필요 작업:
1. app/admin/roles/page.tsx 역할 편집 UI를 permissions[] 편집으로 재작업(현재 5개 토글에 결합).
2. approval-rules(표시)/platform/tenants(역할 시드)/prisma seeds 를 permissions[] 기준 전환.
3. roles CRUD flag 필드 제거.
4. schema Role 5개 컬럼 삭제 + 파괴적 db:push(운영 DB 조율, 비가역).
→ roles CRUD는 이미 permissions[] 수용 + 캐시 무효화 완료. resolver는 DB permissions[] 우선, 없으면 프리셋 폴백.

### Turn 6 (2026-07-13) — Phase 5 컬럼 제거 진행 중
- **역할 편집 UI 재작업 완료**: `app/admin/roles/page.tsx` — 5개 토글 → `permissions[]` 그룹 체크박스(PERMISSION_GROUPS/PERMISSION_LABELS). 목록은 permission 칩 표시. `permissions.ts`에 라벨/그룹 + 완성도 테스트 추가.
- **CRUD**: roles POST/PUT 에서 flag 필드 제거(permissions[]만).
- **/me**: roleRef flag select 제거, effective 역할에서 `deriveLegacyFlags`+`subjectPermissions`로 파생(+`permissionCodes` 추가).
- **useRoles.ts**: Role 타입 flag→permissions[], 접근 함수는 `roleGrants`(DB permissions[] 우선/프리셋 폴백).
- **approval-rules**: `role.canApprove` → `roleCanApprove`(permission 기반).
- **platform/tenants provisioning**: 역할 시드를 프리셋 permissions[]로.
- **prisma seeds 4개**: 서브에이전트가 flag→permissions[] 변환 중.
- 백필 스크립트 `prisma/scripts/backfill-role-permissions.ts` 작성(컬럼 DROP 전 실행용).
- 남음: 시드 완료 확인 → schema Role 5개 컬럼 삭제 + generate → 테스트 수정 → 전체 그린 → (운영 DB) 백필 후 db:push.

### Turn 6 완료 상태
- 시드 4개 flag→permissions[] 변환 완료(서브에이전트). platform/tenants provisioning도 프리셋 permissions[].
- **schema Role 5개 불리언 컬럼 삭제 + `prisma generate` 완료.** 나머지 참조 정리: user-service `checkCanRegisterUsers`(permission 기반), scripts/export-users-to-seed(permissions 출력).
- 테스트 수정: user-service.test 의 roleRef flag mock → `permissions: ['user:register']`.
- 결과: **전체 2058 통과 / 87 파일, 소스 타입에러 0.** 코드/스키마 레벨에서 불리언 플래그 완전 제거.

## ⚠️ 운영 DB 마이그레이션은 미실행 (의도적) — `docs/RBAC_PHASE5_MIGRATION.md` 참조
- 대상 DB는 **운영 Neon(`neondb`)**, Role 23건에 flag 데이터 존재.
- `prisma db push`(no-flag) 안전 프리뷰 결과: 5개 컬럼 DROP 예정(데이터 손실 경고) → **적용 안 함**.
- **개발 세션에서 운영 DB에 push 하면 현재 배포된 구 코드가 깨진다**(구 코드가 삭제된 컬럼 SELECT). 
  → db:push(`--accept-data-loss`)는 **신 코드 배포와 같은 릴리스**에서 수행해야 함. 런북 문서화 완료.
- 백필 스크립트 준비됨(permissions[] 미설정 시 런타임은 프리셋 폴백이라 무중단).

### Turn 7 (2026-07-13) — 배포 PR + 파이프라인
- 브랜치 `20260713-rbac-refactoring` 생성, 101개 파일 커밋(`.claude/settings.local.json` 제외), push.
- **PR #4 생성**: https://github.com/can1001/expense-saas/pull/4
- 마이그레이션 파이프라인: `package.json`에 `db:backfill:roles` + `deploy:migrate`(= `prisma db push --accept-data-loss` + 백필) 스크립트 추가. 웹 서비스 build는 대시보드 설정이라 `render.yaml`에 이 릴리스용 Build Command 안내 주석 추가. `docs/RBAC_PHASE5_MIGRATION.md` 런북.
- 최종: 전체 2058 통과, 소스 타입에러 0. 배포 시 build에 `&& npm run deploy:migrate` 1회 포함하면 컬럼 드롭+백필 완료.
