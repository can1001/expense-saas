/**
 * 재정보고서 데이터 인덱스
 * 새 분기 데이터 추가 시 여기에서 export 변경
 */

// 타입 정의 export
export * from './types';

// 분기별 데이터 import
import { report2026Q1 } from './2026-Q1';

// 최신 분기 데이터 export
export const latestReport = report2026Q1;

// 개별 분기 데이터 export
export { report2026Q1 };

// 모든 보고서 목록 (분기 선택 기능 확장 시 사용)
export const allReports = [report2026Q1];
