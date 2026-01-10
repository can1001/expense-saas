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

// 결재 상태 타입 (3단계 결재: 팀장 → 회계 → 재정팀장)
export type ApprovalStatus =
  | 'DRAFT'           // 작성중
  | 'PENDING'         // 결재 대기 (1차 팀장 결재 대기)
  | 'APPROVED_STEP_1' // 1차 승인 완료 (2차 회계 결재 대기)
  | 'APPROVED_STEP_2' // 2차 승인 완료 (3차 재정팀장 결재 대기)
  | 'APPROVED_FINAL'  // 최종 승인
  | 'REJECTED'        // 반려
  | 'WITHDRAWN';      // 회수

// 지출 상태 타입 (최종 승인 후 관리)
export type PaymentStatus = 'PENDING' | 'COMPLETED';

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
  // 지출 상태 관련 필드
  paymentStatus?: PaymentStatus;
  paymentCompletedAt?: string | null;
  paymentCompletedBy?: string | null;
  paymentNote?: string | null;
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
  status?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
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
// 표준화된 API 응답 타입
// ============================================

/** API 필드 에러 */
export interface FieldError {
  fieldName: string;
  message: string;
}

/** API 에러 상세 */
export interface ApiError {
  type: 'VALIDATION' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER_ERROR' | 'UNKNOWN';
  message: string;
  details?: unknown;
  fields?: FieldError[];
}

/** 통일된 API 응답 타입 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  message?: string;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

/** 페이지네이션 메타 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** 페이지네이션 API 응답 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  meta?: {
    pagination: PaginationMeta;
  };
}

// ============================================
// 사용자 타입
// ============================================

/** 사용자 역할 코드 (Role.code와 동일) */
export type UserRole = 'admin' | 'finance_head' | 'accountant' | 'team_leader' | 'admin_assistant' | 'user';

/** 사용자 정보 */
export interface User {
  id: string;
  userid: string;
  username: string;
  role: UserRole;
  committee?: string;
  department?: string;
}

/** 현재 사용자 응답 */
export interface CurrentUserResponse {
  user: User | null;
}

// ============================================
// 결재 시스템 타입
// ============================================

/** 결재 단계 상태 */
export type StepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';

/** 결재 액션 타입 */
export type ApprovalAction =
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'RESUBMIT'
  | 'WITHDRAW'
  | 'MODIFY_LINE'
  | 'DELEGATE';

/** 결재 단계 정보 */
export interface ApprovalStepInfo {
  id: string;
  stepNumber: number;
  stepName: string;
  approverName: string;
  approverTitle?: string | null;
  status: StepStatus;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  comment?: string | null;
}

/** 결재선 정보 */
export interface ApprovalLineInfo {
  id: string;
  currentStep: number;
  totalSteps: number;
  steps: ApprovalStepInfo[];
  isUrgent: boolean;
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
