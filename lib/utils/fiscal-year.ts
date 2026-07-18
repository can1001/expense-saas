/**
 * 회계연도 단일 출처 헬퍼
 *
 * 현재 정책: 회계연도 = 캘린더 연도 (1월 시작).
 * 연도 스코프 데이터(BudgetDetailYear.year, UserYearRole.year 등)와
 * 탑바 "YYYY 회계연도" 표기가 모두 이 값을 기준으로 한다.
 *
 * 비(非)캘린더 회계연도(예: 3월 시작)가 필요해지면 테넌트 settings에
 * fiscalYearStartMonth를 추가하고 이 함수만 수정한다.
 * (docs/DESIGN_SYSTEM_2026-07-18.md 11절 결정 사항)
 *
 * 예외: 분기 보고서는 1분기에 전년도를 기본값으로 하는 자체 규칙을 유지한다
 * (app/admin/quarterly-report — 이 헬퍼 적용 대상 아님).
 */
export function getFiscalYear(now: Date = new Date()): number {
  return now.getFullYear();
}

/** 탑바 표기용 라벨 (예: "2026 회계연도") */
export function getFiscalYearLabel(now: Date = new Date()): string {
  return `${getFiscalYear(now)} 회계연도`;
}
