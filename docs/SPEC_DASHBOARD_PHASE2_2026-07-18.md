# Spec: 홈 회계 대시보드 (Phase 2)

> 상위 문서: `docs/DESIGN_SYSTEM_2026-07-18.md` · 선행: Phase 0·1 (커밋 9badf05, 완료)
> 태스크: `docs/TASKS_DASHBOARD_PHASE2_2026-07-18.md` · 실행: ralph 루프 (`scripts/ralph/CLAUDE_DASHBOARD_PHASE2.md`)

## 0. 전제 (Assumptions)

1. **신규 API 없음** — 기존 `/api/admin/dashboard`(KPI·최근 결의서), `/api/admin/budget-execution`(부서별 집행)만 사용.
2. **역할 분기**: 관리 메뉴 권한자(`canAccessAdminMenuWithRoles`)만 홈에서 회계 대시보드를 보고,
   그 외 사용자는 **기존 HomeClient 카드 그리드를 그대로** 본다 (일반 사용자용 대시보드는 Phase 3+).
3. **Header 유지**: 대시보드 화면도 `withHeader` 전환기 유지. Header 완전 대체(알림·테넌트 스위처
   탑바 이관)는 Phase 3으로 이월.
4. **결재 진행 스테퍼 제외**: 결재선 상세 데이터가 목록 API에 없어 Phase 3(결재함 리디자인)에서 진행.
5. KPI 4번째 카드는 시안의 "정기 지출 자동화" 대신 API에 이미 있는 **"지급 대기"**(pendingPayments)를 쓴다.

## 1. Objective

관리 권한 사용자의 홈(`/`)을 카드 그리드에서 **회계 대시보드**로 교체한다:
KPI 4카드 + 최근 지출결의서 테이블 + 부서별 예산 집행 패널, 전역 딥그린 사이드바(AppShell) 적용.

## 2. 데이터 소스 (전부 기존)

| 데이터 | 출처 | 비고 |
|--------|------|------|
| KPI (집행률·대기 결재·이번 달 지출·지급 대기) | `GET /api/admin/dashboard?year=` | `kpi.executionRate/pendingApprovals/monthlyExpense/pendingPayments` |
| 최근 지출결의서 5건 | 같은 API `recentExpenses[]` | id/applicantName/requestAmount/status/department |
| 부서별 집행 현황 | `GET /api/admin/budget-execution` | 응답 구조는 구현 시 라우트 파일에서 확인 |
| 결재함 뱃지 | `usePendingApprovalCount` 훅 | 폴링 1분 |
| 연도 | `getFiscalYear()` (`lib/utils/fiscal-year.ts`) | `new Date().getFullYear()` 직접 호출 금지 |

## 3. 화면 구성 (아티팩트 목업 v0.3 기준)

```
AppShell (withHeader, 전역 사이드바=getGlobalSidebarMenu, 탑바 title="회계 대시보드")
├─ KPI 4카드 (StatCard): 대기 결재 / 이번 달 지출 / 예산 집행률(ProgressBar) / 지급 대기
├─ 최근 지출결의서 테이블: 항목·부서·금액(우측 tabular-nums)·상태(StatusPill) + "전체 보기 →" (/expenses)
└─ 부서별 예산 집행 패널: 부서명 + % + ProgressBar(90% 초과 앰버), 초과 부서 경고 배너
```

- 상태 매핑: `PENDING/APPROVED_STEP_1/APPROVED_STEP_2` → StatusPill pending "대기" ·
  `APPROVED_FINAL` → approved "승인" · `REJECTED` → rejected "반려" · 그 외 → brand로 상태명 표시.
- 금액 표기: `₩` + `toLocaleString('ko-KR')`.
- 모바일(<lg): KPI 2열, 테이블은 `overflow-x-auto` 컨테이너.

## 4. Boundaries (스펙 위반 금지)

- **Always**: 색상은 토큰 유틸리티(`bg-brand-*`, `text-status-*`, `bg-surface-*`)만 ·
  권한은 `menu-permissions.ts` 파생 함수만 · Phase 0 컴포넌트(StatCard/StatusPill/ProgressBar) 재사용 ·
  커밋 전 `pnpm vitest run`+`pnpm run lint` · 한글 커밋
- **Ask first (= ralph에서는 하지 않음)**: 신규 API/DB 변경 · 의존성 추가 · Header.tsx 대규모 수정 ·
  루트 layout 변경 · admin-menu IA 변경
- **Never**: 역할 배열 하드코딩 · 일반 사용자 화면(HomeClient) 동작 변경 · backend/ 수정 ·
  테스트 삭제/skip · 기존 blue 클래스 일괄 치환

## 5. Success Criteria

- [ ] 관리 권한자 홈: 딥그린 사이드바(전역 config, 결재함 뱃지 포함) + 회계 대시보드 렌더링
- [ ] 일반 사용자 홈: 기존 HomeClient 그대로 (스냅샷 수준 무변화)
- [ ] "자동이체" 표기가 "정기 지출"로 통일 (Header·페이지 타이틀)
- [ ] HomeClient의 `/youth-night` 잔여 링크 제거
- [ ] 사이드바 하단 사용자 카드(이름·이메일·로그아웃) 동작
- [ ] `pnpm vitest run` 전체 통과 · `pnpm run build` 성공 · 신규 파일 lint 0건
