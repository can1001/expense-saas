/**
 * 예산 세목 즐겨찾기 및 최근 사용 관련 설정 상수
 */

export const BUDGET_PREFERENCES = {
  /** 최대 즐겨찾기 개수 */
  MAX_FAVORITES: 20,

  /** 화면에 표시할 최근 사용 항목 개수 */
  MAX_RECENT_DISPLAY: 5,

  /** IndexedDB에 저장할 최근 사용 항목 개수 */
  MAX_RECENT_STORAGE: 50,

  /** 자동 정리 대상 기간 (일) */
  CLEANUP_DAYS: 90,
} as const;
