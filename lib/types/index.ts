/**
 * 중앙화된 타입 정의
 * 모든 타입을 이 파일에서 관리합니다.
 */

// ============================================
// 지출결의서 항목 타입
// ============================================

export interface ExpenseItem {
  id?: string;
  budgetDetail: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  order?: number;
}

// ============================================
// 첨부파일 타입
// ============================================

export interface ExpenseAttachment {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  createdAt: string;
}

// ============================================
// 지출결의서 타입
// ============================================

// 결재 상태 타입
export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface Expense {
  id: string;
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  expenseDate?: string | null;
  requestAmount: number;
  requestDate: string;
  requestTeam: string;
  applicantName: string;
  applicantTitle?: string | null;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  items: ExpenseItem[];
  attachments?: ExpenseAttachment[];
  // 결재 관련 필드
  status?: ApprovalStatus;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  // 메타
  createdAt: string;
  updatedAt: string;
  version?: string;
}

// ============================================
// 폼 데이터 타입
// ============================================

export interface ExpenseFormData {
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  expenseDate?: string;
  items: ExpenseItem[];
  requestDate: string;
  requestTeam: string;
  applicantName: string;
  applicantTitle?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

// ============================================
// API 응답 타입
// ============================================

/**
 * 지출결의서 목록 응답 (간략한 형태)
 */
export interface ExpenseListItem {
  id: string;
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  requestAmount: number;
  applicantName: string;
  requestDate: string;
  createdAt: string;
}

export interface ExpenseListResponse {
  expenses: ExpenseListItem[];
  total: number;
}

export interface ExpenseListPaginatedResponse {
  expenses: Expense[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  error: string;
  details?: string;
}

// ============================================
// 예산 마스터 타입
// ============================================

export interface BudgetMaster {
  id: string;
  committee: string;
  department: string;
  category: string;
  subcategory: string;
  detail: string;
  manager?: string;
  accountCode?: string;
  description?: string;
  isActive: boolean;
}

export interface BudgetHierarchy {
  committees: string[];
  departments: string[];
  categories: string[];
  subcategories: string[];
  details: string[];
}

// ============================================
// 업로드 파일 타입
// ============================================

export interface UploadedFile {
  id?: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}
