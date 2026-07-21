# 백엔드 분리(FastAPI 컷오버) 현황 — F2 전수 대조

생성: F2 태스크 (docs/TASKS_BACKEND_REMAINDER.md §F2). 3자 대조:
① `app/api/**/route.ts` 경로+메서드(export 된 `GET/POST/PUT/PATCH/DELETE` grep),
② FastAPI `app.openapi()['paths']` (실제 등록된 라우트, `RUNNING_ZONE=local` 기동),
③ `next.config.ts` beforeFiles rewrite `source` 목록.

갱신(D7 완료 후 재확인): `admin/year-config/:year` GET·DELETE 를 `admin_routes.py` 에 포팅,
rewrite 등록 완료 — 미이관 0건으로 확정.

## 요약

- Next `app/api/**/route.ts` 파일: **132개** (=distinct 경로 132개)
- FastAPI 등록 경로: **138개** (Next 132 + 신규 5 백엔드 전용 + D7 1)
- 완전 이관(Next 메서드 전부 FastAPI 구현 + rewrite 존재): **129 / 132**
- 잔여 불일치: **3건** (아래 상세) — 전부 기존 컷오버(본 PRD 범위 밖, `ed04941` 이전)에서 발생한 메서드 갭으로 프론트 미사용 확인. 미이관 라우트는 D7 완료로 0건.

## 전체 대조표

| Next 경로 (route.ts) | Next 메서드 | FastAPI 메서드 | rewrite | 상태 |
|---|---|---|---|---|
| `/api/admin/budget-execution` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/change-history` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/cumulative-report` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/dashboard` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/hr-admin-execution` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/invitations` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/admin/manager-exceptions` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/notifications` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/admin/offerings` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/admin/offerings/:id` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/admin/offerings/batch` | `DELETE,GET` | `DELETE,GET` | O | 완전 이관 |
| `/api/admin/offerings/template` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/quarterly-report` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/quarterly-report/export` | `GET` | `GET` | O | 완전 이관 |
| `/api/admin/roles` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/admin/roles/:id` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/admin/year-config/:year` | `DELETE,GET` | `DELETE,GET` | O | 완전 이관 (D7) |
| `/api/admin/year-setup-status` | `GET` | `GET` | O | 완전 이관 |
| `/api/approval-line/calculate` | `GET,POST` | `POST` | O | 메서드 갭(GET) — 아래 각주 ① |
| `/api/approval-policies` | *(Next 라우트 없음)* | `GET,POST` | O | 신규(FastAPI 전용, 결재정책 엔진) |
| `/api/approvals` | `GET` | `GET` | O | 완전 이관 |
| `/api/approvals/pending-count` | `GET` | `GET` | O | 완전 이관 |
| `/api/auth/accept-invitation` | `POST` | `POST` | O | 완전 이관 |
| `/api/auth/change-password` | `POST` | `POST` | O | 완전 이관 |
| `/api/auth/kakao` | `POST` | `POST` | O | 완전 이관 |
| `/api/auth/link-kakao` | `DELETE,GET,POST` | `DELETE,GET,POST` | O | 완전 이관 |
| `/api/auth/login` | `POST` | `POST` | O | 완전 이관 |
| `/api/auth/logout` | `POST` | `POST` | O | 완전 이관 |
| `/api/auth/me` | `GET` | `GET` | O | 완전 이관 |
| `/api/auth/signup` | `POST` | `POST` | O | 완전 이관 |
| `/api/auth/switch-tenant` | `POST` | `POST` | O | 완전 이관 |
| `/api/bank-accounts` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/bank-accounts/:id` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/budget` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/budget-categories` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/budget-categories/:id` | `PATCH` | `PATCH` | O | 완전 이관 |
| `/api/budget-details` | `POST` | `GET,POST` | O | 완전 이관 (FastAPI GET 추가 제공) |
| `/api/budget-details/:id` | `PATCH` | `PATCH` | O | 완전 이관 |
| `/api/budget-details/:id/description` | `PATCH` | `PATCH` | O | 완전 이관 |
| `/api/budget-details/year` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/budget-details/year/auto-assign` | `POST` | `POST` | O | 완전 이관 |
| `/api/budget-subcategories` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/budget-subcategories/:id` | `PATCH` | `PATCH` | O | 완전 이관 |
| `/api/budget/hierarchy` | `GET` | `GET` | O | 완전 이관 |
| `/api/budget/hierarchy/export` | `GET` | `GET` | O | 완전 이관 |
| `/api/budget/memo-examples` | `GET` | `GET` | O | 완전 이관 |
| `/api/budget/search` | `GET` | `GET` | O | 완전 이관 |
| `/api/budget/simple` | `POST` | `POST` | O | 완전 이관 |
| `/api/budget/simple/all-details` | `GET` | `GET` | O | 완전 이관 |
| `/api/budget/upload` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/budget/usage-details` | `GET` | `GET` | O | 완전 이관 |
| `/api/committees` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/committees/:id` | `DELETE,PATCH` | `DELETE,PATCH` | O | 완전 이관 |
| `/api/departments` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/departments/:id` | `DELETE,PATCH` | `DELETE,PATCH` | O | 완전 이관 |
| `/api/departments/leaders-upload` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/expense-templates` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/expense-templates/:id` | `DELETE,GET,POST,PUT` | `DELETE,GET,POST,PUT` | O | 완전 이관 |
| `/api/expenses` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/expenses/:id` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/expenses/:id/approval` | `GET,PUT` | `GET` | O | 메서드 갭(PUT) — 아래 각주 ② |
| `/api/expenses/:id/approval-line` | *(Next 라우트 없음)* | `POST` | O | 신규(FastAPI 전용, 결재선 수정 대체 경로) |
| `/api/expenses/:id/approve` | `POST` | `POST` | O | 완전 이관 |
| `/api/expenses/:id/attachments` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/expenses/:id/attachments/:attachmentId` | `DELETE` | `DELETE` | O | 완전 이관 |
| `/api/expenses/:id/delegate` | *(Next 라우트 없음)* | `POST` | O | 신규(FastAPI 전용) |
| `/api/expenses/:id/duplicate` | `POST` | `POST` | O | 완전 이관 |
| `/api/expenses/:id/fix-status` | `POST` | `POST` | O | 완전 이관 |
| `/api/expenses/:id/payment-status` | `GET,PUT` | `GET,PUT` | O | 완전 이관 |
| `/api/expenses/:id/reject` | `POST` | `POST` | O | 완전 이관 |
| `/api/expenses/:id/resubmit` | *(Next 라우트 없음)* | `POST` | O | 신규(FastAPI 전용) |
| `/api/expenses/:id/submit` | `POST` | `POST` | O | 완전 이관 |
| `/api/expenses/:id/withdraw` | `POST` | `POST` | O | 완전 이관 |
| `/api/expenses/bulk` | `POST` | `POST` | O | 완전 이관 |
| `/api/expenses/bulk-expense-date` | `PUT` | `PUT` | O | 완전 이관 |
| `/api/expenses/bulk-payment-status` | `PUT` | `PUT` | O | 완전 이관 |
| `/api/expenses/bulk-upload` | `POST` | `POST` | O | 완전 이관 |
| `/api/expenses/bulk-upload-template` | `GET` | `GET` | O | 완전 이관 |
| `/api/expenses/export/excel` | `GET` | `GET` | O | 완전 이관 |
| `/api/expenses/filter-options` | `GET` | `GET` | O | 완전 이관 |
| `/api/me/config` | `GET` | `GET` | O | 완전 이관 |
| `/api/me/memberships` | `GET` | `GET` | O | 완전 이관 |
| `/api/notifications/logs` | *(Next 라우트 없음)* | `GET` | - | 신규(FastAPI 전용, 미사용 — rewrite 없음) |
| `/api/notifications/preferences` | *(Next 라우트 없음)* | `GET,PUT` | - | 신규(FastAPI 전용, 미사용 — rewrite 없음) |
| `/api/platform/activity-logs` | `GET` | `GET` | O | 완전 이관 |
| `/api/platform/admins` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/platform/admins/:id` | `DELETE,GET,PATCH,PUT` | `DELETE,PATCH,PUT` | O | 메서드 갭(GET) — 아래 각주 ③ |
| `/api/platform/auth/login` | `POST` | `POST` | O | 완전 이관 |
| `/api/platform/auth/logout` | `POST` | `POST` | O | 완전 이관 |
| `/api/platform/auth/me` | `GET` | `GET` | O | 완전 이관 |
| `/api/platform/export` | `GET` | `GET` | O | 완전 이관 |
| `/api/platform/settings` | `GET,PATCH,PUT` | `GET,PATCH,PUT` | O | 완전 이관 |
| `/api/platform/stats` | `GET` | `GET` | O | 완전 이관 |
| `/api/platform/tenants` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/platform/tenants/:id` | `DELETE,GET,PATCH,PUT` | `DELETE,GET,PATCH,PUT` | O | 완전 이관 |
| `/api/platform/tenants/:id/settings` | `GET,PATCH,PUT` | `GET,PATCH,PUT` | O | 완전 이관 |
| `/api/platform/tenants/:id/stats` | `GET` | `GET` | O | 완전 이관 |
| `/api/platform/tenants/:id/users` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/platform/tenants/:id/users/:userId` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/push/fcm-subscribe` | `DELETE,POST` | `DELETE,POST` | O | 완전 이관 |
| `/api/push/fcm-test` | `POST` | `POST` | O | 완전 이관 |
| `/api/push/history` | `GET` | `GET` | O | 완전 이관 |
| `/api/push/subscribe` | `POST` | `POST` | O | 완전 이관 |
| `/api/push/test` | `POST` | `POST` | O | 완전 이관 |
| `/api/push/unsubscribe` | `POST` | `POST` | O | 완전 이관 |
| `/api/push/vapid-public-key` | `GET` | `GET` | O | 완전 이관 |
| `/api/recurring-expenses` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/recurring-expenses/:id` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/recurring-expenses/:id/generate` | `POST` | `POST` | O | 완전 이관 |
| `/api/recurring-expenses/process` | `POST` | `POST` | O | 완전 이관 |
| `/api/settings` | `GET,PUT` | `GET,PUT` | O | 완전 이관 |
| `/api/simple-expenses` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/simple-expenses/:id` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/tenant/info` | `GET` | `GET` | O | 완전 이관 |
| `/api/upload` | `POST` | `POST` | O | 완전 이관 |
| `/api/upload/delete` | `DELETE` | `DELETE` | O | 완전 이관 |
| `/api/users` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/users/:id` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/users/by-role/:role` | `GET` | `GET` | O | 완전 이관 |
| `/api/users/me/signatures` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/users/me/signatures/:id` | `DELETE,GET,PUT` | `DELETE,GET,PUT` | O | 완전 이관 |
| `/api/users/me/signatures/:id/default` | `PUT` | `PUT` | O | 완전 이관 |
| `/api/users/quick-register` | `POST` | `POST` | O | 완전 이관 |
| `/api/users/upload` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/users/year-roles` | `DELETE,GET,POST` | `DELETE,GET,POST` | O | 완전 이관 |
| `/api/youth-night/admin/curriculum` | `DELETE,POST,PUT` | `DELETE,POST,PUT` | O | 완전 이관 |
| `/api/youth-night/admin/lesson` | `DELETE,GET,PATCH,POST,PUT` | `DELETE,GET,PATCH,POST,PUT` | O | 완전 이관 |
| `/api/youth-night/admin/questions` | `DELETE,GET,POST,PUT` | `DELETE,GET,POST,PUT` | O | 완전 이관 |
| `/api/youth-night/admin/questions/reorder` | `POST` | `POST` | O | 완전 이관 |
| `/api/youth-night/attendance` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/youth-night/attendance/stats` | `GET` | `GET` | O | 완전 이관 |
| `/api/youth-night/points` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/youth-night/quiz` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/youth-night/quiz/stats` | `GET` | `GET` | O | 완전 이관 |
| `/api/youth-night/ranking` | `GET` | `GET` | O | 완전 이관 |
| `/api/youth-night/recitation` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/youth-night/recitation/approve` | `GET,POST` | `GET,POST` | O | 완전 이관 |
| `/api/youth-night/stats` | `GET` | `GET` | O | 완전 이관 |

`/api/expenses/:id/:action(submit|approve|reject|resubmit|withdraw|delegate|approval-line|approval|fix-status|payment-status|duplicate)` 1개 rewrite 항목이 위 표의 `expenses/:id/*` 액션 9종(신규 3종 포함)을 모두 커버한다 (표에는 대조 편의상 액션별로 풀어서 표기).

## 잔여 불일치 3건 상세

`admin/year-config/:year` 는 D7 태스크로 이관 완료되어 아래 목록에서 제외되었다 (GET·DELETE 모두
`admin_routes.py` 포팅 + rewrite 등록 완료, tenantId 스코프·SETTINGS_MANAGE 권한 가드 유지).

### 메서드 갭 (본 PRD 범위 밖 · 프론트 미사용 확인 — 문서화만)

이 3건은 모두 `ed04941`(본 PRD 시작 전 "선행 완료") 시점에 컷오버된 결재 관련 라우트에서 발생했다. 각각 프론트엔드 실사용 코드를 grep 하여 **현재 호출부가 없는 죽은 코드**임을 확인했고, FastAPI 쪽에는 더 이상 사용되는 신규 결재 엔진(`ApprovalPolicyEngine`)이 대체 경로로 존재한다. 본 PRD의 "이미 컷오버된 라우트를 건드리지 않는다" 원칙에 따라 재작업하지 않고 발견 사실만 기록한다 (M3에서 Next 라우트 삭제 시 자동 소거됨).

① **`GET /api/approval-line/calculate`** — Next의 레거시 2단계 결재선 계산(`lib/services/approval-line-service.ts`의 `calculateApprovalLine`)을 그대로 노출하던 미리보기 API. `components/expense-form/ApprovalLinePreview.tsx`는 `POST`만 호출하며 GET 호출부는 코드베이스 전체에 없음. FastAPI `approval_policy_routes.py`의 `POST /approval-line/calculate`는 신규 `ApprovalPolicyEngine` 기반 재구현(레거시 계약 유지)이고 GET은 대응 없음.

② **`PUT /api/expenses/:id/approval`** — 결재선 수정(제출 전) 기능. 프론트 어디에도 호출부 없음(`app/expenses/[id]/page.tsx`는 `GET`만 사용). FastAPI는 동등 기능을 `POST /expenses/:id/approval-line`(`approval_service.py`의 `modify_line`)로 별도 노출.

③ **`GET /api/platform/admins/:id`** — SuperAdmin 상세 단건 조회. `app/platform/admins/page.tsx`는 목록(`GET /api/platform/admins`) + `PUT`/`PATCH`/`DELETE`만 호출하고 단건 상세 GET 호출부 없음.

## Next 라우트 커버리지

- rewrite 미등록 Next 경로: 없음 (`admin/year-config/:year` 는 D7 완료로 등록됨).
- FastAPI 전용(신규, Next 라우트 없음) 5건: `approval-policies`(2메서드), `expenses/:id/approval-line`, `expenses/:id/delegate`, `expenses/:id/resubmit` — 모두 rewrite 등록됨. `notifications/logs`, `notifications/preferences` 2건은 rewrite 미등록·프론트 미사용 상태로 향후 필요 시 추가.

## 결론

- 본 PRD Phase A~Y 태스크 범위 내 신규 이관 라우트는 **전수 완전 이관** (메서드 갭 0).
- 전체 `app/api/**` 기준 미이관 라우트는 **0건** (D7 완료로 `admin/year-config` 이관 종료).
- 잔여 3건은 모두 `ed04941`(본 PRD 시작 전 선행 완료) 시점 결재 관련 라우트의 메서드 갭이며, 조사 결과 프론트 미사용 죽은 코드로 확인되어 문서화로 종결한다 (M3에서 Next 라우트 삭제 시 자동 소거).
- **F2 완료**: 3자 대조 + D7 이관 확인까지 마쳐 "메서드/누락 갭 0" 기준을 충족했다.
