# 보안 점검 — tenantId 클라이언트 수신 경로 전수 감사

> **작성일**: 2026-07-18 (B7)
> **근거**: `docs/EXP-2026-ARC-002-mobile-multitenancy.md` §3.1 — "tenantId는 토큰 안에만"
> **범위**: `app/api/**/route.ts` 전체. 클라이언트가 요청 바디·쿼리·경로로 tenantId(또는
> 테넌트 식별자)를 보내 서버의 데이터 스코프를 결정할 수 있는 경로를 전수 조사한다.

## 감사 방법

```bash
grep -rn "tenantId" app/api --include=route.ts | grep -viE "getTenant|session|context|token|claim" | sort
```

추가로 아래 패턴도 별도 grep으로 교차 확인했다 (잔여 0건):

- `searchParams.get('tenant...')` / `body.tenantId` / zod 스키마의 `tenantId` 필드 — 비플랫폼 라우트에서 switch-tenant 외 0건
- `x-tenant-subdomain` / `x-tenant-param` 헤더 소비처 — 아래 "테넌트 식별자(서브도메인)" 절 참조

## 결론

**예외 목록(아래 2개 그룹) 외 클라이언트 수신 경로 잔여 0건.** 모든 테넌트 데이터 라우트는
JWT `user_token` 클레임(`lib/auth/user.ts`의 `withAuth` → `context.user.tenantId`)과
`lib/tenant-context.ts`의 AsyncLocalStorage 컨텍스트로만 스코프된다. 코드 수정 불필요.

## 결과 표

### 1. 허용 예외 (설계상 클라이언트 수신)

| 경로 | 수신 위치 | 처리 | 사유 |
|---|---|---|---|
| `POST /api/auth/switch-tenant` | 바디 `tenantId` | 유지 (B3) | 전환 "대상" 지정이 목적. `assertMembership(userId, tenantId)`로 소속 검증 후에만 새 클레임 토큰 재발급 — 스코프는 여전히 재발급된 토큰이 결정 (공통 원칙 2의 명시적 예외) |
| `GET /api/platform/activity-logs` | 쿼리 `tenantId` | 유지 | 슈퍼 어드민 전용 필터. `withSuperAdmin` 별도 인증 경계 |
| `GET /api/platform/export` | 쿼리 `tenantId` | 유지 | 슈퍼 어드민 전용 내보내기 필터. `withSuperAdmin` |
| `/api/platform/tenants/[id]/**` (route, users, settings, stats) | 경로 파라미터 `[id]` | 유지 | 슈퍼 어드민이 관리 대상 테넌트를 지정하는 리소스 경로. 전 핸들러 `withSuperAdmin` 래핑 확인 완료 |

### 2. 테넌트 식별자(서브도메인) 수신 — tenantId 아님, 스코프 미결정

| 경로 | 수신 위치 | 처리 | 사유 |
|---|---|---|---|
| `POST /api/auth/login` | `x-tenant-subdomain`/`x-tenant-param` 헤더 (proxy.ts가 호스트/`?tenant=`에서 주입) | 유지 | 프리인증 단계라 토큰이 존재하지 않음. 서브도메인은 사용자 조회 필터일 뿐이며, 비밀번호 검증을 통과해야 하고 발급 토큰의 tenantId는 서버가 User/Membership에서 결정 |
| `GET /api/tenant/info` | 동일 헤더 | 유지 | 공개 API — 로그인 화면 조직명 표시용. 공개 필드(name, subdomain, orgType, logoUrl)만 반환 |
| `withAuth` (lib/auth/user.ts) | 동일 헤더 | 유지 | 헤더는 **불일치 검증에만** 사용 (토큰 테넌트와 다르면 403). 스코프는 항상 `user.tenantId` 클레임 |

### 3. 토큰/컨텍스트 기반 확인 완료 (정상)

| 경로 | 스코프 출처 |
|---|---|
| `GET /api/admin/offerings` | `user.tenantId` (raw SQL 파라미터 포함) |
| `/api/admin/roles`, `/api/admin/roles/[id]` | `user.tenantId` (권한 캐시 무효화 키) |
| `GET /api/me/config`, `GET /api/me/memberships` | `user.tenantId` |
| `POST /api/push/fcm-subscribe` | `currentUser.tenantId` (B6에서 클레임 강제) |
| `GET /api/youth-night/stats` | `context.user.tenantId` (raw SQL 파라미터 포함) |

## 잠재 리스크 (현재 미사용 — 권고사항)

1. **`lib/api-utils.ts`의 `withTenant`/`withRequiredTenant`**: 쿼리 `?tenant=` 또는
   `x-tenant-param` 헤더만으로 **인증 없이** 테넌트 컨텍스트를 결정한다. 현재 import하는
   라우트가 0건이라 실위험은 없으나, 신규 라우트에서 사용하면 클라이언트가 스코프를
   지정하는 경로가 된다. **권고**: 신규 라우트는 반드시 `withAuth`를 사용할 것.
   해당 헬퍼의 제거/개편은 별도 태스크로 처리 (B7 범위 밖 — 라우트 아님).
2. **`proxy.ts`가 인바운드 `x-tenant-*` 헤더를 제거하지 않음**: 클라이언트가 헤더를
   직접 위조해 보낼 수 있다. 다만 위 표와 같이 모든 소비처가 이 헤더를 스코프 결정에
   쓰지 않으므로(검증·프리인증 필터·공개 정보 용도) 현재 구조에서 테넌트 격리 우회는
   불가능하다. **권고**: 심층 방어 차원에서 proxy에서 인바운드 `x-tenant-subdomain`/
   `x-tenant-param` 삭제 후 재주입하는 하드닝을 후속 태스크로 검토.

## 재검증 방법

위 "감사 방법"의 grep을 재실행해 예외 표(1·2절) 외 신규 발견이 없는지 확인한다.
신규 API 라우트 추가 시 이 문서의 예외 표를 갱신한다.
