# PRD — SaaS 멀티테넌트 고도화 (템플릿 프로비저닝 · Membership · 카카오 로그인)

> **작성일**: 2026-07-18
> **목표**: 설계서 EXP-2026-ARC-001/002/003을 구현한다.
> ① orgType 템플릿("복제 후 독립") 기반 테넌트 프로비저닝,
> ② User↔Membership↔Tenant 구조와 조직 전환·서버 주도 설정(`/me/config`),
> ③ AuthAccount 기반 카카오 로그인(초대 기반 계정 매칭).
> **태스크 상세**: `docs/TASKS_SAAS_MULTITENANT.md` (단일 truth)
> **배경 설계서**: `docs/EXP-2026-ARC-001-multitenant-architecture.md`,
> `docs/EXP-2026-ARC-002-mobile-multitenancy.md`, `docs/EXP-2026-ARC-003-kakao-login.md`

## 실행 방법 (Ralph Loop)

```bash
RALPH_PRD=PRD_SAAS_MULTITENANT.md \
RALPH_PROMPT=scripts/ralph/CLAUDE_SAAS_MULTITENANT.md \
RALPH_TAG=saas \
RALPH_BRANCH=20260718-saas-multitenant \
./ralph.sh 30
```

## 범위 제외 (이번 루프에서 건드리지 않음)

- **FastAPI 백엔드 패리티** — 신규 API는 Next.js API 라우트에만 구현. `backend/` 반영은 별도 루프.
- **네이티브 Kakao Android SDK** — 웹(REST/OIDC) 방식 우선. Capacitor 네이티브 연동은 후속.
- **DB 실행 작업** — `prisma db push`·시드 실제 실행·데이터 백필 실행은 사용자 수동 게이트(아래 M 항목). 루프는 코드/스크립트/테스트까지만.
- **네이버·구글 로그인** — AuthAccount 구조만 확장 가능하게 설계, 구현은 카카오만.
- **기존 Budget 5단계(Committee/Department/BudgetCategory/Subcategory/Detail) 모델·화면** — 무변경. AccountCategory는 병행 신규 모델.
- White-label 별도 앱, FCM 외 푸시 채널, 과금/요금제 로직.

## Phase A — 템플릿 · 프로비저닝 (ARC-001)

- [x] A1. 스키마 추가 — `CategoryKind`, `AccountCategoryTemplate`, `AccountCategory`, `ApprovalLineTemplate`/`ApprovalStepTemplate` (기존 모델 무변경)
- [x] A2. COMPANY 템플릿 시드 스크립트 — 기존 청연컨설팅 계정과목 승격 (upsert, 실행은 M1)
- [x] A3. CHURCH 템플릿 시드 스크립트 — 계정과목 46건 + 결재선 템플릿 2종 (upsert, 실행은 M1)
- [x] A4. `provisionTenant()` 트랜잭션 서비스 + 단위 테스트
- [x] A5. 플랫폼 어드민 테넌트 생성 API를 `provisionTenant()` 경유로 전환
- [x] A6. `Tenant.settings` labels/features 표준화 — 타입·기본값·조회 헬퍼 (`lib/org-terms.ts` 통합)

## Phase B — Membership · 서버 주도 설정 (ARC-002)

- [x] B1. `Membership` 모델 추가 + 백필 스크립트 (`User.tenantId` 유지, 이중 기록)
- [x] B2. 로그인 확장 — Membership 조회, 복수 소속 시 조직 선택 응답
- [x] B3. `POST /api/auth/switch-tenant` — Membership 검증 + 새 tenantId 클레임 토큰 재발급
- [x] B4. `GET /api/me/config` — tenant + labels + features + branding
- [x] B5. 조직 선택/전환 UI + 서버 설정 기반 렌더링 (레이블 맵, `incomeModule` 노출 제어)
- [x] B6. FCM 토픽 테넌트 스코프 + 조직 전환 시 재구독
- [ ] B7. 보안 점검 — 요청 바디/쿼리의 tenantId 수신 경로 전수 제거

## Phase C — 카카오 로그인 (ARC-003)

- [ ] C1. `AuthAccount` 모델 + 기존 이메일 로그인 `provider: "email"` 통합
- [ ] C2. `POST /api/auth/kakao` — 서버측 카카오 토큰 검증 + 자체 JWT 발급 (kapi 모킹 테스트)
- [ ] C3. 초대 플로우 — `Invitation` 모델/API + 초대 토큰·카카오 로그인 결합
- [ ] C4. "카카오 계정 연결" 메뉴 + 테넌트 미소속 안내 화면
- [ ] C5. 보안 점검 — 이메일 자동 병합 경로 부재 확인 + 매칭 정책 문서화

## 최종 검증 (A~C 전부 [x] 이후에만)

- [ ] F1. `pnpm run lint` 통과
- [ ] F2. `pnpm exec vitest run` 통과
- [ ] F3. `pnpm run build` 통과

## 수동 게이트 (사용자 실행 — 루프 대상 아님)

- [ ] M1. dev DB에 `pnpm exec prisma db push` + 템플릿 시드 실행 (A1~A3 이후)
- [ ] M2. Membership 백필 실행 + 검증 (B1 이후)
- [ ] M3. 카카오 개발자 콘솔 — 앱 등록, 리다이렉트 URI/키 해시, (권장) OIDC 활성화, `.env`에 키 설정 (C2 이전이면 좋음)
- [ ] M4. 청연컨설팅(COMPANY) 재프로비저닝 + 청연교회(CHURCH) 파일럿 프로비저닝 (전체 완료 후)
