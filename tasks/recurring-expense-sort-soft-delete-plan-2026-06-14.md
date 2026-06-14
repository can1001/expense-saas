# 구현 계획: 자동이체 이체일 정렬 + CANCELLED 소프트 삭제

작성일: 2026-06-14
Spec: [docs/SPEC_RECURRING_EXPENSE_SORT_AND_SOFT_DELETE_2026-06-14.md](../docs/SPEC_RECURRING_EXPENSE_SORT_AND_SOFT_DELETE_2026-06-14.md)

## 작업 범위 한눈에

| # | 변경 파일 | 변경 내용 | 줄 수 |
|---|----------|----------|------|
| 1 | `prisma/schema.prisma` | `RecurringExpense.deletedAt` + 인덱스 추가 | ~3 |
| 2 | `app/api/recurring-expenses/route.ts` | GET 정렬·기본 필터 변경 | ~10 |
| 3 | `app/api/recurring-expenses/[id]/route.ts` | DELETE에 `deletedAt` 동시 세팅 | ~2 |
| 4 | `app/recurring-expenses/page.tsx` | ALL 카운트에서 CANCELLED 제외 | ~3 |
| 5 | `app/api/recurring-expenses/__tests__/recurring-expenses.test.ts` | 신규 케이스 5개 | ~80 |

총 변경량 ≈ 100줄 미만. 단일 PR로 합칠 수 있는 규모.

## 의존성 그래프

```
[T1] schema.prisma (deletedAt 추가)
  └─ npm run db:push (스키마 반영)
       │
       ├──► [T2] GET route 변경 (정렬 + status 필터)
       │      └──► [T2v] GET 테스트 (정렬/숨김/CANCELLED 노출)
       │
       └──► [T3] DELETE route 변경 (deletedAt 세팅)
              └──► [T3v] DELETE 테스트 (deletedAt 동시 세팅)

[T4] page.tsx 상태 카운트 (T2 응답 변화에 종속)
  └──► [T4v] 로컬 dev 서버에서 육안 확인

[T5] 빌드 + 전체 테스트 회귀
  └──► 체크포인트 (commit 직전)
```

T1→T2/T3, T2/T3→T4, 마지막 T5는 직렬. T2와 T3는 병렬 가능하나, 한 PR로 정리 시 순차도 무방.

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Prisma 6.19의 `orderBy: { nulls: 'last' }` 문법 미지원 가능성 | 빌드 단계에서 즉시 타입에러 발견. 미지원 시 `[{ nextGenerationDate: 'asc' }, { id: 'asc' }]` 단순 정렬 + Postgres 기본 NULLS LAST(ASC) 동작에 의존 (Prisma는 raw 미가공 → Postgres가 처리). 검증: 작은 시드로 결과 순서 확인. |
| Cursor 페이지네이션 불안정 (동일 `nextGenerationDate` 다수일 때) | `orderBy`에 `id` 보조키 포함하여 결정적 순서 보장. 한계 100건 + 항목 수 적음 → 실무 영향 미미. |
| 클라이언트의 statusCounts ALL 계산이 서버 응답과 불일치 | 서버가 CANCELLED를 빼고 보내므로 ALL = ACTIVE+PAUSED+COMPLETED 합. 클라이언트의 `counts.ALL++` 로직은 자연스럽게 일치. CANCELLED 카운트 표시는 'CANCELLED' 필터 탭 클릭 시점에만 정확하게 됨 → 운영자에게 충분 (요구사항). |
| 기존 PUT의 status=CANCELLED 경로에서는 deletedAt 미세팅 | 사양상 DELETE를 정식 취소 경로로 사용. PUT으로 status를 CANCELLED로 바꾸는 사용 사례 없음 확인 → 일관성 위해 PUT의 CANCELLED 변경 거부 또는 DELETE 위임. **결정 필요**: 본 PR에서는 PUT 스키마에서 'CANCELLED' enum 제거하여 입구를 DELETE로 일원화한다. |
| 회귀: 다른 페이지/서비스가 CANCELLED 항목을 기대 | 그렙 결과: cron(`processRecurringExpenses`)은 status=ACTIVE만, 상세 GET은 id 직접 조회 → 무영향. 추가 그렙으로 재확인. |

## 검증 체크포인트

```
✅ CP1 (T1 후): db:push 성공, Studio에서 deletedAt 컬럼 확인
✅ CP2 (T2 후): vitest run, GET 케이스 3종 통과
✅ CP3 (T3 후): vitest run, DELETE 케이스 통과
✅ CP4 (T4 후): npm run dev → 페이지 진입, 정렬·숨김 육안 확인
✅ CP5 (T5):    npm run build + 전체 vitest run 통과
```

체크포인트마다 멈추고 결과 보고. 그린이면 다음 진행.

## 구현 순서 (수직 슬라이스)

각 task는 "스키마→API→테스트→커밋 가능한 상태"로 끝나는 한 슬라이스.

1. **슬라이스 A — Soft delete 기반**: T1(스키마) + T3(DELETE) + T3v(테스트) → CP1+CP3
   - 이체 정렬 없이도 단독 배포 가능. CANCELLED는 여전히 노출되지만 deletedAt이 채워지기 시작.
2. **슬라이스 B — 정렬 + 숨김 노출**: T2(GET) + T2v(테스트) + T4(카운트) → CP2+CP4
   - A 위에 얹어 사용자 가시 변경 완성.
3. **슬라이스 C — 회귀 + 일관성**: PUT에서 CANCELLED 제거 + 회귀 + 빌드 → CP5
   - 단일 입구 정책 마무리.

세 슬라이스를 하나의 PR로 묶을지 분할할지는 build 단계에서 결정 (분량이 작아 통합 권장).

## Out of Scope (Spec 재확인)

- 자동이체 상세 페이지 UI
- 모바일 카드 시각 변경
- 복구 UI / 휴지통
- hard delete

## Open Questions

- **Q1**: PUT에서 `CANCELLED` enum을 제거하는 것에 동의하는가? (DELETE 일원화)
  - 영향: 기존 클라이언트가 PUT body로 status=CANCELLED 보내면 400 에러. 그러나 현재 UI 코드에는 그런 경로 없음(상세 페이지 미수정 범위) → 안전.
  - 결정 보류 시: PUT에서도 CANCELLED 시 deletedAt 세팅하도록 분기 추가 (코드 ~5줄)
