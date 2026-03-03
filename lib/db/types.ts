/**
 * 오프라인 데이터 저장을 위한 타입 정의
 */

// 오프라인 지출결의서 상태
export type OfflineExpenseStatus =
  | 'draft'          // 임시저장
  | 'pending_sync'   // 동기화 대기
  | 'syncing'        // 동기화 중
  | 'synced'         // 동기화 완료
  | 'conflict'       // 충돌 발생
  | 'failed';        // 동기화 실패

// 오프라인 첨부파일 상태
export type OfflineAttachmentStatus =
  | 'pending'        // 업로드 대기
  | 'uploading'      // 업로드 중
  | 'uploaded'       // 업로드 완료
  | 'failed';        // 업로드 실패

// 동기화 액션 타입
export type SyncAction = 'create' | 'update' | 'delete' | 'submit';

// 동기화 큐 항목 상태
export type SyncQueueStatus =
  | 'pending'        // 대기
  | 'processing'     // 처리 중
  | 'completed'      // 완료
  | 'failed';        // 실패

// 오프라인 지출결의서 폼 데이터
export interface OfflineExpenseFormData {
  // 기본 정보
  committee?: string;
  department?: string;
  expenseDate?: string;

  // 신청자 정보
  applicantName: string;
  applicantTitle?: string;

  // 계좌 정보
  bankName: string;
  accountNumber: string;
  accountHolder: string;

  // 항목 목록
  items: OfflineExpenseItem[];

  // 첨부파일 로컬 ID 목록
  attachmentLocalIds?: string[];
}

// 오프라인 지출결의서 항목
export interface OfflineExpenseItem {
  localId: string;
  budgetDetailId?: string;
  budgetCategory?: string;
  budgetSubcategory?: string;
  budgetDetail?: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  order: number;
}

// 오프라인 지출결의서 (IndexedDB 저장용)
export interface OfflineExpense {
  localId: string;                          // 로컬 고유 ID (uuid)
  serverId?: string;                        // 서버 ID (동기화 후 할당)

  data: OfflineExpenseFormData;             // 폼 데이터

  status: OfflineExpenseStatus;             // 오프라인 상태

  // 동기화 메타데이터
  syncMeta: {
    attempts: number;                       // 동기화 시도 횟수
    lastAttemptAt?: number;                 // 마지막 시도 시간 (timestamp)
    lastError?: string;                     // 마지막 에러 메시지
    serverVersion?: string;                 // 서버 버전 (충돌 감지용)
  };

  // 버전 관리
  localVersion: number;                     // 로컬 버전 (수정할 때마다 증가)

  // 타임스탬프
  createdAt: number;                        // 생성 시간 (timestamp)
  updatedAt: number;                        // 수정 시간 (timestamp)
}

// 오프라인 첨부파일 (IndexedDB 저장용)
export interface OfflineAttachment {
  localId: string;                          // 로컬 고유 ID
  expenseLocalId: string;                   // 연결된 expense 로컬 ID

  // 파일 정보
  blob: Blob;                               // 파일 원본 데이터
  fileName: string;
  fileSize: number;
  mimeType: string;

  // 업로드 결과 (업로드 완료 후)
  uploadResult?: {
    id: string;
    url: string;
    publicId?: string;
  };

  // 상태
  status: OfflineAttachmentStatus;
  errorMessage?: string;

  // 타임스탬프
  createdAt: number;
}

// 동기화 큐 항목
export interface SyncQueueItem {
  id: string;                               // 큐 항목 ID
  expenseLocalId: string;                   // 대상 expense 로컬 ID

  action: SyncAction;                       // 동기화 액션
  status: SyncQueueStatus;                  // 상태

  priority: number;                         // 우선순위 (1=높음, 3=낮음)

  // 재시도 정보
  retryCount: number;
  maxRetries: number;
  lastError?: string;

  // 타임스탬프
  createdAt: number;
  processedAt?: number;
}

// 동기화 메타데이터
export interface SyncMeta {
  key: string;                              // 메타 키 (예: 'lastSyncAt')
  value: string | number | boolean;
  updatedAt: number;
}

// 동기화 결과
export interface SyncResult {
  success: boolean;
  localId: string;
  serverId?: string;
  action: SyncAction;
  error?: string;
  conflictData?: {
    local: OfflineExpenseFormData;
    server: unknown;
  };
}

// 충돌 해결 옵션
export type ConflictResolution =
  | 'keep_local'     // 로컬 데이터 유지
  | 'use_server'     // 서버 데이터 사용
  | 'merge'          // 자동 병합
  | 'manual';        // 수동 해결 필요

// 충돌 해결 결과
export interface ConflictResolveResult {
  resolution: ConflictResolution;
  resolvedData?: OfflineExpenseFormData;
  requiresUserInput: boolean;
}
