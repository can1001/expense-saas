# 멀티테넌시 SaaS 전환 - TODO 리스트

## 현재 상태: 구현 100% 완료, 테스트 0%

---

## Phase 1: 테넌트 격리 테스트 (P1)

- [ ] **1.1** Prisma Extension 유닛 테스트 작성
  - 파일: `lib/__tests__/prisma-tenant-extension.test.ts`
  - 검증: `npm test -- prisma-tenant-extension`

- [ ] **1.2** 테넌트 컨텍스트 유닛 테스트 작성
  - 파일: `lib/__tests__/tenant-context.test.ts`
  - 검증: `npm test -- tenant-context`

- [ ] **1.3** 테넌트 조회/캐싱 테스트 작성
  - 파일: `lib/__tests__/tenant.test.ts`
  - 검증: `npm test -- tenant.test`

### ⏸️ Checkpoint 1: 유닛 테스트 통과

---

## Phase 2: 인증 래퍼 테스트 (P1)

- [ ] **2.1** withAuth 테넌트 검증 테스트 작성
  - 파일: `lib/__tests__/auth-user.test.ts`
  - 검증: `npm test -- auth`

- [ ] **2.2** withSuperAdmin 테스트 작성
  - 파일: `lib/__tests__/super-admin.test.ts`
  - 검증: `npm test -- super-admin`

### ⏸️ Checkpoint 2: 인증 테스트 통과

---

## Phase 3: 통합 테스트 (P2)

- [ ] **3.1** 테넌트 격리 통합 테스트 작성
  - 파일: `lib/__tests__/tenant-isolation.integration.test.ts`
  - 검증: `npm test -- tenant-isolation`

- [ ] **3.2** 플랫폼 API 테스트 작성
  - 파일: `app/api/platform/__tests__/tenants.test.ts`
  - 검증: `npm test -- platform`

### ⏸️ Checkpoint 3: 통합 테스트 통과

---

## Phase 4: 수동 검증 (P1)

- [ ] **4.1** 로컬 환경 수동 테스트
  - SuperAdmin 로그인/로그아웃
  - 테넌트 CRUD
  - 테넌트 사용자 로그인
  - UI 테넌트 정보 표시

- [ ] **4.2** 데이터 격리 수동 검증
  - Cross-tenant 접근 불가 확인
  - Prisma Studio tenantId 확인

---

## 완료 기준

- [ ] 모든 유닛 테스트 통과 (`npm test`)
- [ ] 모든 수동 테스트 체크리스트 완료
- [ ] 빌드 성공 (`npm run build`)
