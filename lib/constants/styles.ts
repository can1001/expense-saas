/**
 * 공통 Tailwind CSS 클래스 상수
 * 중복된 스타일을 재사용합니다.
 */

// ============================================
// 입력 필드 스타일
// WCAG 권장 터치 타겟: 최소 44x44px
// ============================================

export const INPUT_BASE = 'w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400';

export const INPUT_ERROR = 'border-red-500 focus:ring-red-500';

export const INPUT_DISABLED = 'bg-gray-100 cursor-not-allowed';

export const SELECT_BASE = `${INPUT_BASE} appearance-none cursor-pointer`;

export const TEXTAREA_BASE = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400 resize-none';

// ============================================
// 버튼 스타일
// WCAG 권장 터치 타겟: 최소 44x44px
// ============================================

export const BTN_BASE = 'px-4 py-2.5 min-h-[44px] rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50';

export const BTN_PRIMARY = `${BTN_BASE} bg-blue-500 text-white hover:bg-blue-600`;

export const BTN_SECONDARY = `${BTN_BASE} bg-gray-500 text-white hover:bg-gray-600`;

export const BTN_SUCCESS = `${BTN_BASE} bg-green-500 text-white hover:bg-green-600`;

export const BTN_DANGER = `${BTN_BASE} bg-red-500 text-white hover:bg-red-600`;

export const BTN_OUTLINE = `${BTN_BASE} border border-gray-300 text-gray-700 hover:bg-gray-50`;

export const BTN_EMERALD = `${BTN_BASE} bg-emerald-500 text-white hover:bg-emerald-600`;

// 큰 버튼
export const BTN_LG = 'px-6 py-3 min-h-[48px]';

// 작은 버튼 (데스크톱 전용, 모바일에서는 BTN_BASE 사용 권장)
export const BTN_SM = 'px-3 py-1.5 text-sm min-h-[36px]';

// 페이지네이션 버튼
export const BTN_PAGINATION = 'px-4 py-2 min-h-[44px] text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export const BTN_PAGE_ACTIVE = 'px-4 py-2 min-h-[44px] min-w-[44px] text-sm font-medium rounded-lg bg-blue-500 text-white transition-colors flex items-center justify-center';

export const BTN_PAGE_INACTIVE = 'px-4 py-2 min-h-[44px] min-w-[44px] text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center';

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

export const ALERT_ERROR = 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg';

// ============================================
// 테이블 스타일 (엑셀 스타일 그리드)
// ============================================

export const TABLE_BASE = 'min-w-full border border-gray-300';

export const TABLE_HEADER = 'bg-gray-50 border-b border-gray-300';

export const TABLE_HEADER_CELL = 'px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 last:border-r-0';

export const TABLE_BODY = 'bg-white';

export const TABLE_CELL = 'px-4 py-3 text-sm text-gray-900 text-left border-r border-b border-gray-200 last:border-r-0';

export const TABLE_CELL_RIGHT = 'px-4 py-3 text-sm text-gray-900 text-right border-r border-b border-gray-200 last:border-r-0';

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

export const SPINNER_BLUE = 'animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500';

export const SPINNER_MD = 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500';

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

// ============================================
// 모달 스타일
// ============================================

export const MODAL_OVERLAY = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';

export const MODAL_CONTAINER = 'bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col';

export const MODAL_HEADER = 'px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0';

export const MODAL_BODY = 'px-6 py-4 flex-1 min-h-0 overflow-y-auto overscroll-contain';

export const MODAL_FOOTER = 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0';

// 모달 크기
export const MODAL_SM = 'w-full max-w-md';

export const MODAL_MD = 'w-full max-w-lg';

export const MODAL_LG = 'w-full max-w-2xl';

// ============================================
// 탭 스타일
// WCAG 권장 터치 타겟: 최소 44x44px
// ============================================

export const TAB_CONTAINER = 'flex border-b border-gray-200 mb-4';

export const TAB_ACTIVE = 'px-4 py-3 min-h-[44px] border-b-2 border-blue-500 text-blue-600 font-medium flex items-center';

export const TAB_INACTIVE = 'px-4 py-3 min-h-[44px] text-gray-500 hover:text-gray-700 cursor-pointer flex items-center';

// ============================================
// 뱃지 스타일
// ============================================

export const BADGE_DEFAULT = 'px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800';

// ============================================
// 반응형 타이포그래피
// 모바일 → 태블릿 → 데스크톱 순으로 크기 증가
// ============================================

// 페이지 메인 제목 (홈페이지 등)
export const TEXT_HERO = 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold';

// 페이지 제목
export const TEXT_PAGE_TITLE = 'text-xl sm:text-2xl md:text-3xl font-bold';

// 섹션 제목
export const TEXT_SECTION_TITLE = 'block text-lg sm:text-xl md:text-2xl font-bold';

// 카드 제목
export const TEXT_CARD_TITLE = 'text-base sm:text-lg md:text-xl font-bold';

// 부제목/설명
export const TEXT_SUBTITLE = 'text-sm sm:text-base md:text-lg';

// 본문
export const TEXT_BODY = 'text-sm sm:text-base';

// 작은 텍스트
export const TEXT_SMALL = 'text-xs sm:text-sm';

// 통계 숫자
export const TEXT_STAT = 'text-2xl md:text-3xl font-bold';

// ============================================
// 반응형 패딩/간격
// ============================================

export const PADDING_PAGE = 'p-4 sm:p-6 md:p-8';

export const PADDING_CARD = 'p-4 sm:p-6 md:p-8';

export const MARGIN_SECTION = 'mb-6 sm:mb-8 md:mb-12';
