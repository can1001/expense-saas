# PRD — 백엔드 이관 잔여분 (FastAPI 컷오버 완결)

> 목표: Next.js `app/api/**` 에 남은 전 라우트를 FastAPI 로 이관하고
> `next.config.ts` beforeFiles rewrite 로 컷오버한다.
> 완료 후 Next 는 순수 프론트엔드(+Excel 임시 잔류 없음)가 된다.
>
> 선행 완료(main 머지됨, `ed04941`): auth login/logout/me, expenses CRUD·결재
> 워크플로우, budget 루트+조회 5종, 예산 마스터 5종, approvals, tenant/info.
>
> 태스크 상세: `docs/TASKS_BACKEND_REMAINDER.md`
> 루프 프롬프트: `scripts/ralph/CLAUDE_BACKEND_REMAINDER.md`
> 작업 브랜치: `20260720-backend-remainder`

## Phase A — 계정 (users · me · auth 잔여)

- [x] A1. users 목록·생성·상세 (`users/`, `users/[id]`)
- [x] A2. users 보조 (`users/by-role/[role]`, `users/quick-register`, `users/year-roles`)
- [x] A3. 서명 관리 (`users/me/signatures` 3종)
- [x] A4. 내 설정 (`me/config`, `me/memberships`)
- [x] A5. auth 잔여 — 로컬 (`auth/signup`, `auth/change-password`, `auth/switch-tenant`, `auth/accept-invitation`)
- [x] A6. auth 카카오 (`auth/kakao`, `auth/link-kakao`) — 외부 호출 전부 모킹

## Phase B — expenses 잔여 + 주변 도메인

- [x] B1. 조회·상태 (`expenses/filter-options`, `expenses/[id]/fix-status`, `expenses/[id]/payment-status`)
- [x] B2. 복제·첨부 (`expenses/[id]/duplicate`, `expenses/[id]/attachments` 2종, `upload/`, `upload/delete`) — Cloudinary 모킹
- [x] B3. 벌크 (`expenses/bulk`, `expenses/bulk-expense-date`, `expenses/bulk-payment-status`)
- [x] B4. 간편 지출 (`simple-expenses` 2종)
- [x] B5. 템플릿·계좌 (`expense-templates` 2종, `bank-accounts` 2종)
- [x] B6. 반복 지출·설정 (`recurring-expenses` 4종, `settings`)

## Phase C — Excel 계열 (openpyxl 도입)

- [x] C1. openpyxl 도입 + 공용 Excel 유틸 + `budget/hierarchy/export`
- [x] C2. `budget/upload` (lib/budget-upload.ts 712L 포팅 — 정규화 테이블 대상)
- [x] C3. `expenses/export/excel`, `expenses/bulk-upload`, `expenses/bulk-upload-template`
- [x] C4. `users/upload`, `departments/leaders-upload`, `budget-details/year` 2종 + `budget-details/[id]/description`

## Phase D — admin

- [x] D1. 대시보드 (`admin/dashboard`, `admin/year-setup-status`)
- [x] D2. 보고서 (`admin/budget-execution`, `admin/cumulative-report`, `admin/quarterly-report` + `export`)
- [x] D3. 실행·이력 (`admin/hr-admin-execution`, `admin/manager-exceptions`, `admin/change-history`)
- [x] D4. 역할·초대 (`admin/roles` 2종, `admin/invitations`)
- [x] D5. 헌금 (`admin/offerings` 4종 — template 은 C1 의존)
- [x] D6. 알림 관리 (`admin/notifications`)
- [x] D7. 연도 설정 초기화 (`admin/year-config/[year]`) — F2 감사에서 발견된 누락 라우트, `admin/year-setup-status` 페이지의 초기화 버튼이 실사용 중

## Phase P — platform (플랫폼 관리자)

- [x] P1. 인증 (`platform/auth` 3종 — 별도 세션 체계, lib 원본 확인 필수)
- [x] P2. 테넌트 (`platform/tenants`, `platform/tenants/[id]`, `[id]/settings`)
- [x] P3. 테넌트 사용자·통계 (`[id]/users` 2종, `[id]/stats`)
- [x] P4. 운영 (`platform/admins` 2종, `platform/activity-logs`, `platform/settings`, `platform/stats`)
- [x] P5. 내보내기 (`platform/export` — C1 의존)

## Phase N — push

- [x] N1. WebPush (`push/vapid-public-key`, `push/subscribe`, `push/unsubscribe`, `push/history`) — pywebpush, 발송 모킹
- [x] N2. FCM·테스트 (`push/fcm-subscribe`, `push/fcm-test`, `push/test`) — 외부 발송 전부 모킹

## Phase Y — youth-night

- [x] Y1. 출석·포인트 (`youth-night/attendance` 2종, `youth-night/points`)
- [x] Y2. 퀴즈·랭킹 (`youth-night/quiz` 2종, `youth-night/ranking`, `youth-night/stats`)
- [x] Y3. 암송 (`youth-night/recitation` 2종)
- [x] Y4. 관리 (`youth-night/admin` 4종)

## 최종 검증

- [x] F1. 백엔드 전체 `RUNNING_ZONE=local uv run pytest` + `uv run ruff check` 통과
- [x] F2. rewrite 전수 대조 — `app/api/**` 라우트별 메서드 목록 vs FastAPI 라우트 vs beforeFiles 항목표를 만들어 docs/ 에 기록, 누락·메서드 갭 0 확인
- [ ] F3. `pnpm run build` 통과 + `BACKEND_SEPARATION_STATUS.md` 갱신

## 수동 게이트 (사용자 전용 — 루프는 건드리지 않음)

- [ ] M1. Render Next 서비스에 `API_ORIGIN` 설정 → 컷오버 활성화
- [ ] M2. 프로덕션 스모크 (로그인·지출 작성·결재·업로드)
- [ ] M3. 베이크 후 컷오버된 Next `app/api` 라우트 삭제 (별도 PR)
- [ ] M4. (선택) Vite 전환 검토 — API 라우트 0개가 된 후

## 범위 제외

- Next 프론트 컴포넌트/페이지 변경 (rewrite 로 투명 전환이 원칙)
- 기존에 컷오버 완료된 라우트의 재작업
- 배포 설정(`render.yaml`) 변경, 실제 외부 서비스 호출(Cloudinary/Kakao/FCM/WebPush)
- Next 라우트 파일 삭제 (M3 — 사용자 몫)
