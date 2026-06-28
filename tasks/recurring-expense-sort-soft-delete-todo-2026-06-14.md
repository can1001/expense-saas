# 태스크 목록: 자동이체 이체일 정렬 + CANCELLED 소프트 삭제

작성일: 2026-06-14
Spec: [docs/SPEC_RECURRING_EXPENSE_SORT_AND_SOFT_DELETE_2026-06-14.md](../docs/SPEC_RECURRING_EXPENSE_SORT_AND_SOFT_DELETE_2026-06-14.md)
Plan: [tasks/recurring-expense-sort-soft-delete-plan-2026-06-14.md](recurring-expense-sort-soft-delete-plan-2026-06-14.md)

> 진행 규칙: 한 번에 한 task만 in-progress. 완료 즉시 체크. 체크포인트(CP)에서 결과 보고 후 다음 진행.

---

## 슬라이스 A — Soft delete 기반 (스키마 + DELETE)

- [ ] **T1. `RecurringExpense.deletedAt` 컬럼 추가**
  - **Acceptance**: `prisma/schema.prisma`에 `deletedAt DateTime?` + `@@index([deletedAt])` 추가. `npm run db:push` 성공. Prisma Client 재생성.
  - **Verify**: `npm run db:push` exit 0, `npx prisma studio`에서 컬럼 노출 (또는 `npx prisma migrate status` 확인).
  - **Files**: `prisma/schema.prisma`
  - **Checkpoint**: ✅ CP1

- [ ] **T3. DELETE에서 `deletedAt = now()` 동시 세팅**
  - **Acceptance**: `DELETE /api/recurring-expenses/[id]` 호출 시 `prisma.recurringExpense.update`의 `data`에 `status: 'CANCELLED'`와 `deletedAt: new Date()`가 함께 저장됨. 이미 CANCELLED인 항목은 기존처럼 400.
  - **Verify**: 신규 vitest 케이스 (아래 T3v) 그린.
  - **Files**: `app/api/recurring-expenses/[id]/route.ts` (~2줄)

- [ ] **T3v. DELETE 회귀 테스트**
  - **Acceptance**: 다음 케이스 추가:
    1. DELETE 정상 → `prisma.update` 호출 인자에 `status: 'CANCELLED'` AND `deletedAt: Date` 포함
    2. 이미 CANCELLED → 400 응답 (회귀)
    3. 본인 소유가 아닌 항목 DELETE → 403 (회귀)
  - **Verify**: `npx vitest run app/api/recurring-expenses/__tests__` 통과.
  - **Files**: `app/api/recurring-expenses/__tests__/recurring-expenses.test.ts`
  - **Checkpoint**: ✅ CP3

---

## 슬라이스 B — 정렬 + 기본 숨김 (GET + UI 카운트)

- [ ] **T2. GET 정렬·기본 필터 변경**
  - **Acceptance**:
    - `orderBy`를 `[{ nextGenerationDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]`로 변경. (Prisma 6.19 미지원 시 단순 `[{ nextGenerationDate: 'asc' }, { id: 'asc' }]`로 fallback.)
    - `status` 미지정 시 `where.status = { not: 'CANCELLED' }` 자동 적용.
    - `status === 'CANCELLED'` 명시 시에만 CANCELLED 노출.
    - 그 외 status (ACTIVE/PAUSED/COMPLETED) 동작은 기존 그대로.
  - **Verify**: 신규 vitest 케이스 (아래 T2v) 그린.
  - **Files**: `app/api/recurring-expenses/route.ts` (~10줄)

- [ ] **T2v. GET 회귀 테스트**
  - **Acceptance**: 다음 케이스 추가:
    1. status 미지정 → `where`에 `status: { not: 'CANCELLED' }` 포함, `orderBy`에 `nextGenerationDate` ASC 포함
    2. status='CANCELLED' → `where.status === 'CANCELLED'` (예외 적용 확인)
    3. status='ACTIVE' → 기존 동작 유지 (회귀)
  - **Verify**: `npx vitest run app/api/recurring-expenses/__tests__` 통과.
  - **Files**: `app/api/recurring-expenses/__tests__/recurring-expenses.test.ts`
  - **Checkpoint**: ✅ CP2

- [ ] **T4. 페이지 상태 카운트 보정**
  - **Acceptance**: `app/recurring-expenses/page.tsx`의 `statusCounts` 계산은 그대로 두되, ALL 카운트가 CANCELLED를 제외한 합계로 자연스럽게 동작함을 확인. 상태 필터 탭 UI 변경 없음. (서버가 이미 제외해서 보내므로 추가 코드 거의 불필요. 다만 CANCELLED 탭 위 카운트 표기 시 별도 카운트 호출 미도입 — 운영자 클릭 시 정확 값 노출됨으로 충분.)
  - **Verify**: `npm run dev` → `/recurring-expenses` 진입, 정렬 순서(다음 이체 임박순) + CANCELLED 미노출 + CANCELLED 탭 클릭 시 노출 육안 확인.
  - **Files**: `app/recurring-expenses/page.tsx` (변경 거의 없음 — 코드 점검만)
  - **Checkpoint**: ✅ CP4

---

## 슬라이스 C — 일관성 마무리 + 회귀

- [ ] **T6. PUT 스키마에서 'CANCELLED' 제거 (Open Q1 확정 후)**
  - **Acceptance**: `updateRecurringExpenseSchema.status` enum에서 `'CANCELLED'` 제거 → `['ACTIVE', 'PAUSED']`만 허용. PUT으로 CANCELLED 전환 차단. 취소는 DELETE 일원화.
  - **Verify**: vitest 회귀 케이스 (PUT body에 status='CANCELLED' → 400 zod 에러).
  - **Files**: `app/api/recurring-expenses/[id]/route.ts`, 테스트
  - **Pre-req**: Open Q1 결정 (사용자 확인)

- [ ] **T7. 빌드 + 전체 테스트 회귀**
  - **Acceptance**: `npm run build` 통과, `npx vitest run` 전체 그린 (신규 + 기존).
  - **Verify**: 두 명령 exit 0.
  - **Checkpoint**: ✅ CP5 — commit 직전 게이트

- [ ] **T8. 커밋 (사용자 승인 후)**
  - **Acceptance**: 한글 커밋 메시지로 단일 commit (또는 슬라이스별 3 commit). 사양·plan·todo 문서도 함께 포함.
  - **Verify**: `git log -1` 확인.
  - **Pre-req**: 사용자가 "커밋해도 됨" 확인. 자동 커밋 금지.

---

## 진행 보드

| Task | 상태 | 비고 |
|------|------|------|
| T1 schema | ⏳ | DB 변경 — db:push 필요 |
| T3 DELETE | ⏳ | |
| T3v DELETE 테스트 | ⏳ | |
| T2 GET | ⏳ | |
| T2v GET 테스트 | ⏳ | |
| T4 page 카운트 | ⏳ | 점검만 — 실제 코드 변경 0줄 가능 |
| T6 PUT 정리 | ⏳ | Open Q1 결정 후 |
| T7 빌드+테스트 회귀 | ⏳ | 커밋 직전 게이트 |
| T8 커밋 | ⏳ | 사용자 승인 게이트 |

범례: ⏳ todo / 🟡 in-progress / ✅ done / ⛔ blocked
