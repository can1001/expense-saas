# RBAC Phase 5 — Role 불리언 컬럼 제거 배포 런북

`spec_rbac_refactoring.md` Phase 5의 마지막 단계인 **Role 불리언 컬럼 물리 제거**를 위한 배포 절차.

## 배경
- 코드/스키마는 이미 `Role.permissions String[]` 기반으로 완전 전환됨. 5개 불리언 컬럼
  (`canApprove`, `canManageExpense`, `canAccessAdmin`, `canExportData`, `canRegisterUsers`)은
  **인가와 완전 분리**되어 어떤 코드도 참조하지 않는다.
- 그러나 **운영 DB(Neon `neondb`)에는 아직 컬럼이 존재**하고 `permissions` 컬럼은 없다.
  (Role 23건에 flag 데이터 존재)

## ⚠️ 중요: 코드 배포와 DB 마이그레이션은 반드시 함께
- **구 코드 + 신 DB** = 깨짐 (구 코드가 삭제된 flag 컬럼을 SELECT)
- **신 코드 + 구 DB** = 깨짐 (신 코드/Prisma 클라이언트가 없는 `permissions` 컬럼을 SELECT)
- 따라서 `prisma db push`(컬럼 교체)와 신 코드 배포를 **같은 릴리스에서** 수행한다.
  개발 세션에서 운영 DB에 미리 push 하면 현재 라이브 앱이 깨진다 → 실행하지 않았음.

## 배포 절차 (Render 등)
1. 신 코드 배포 파이프라인에 다음을 포함:
   ```
   npm install && npx prisma generate && npm run build
   # 릴리스(release) 단계에서:
   npx prisma db push --accept-data-loss   # permissions 컬럼 추가 + 5개 flag 컬럼 DROP
   npm start
   ```
   - `--accept-data-loss`는 flag 컬럼 DROP 때문에 필요. flag 데이터는 인가에서 미사용이므로 손실 무해.

2. (권장) 배포 직후 역할 permissions 백필 — DB에 명시적으로 채워 조회/커스터마이즈 명확화:
   ```
   npx ts-node --project tsconfig.scripts.json prisma/scripts/backfill-role-permissions.ts
   ```
   - `permissions[]`가 비어 있어도 런타임 resolver가 **역할 코드 프리셋으로 폴백**하므로,
     백필 전에도 인가는 정상 동작한다(무중단). 백필은 DB 값을 명시화하는 목적.

## 롤백
- flag 컬럼 DROP은 비가역. 롤백이 필요하면 신 코드도 함께 이전 릴리스로 되돌리고,
  스키마에 flag 컬럼을 재추가한 뒤 `db push`로 복구(단, DROP된 값은 프리셋 기준 재생성 필요).
- 컬럼은 인가와 분리되어 있으므로 실질 롤백 사유는 거의 없음.

## 검증 (배포 후)
- 로그인 → 역할별 메뉴 노출/역할 관리 페이지(permission 체크박스) 정상.
- `/admin/roles`에서 역할별 permission 편집 → 재로그인 없이 반영(캐시 무효화).
- 전체 테스트: `npx vitest run` (현재 2058 통과, 소스 타입에러 0).
