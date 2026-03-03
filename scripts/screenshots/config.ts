/**
 * Screenshot capture configuration
 */

export const config = {
  // Base URL (use environment variable or default)
  baseUrl: process.env.SCREENSHOT_BASE_URL || 'http://localhost:4001',

  // Test account credentials (set via environment variables)
  testAccount: {
    userid: process.env.TEST_USER_ID || 'testuser',
    password: process.env.TEST_USER_PASSWORD || 'test1234',
  },

  // Viewport configurations
  viewports: {
    desktop: { width: 1280, height: 800 },
    mobile: { width: 375, height: 812 }, // iPhone X
    tablet: { width: 768, height: 1024 },
  },

  // Output directory for screenshots
  outputDir: 'docs/user-guide/screenshots',

  // Delay before capture (for animations to settle)
  captureDelay: 500,

  // Screenshot quality (PNG is lossless, this affects JPEG only)
  quality: 90,
};

// Screenshot definitions by category
export const screenshots = {
  expenseForm: [
    { name: 'expense-new', description: '새 지출결의서 페이지' },
    { name: 'budget-section', description: '예산 정보 섹션' },
    { name: 'items-section', description: '세부 항목 섹션' },
    { name: 'applicant-section', description: '신청 정보 섹션' },
    { name: 'bank-section', description: '은행 정보 섹션' },
    { name: 'file-upload', description: '첨부파일 섹션' },
    { name: 'approval-preview', description: '결재선 미리보기' },
    { name: 'signature-modal', description: '서명/도장 선택 모달' },
  ],
  pwa: [
    { name: 'offline-banner', description: '오프라인 배너' },
    { name: 'sync-status', description: '동기화 상태 표시' },
    { name: 'pwa-install-desktop', description: '데스크톱 설치 안내' },
  ],
  push: [
    { name: 'push-permission', description: '알림 권한 요청' },
    { name: 'push-notification', description: '알림 예시' },
    { name: 'push-settings', description: '알림 설정 페이지' },
  ],
};

// Section selectors for expense form
export const selectors = {
  sections: {
    budget: 'section:has(h2:text("예산 정보")), div:has(> h2:text("예산 정보"))',
    items: 'section:has(h2:text("세부 항목")), div:has(> h2:text("세부 항목"))',
    applicant: 'section:has(h2:text("신청 정보")), div:has(> h2:text("신청 정보"))',
    bank: 'section:has(h2:text("은행 정보")), div:has(> h2:text("은행 정보"))',
    fileUpload: 'section:has(h2:text("첨부파일")), div:has(> h2:text("첨부파일"))',
    approvalPreview: 'section:has(h2:text("결재선")), div:has(> h2:text("결재선"))',
  },
  login: {
    useridInput: '#userid',
    passwordInput: '#password',
    submitButton: 'button[type="submit"]',
  },
  modals: {
    signature: '[role="dialog"], .fixed.inset-0 .bg-white.rounded-lg',
  },
  offline: {
    banner: '.fixed.top-0, [class*="bg-amber"], [class*="bg-yellow"]',
  },
};
