# PRD — 프론트 전면 전환 (Next.js API → FastAPI 커토버)

> **작성일**: 2026-07-17
> **목표**: FastAPI에 이미 구현된 도메인(인증·예산·지출·결재)의 **실제 화면 트래픽**을
> `/api/py/*` 프록시 경유 FastAPI로 전환한다. 도메인별 피처 플래그로 켜고 끌 수 있어야 하며,
> **플래그 기본값 off에서는 기존 동작과 100% 동일**해야 한다(무중단 롤백).
> **태스크 상세**: `docs/TASKS_FRONTEND_CUTOVER.md` (단일 truth)
> **배경**: `BACKEND_SEPARATION_STATUS.md` §5-E, `spec_python_refactoring.md` §7

## 범위 제외 (이번 루프에서 건드리지 않음 — 레거시 Next.js API 유지)

- 첨부 업로드(Cloudinary), 엑셀 export, 벌크 작업(bulk-payment-status 등), duplicate, filter-options
- SimpleExpense / RecurringExpense, 오프라인 동기화(`lib/sync/**`, `useOfflineExpense`)
- 푸시(web-push/FCM), 관리자 알림 발송(`/api/admin/notifications`)
- Phase 5 도메인(재정보고서·청나잇·헌금·settings)

## 태스크 (의존성 순 — 위에서부터 하나씩)

- [x] C0. FastAPI 인증 쿠키 폴백 — `get_current_user`에 `user_token` 쿠키 폴백 추가 (+pytest)
- [x] C1. 프론트 도메인 스위치 헬퍼 — `lib/api/api-base.ts` (`NEXT_PUBLIC_PY_DOMAINS` 파싱) (+vitest)
- [x] C2. 인증 전환 — `/api/auth/me`(GET)·`/api/auth/logout`(POST) 호출처를 헬퍼 경유로 전환 + FastAPI 응답 계약 정합
- [x] C3. 예산 캐스케이드 전환 — `BudgetSelector` POST `/api/budget` + year-roles GET `/api/budget`
- [x] C4. 예산 마스터 조회 전환 — committees/departments/budget-categories/subcategories/details GET 5종
- [x] C5. 예산 마스터 쓰기 보강+전환 — FastAPI PATCH `/{id}` 5종 + departments DELETE 구현 후 POST/PATCH/DELETE 전환
- [ ] C6. 지출 목록/상세 조회 전환 — FastAPI 목록 쿼리 필터 보강 + `app/expenses` GET 전환
- [ ] C7. 지출 쓰기 보강+전환 — FastAPI PUT/DELETE `/api/expenses/{id}` 구현 후 `ExpenseForm` POST/PUT + 상세 DELETE 전환
- [ ] C8. 결재 액션 전환 — submit/approve/reject/withdraw POST 4종 + `/{id}/approval` GET
- [ ] C9. 결재 목록/카운트 보강+전환 — FastAPI `/api/approvals`·`/api/approvals/pending-count` 구현 후 화면 전환
- [ ] C10. 결재선 계산 전환 — `ApprovalLinePreview` POST `/api/approval-line/calculate`

## 최종 검증 (C1~C10 전부 [x] 이후에만)

- [ ] F1. 프론트 전체 그린 — `npm run lint` + `npx vitest run` 통과
- [ ] F2. 백엔드 전체 그린 — `cd backend && uv run pytest -q` 통과
- [ ] F3. 빌드·회귀 — `npm run build` 통과 + 플래그 off 기본 상태에서 레거시 경로 회귀 없음 확인 (기존 테스트 무변경 통과로 증명)
