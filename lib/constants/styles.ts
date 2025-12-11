/**
 * 공통 Tailwind CSS 클래스 상수
 * 중복된 스타일을 재사용합니다.
 */

// ============================================
// 입력 필드 스타일
// ============================================

export const INPUT_BASE = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400';

export const INPUT_ERROR = 'border-red-500 focus:ring-red-500';

export const INPUT_DISABLED = 'bg-gray-100 cursor-not-allowed';

export const SELECT_BASE = `${INPUT_BASE} appearance-none cursor-pointer`;

export const TEXTAREA_BASE = `${INPUT_BASE} resize-none`;

// ============================================
// 버튼 스타일
// ============================================

export const BTN_BASE = 'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50';

export const BTN_PRIMARY = `${BTN_BASE} bg-blue-500 text-white hover:bg-blue-600`;

export const BTN_SECONDARY = `${BTN_BASE} bg-gray-500 text-white hover:bg-gray-600`;

export const BTN_SUCCESS = `${BTN_BASE} bg-green-500 text-white hover:bg-green-600`;

export const BTN_DANGER = `${BTN_BASE} bg-red-500 text-white hover:bg-red-600`;

export const BTN_OUTLINE = `${BTN_BASE} border border-gray-300 text-gray-700 hover:bg-gray-50`;

export const BTN_EMERALD = `${BTN_BASE} bg-emerald-500 text-white hover:bg-emerald-600`;

// 큰 버튼
export const BTN_LG = 'px-6 py-3';

// 작은 버튼
export const BTN_SM = 'px-3 py-1.5 text-sm';

// ============================================
// 카드/섹션 스타일
// ============================================

export const CARD_BASE = 'bg-white rounded-lg shadow-sm';

export const SECTION_CARD = `${CARD_BASE} p-6 mb-6`;

export const SECTION_TITLE = 'text-xl font-semibold text-gray-900 mb-4';

// ============================================
// 라벨 스타일
// ============================================

export const LABEL_BASE = 'block text-sm font-medium text-gray-700 mb-1';

export const LABEL_REQUIRED = "after:content-['*'] after:ml-0.5 after:text-red-500";

// ============================================
// 에러 메시지 스타일
// ============================================

export const ERROR_MESSAGE = 'mt-1 text-sm text-red-600';

// ============================================
// 테이블 스타일
// ============================================

export const TABLE_BASE = 'min-w-full divide-y divide-gray-200';

export const TABLE_HEADER = 'bg-gray-50';

export const TABLE_HEADER_CELL = 'px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase';

export const TABLE_BODY = 'bg-white divide-y divide-gray-200';

export const TABLE_CELL = 'px-4 py-3 text-sm text-gray-900';

export const TABLE_CELL_RIGHT = `${TABLE_CELL} text-right`;

// ============================================
// 레이아웃 스타일
// ============================================

export const PAGE_CONTAINER = 'min-h-screen bg-gray-50';

export const CONTENT_CONTAINER = 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8';

export const GRID_2_COLS = 'grid grid-cols-1 md:grid-cols-2 gap-4';

export const GRID_3_COLS = 'grid grid-cols-1 md:grid-cols-3 gap-4';

export const FLEX_CENTER = 'flex items-center justify-center';

export const FLEX_BETWEEN = 'flex items-center justify-between';

// ============================================
// 로딩/상태 스타일
// ============================================

export const SPINNER = 'animate-spin rounded-full h-4 w-4 border-b-2 border-white';

export const SPINNER_LG = 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500';

// ============================================
// 색상 상수
// ============================================

export const COLORS = {
  primary: 'blue-500',
  primaryHover: 'blue-600',
  success: 'green-500',
  successHover: 'green-600',
  danger: 'red-500',
  dangerHover: 'red-600',
  warning: 'yellow-500',
  emerald: 'emerald-500',
  emeraldHover: 'emerald-600',
} as const;
