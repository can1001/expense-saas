# Spec: 영수증 관리 (Phase 5, 신규 기능)

> 상위 문서: `docs/DESIGN_SYSTEM_2026-07-18.md` 6절 · 선행: Phase 0~4 (main 반영 완료)
> 태스크: `docs/TASKS_RECEIPTS_PHASE5_2026-07-20.md` · 실행: ralph 루프 (`scripts/ralph/CLAUDE_RECEIPTS_PHASE5.md`)

## 0. 전제 (Assumptions)

1. **DB 스키마 변경 없음** — 영수증은 이미 `ExpenseAttachment`(+`SimpleExpenseAttachment`)에
   Cloudinary URL(url/secureUrl/fileName/format/fileSize)로 저장돼 있다. 조회 기능만 신설.
2. **이 Phase는 신규 요소를 명시적으로 허용한다** (다른 Phase의 "Ask first"와 다름):
   신규 permission 1개, 신규 API 2개, 신규 라우트 1개. **DB 마이그레이션·모델 변경은 여전히 금지.**
3. **권한**: 신규 `PERMISSIONS.RECEIPT_READ = 'receipt:read'`를 `ROLE_PERMISSION_PRESETS`의
   `admin`·`finance_head`(재정팀장)·`accountant`(회계)에 부여. 팀장 자기부서 열람은 범위 밖.
   배포 환경 반영은 기존 `pnpm run db:backfill:roles`로(코드상 preset이 fallback이라 로컬·테스트는 즉시 동작).
4. **예외 세목**: `lib/constants/receipt-exempt-details.ts`의 `areAllItemsReceiptExempt`를 재사용해
   미첨부 현황에서 예외 건을 제외한다.
5. UI 셸은 Phase 4의 `GlobalShell` 재사용. 사이드바 항목은 `global-menu.ts`의 예약 위치에 추가.

## 1. Objective

회계/재정팀장이 **결의서를 열지 않고도** 영수증을 모아보고, 영수증 미첨부 결의서를 파악하며,
원본을 감사용으로 내려받을 수 있는 `/receipts` 화면을 제공한다.

**사용자 스토리**
- 회계 간사로서, 이번 달 부서별 영수증을 갤러리로 훑어보고 원본을 연다.
- 재정팀장으로서, 영수증이 없어야 정상인 예외 세목을 뺀 **진짜 미첨부 결의서**만 골라 후속 조치한다.

## 2. 데이터 소스 (신규 API 2개, 기존 모델만 조회)

| API | 반환 | 쿼리 |
|-----|------|------|
| `GET /api/receipts` | 첨부 목록(썸네일 url·fileName·금액·부서·결의번호·결재상태·expenseId) | 기간·부서·상태 필터. `ExpenseAttachment` join `Expense` |
| `GET /api/receipts/missing` | 영수증 0건 결의서(예외 세목 전부인 건 제외) | 기간·부서 필터. `Expense` where attachments empty AND !areAllItemsReceiptExempt(items) |

- 두 API 모두 `withAdminMenu` 대신 **permission 가드로 `RECEIPT_READ` 확인**
  (기존 `lib/auth/user.ts`의 가드 헬퍼 패턴 재사용 — 신규 라우트 경로를 MENU_PERMISSIONS에 매핑).
- 테넌트 격리: 기존 tenant-context 패턴 준수 (다른 admin API와 동일).
- 페이지네이션: 목록은 커서/오프셋 중 기존 목록 API 관례를 따른다.

## 3. 화면 구성 (`/receipts`, GlobalShell)

```
GlobalShell (title="영수증 관리")
├─ 필터 바: 기간(월 선택)·부서·결재상태
├─ 탭 또는 세그먼트: [영수증 갤러리] [미첨부 현황]
├─ 갤러리: 썸네일 그리드(부서·금액·결의번호·StatusPill), 클릭 시 원본 모달 + "원본 열기"(secureUrl)
└─ 미첨부 현황: 결의서 리스트(신청자·부서·금액·상태·작성일), 행 클릭 → /expenses/{id}
```
- 썸네일은 Cloudinary url, 원본 보기는 secureUrl(HTTPS). 모바일은 2열 그리드.
- 미첨부 0건일 때 빈 상태 메시지, 갤러리 0건일 때도 동일.

## 4. Boundaries

- **Always**: 토큰 유틸리티만 · 권한은 `RECEIPT_READ` 파생 + `menu-permissions.ts` 경유 ·
  기존 컴포넌트(StatusPill·GlobalShell) 재사용 · 커밋 전 태스크별 Verify · 한글 커밋
- **이 Phase에서 허용**: 신규 permission `RECEIPT_READ`, 신규 API `/api/receipts[/missing]`,
  신규 라우트 `/receipts`, `global-menu.ts`·`MENU_PERMISSIONS`에 항목 추가
- **Never**: DB 스키마/모델 변경 · 마이그레이션 · backend/ 수정 · 영수증 업로드·삭제 기능
  (이번은 조회 전용) · 예외 세목 목록 변경 · 역할 배열 하드코딩 · 테스트 삭제/skip

## 5. Success Criteria

- [ ] `RECEIPT_READ` permission 신설, admin·finance_head·accountant 프리셋에 부여, 라벨 등록
- [ ] `GET /api/receipts` — 필터 동작, RECEIPT_READ 없는 역할은 403 (테스트로 확인)
- [ ] `GET /api/receipts/missing` — 예외 세목만인 결의서는 결과에서 제외 (테스트로 확인)
- [ ] `/receipts` 화면: 딥그린 GlobalShell + 갤러리 + 미첨부 현황, 사이드바에 "영수증 관리" 노출
      (RECEIPT_READ 보유 시에만)
- [ ] 원본 열기(secureUrl) 동작, 빈 상태 처리
- [ ] `pnpm vitest run` 전체 통과 · `pnpm run build` 성공 · 신규 파일 lint 0건

## 6. Open Questions (구현 중 확인 후 태스크에 기록)

- SimpleExpense 영수증(`SimpleExpenseAttachment`)도 이번 범위에 포함할지 → 1차는 `ExpenseAttachment`만,
  Simple은 백로그(태스크에서 grep으로 사용량 확인 후 결정, 범위 확대 시 별도 태스크로 분리)
- 목록 페이지네이션 방식은 기존 `/api/expenses` 관례를 따름
