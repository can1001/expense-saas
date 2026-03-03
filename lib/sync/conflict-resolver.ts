/**
 * 충돌 해결기
 *
 * 오프라인 데이터와 서버 데이터 간의 충돌을 감지하고 해결합니다.
 */

import type {
  OfflineExpense,
  OfflineExpenseFormData,
  ConflictResolution,
  ConflictResolveResult,
} from '@/lib/db/types';

// 서버 지출결의서 타입 (간소화)
interface ServerExpense {
  id: string;
  committee?: string;
  department?: string;
  expenseDate?: string;
  applicantName: string;
  applicantTitle?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  requestAmount: number;
  status: string;
  version?: string;
  updatedAt: string;
  items: Array<{
    id: string;
    budgetDetailId?: string;
    description: string;
    unitPrice: number;
    quantity: number;
    amount: number;
  }>;
}

/**
 * 충돌 해결기 클래스
 */
export class ConflictResolver {
  /**
   * 충돌 감지 및 해결
   */
  resolve(
    localExpense: OfflineExpense,
    serverExpense: ServerExpense | null
  ): ConflictResolveResult {
    // 서버에 데이터가 없으면 로컬 데이터 사용
    if (!serverExpense) {
      return {
        resolution: 'keep_local',
        resolvedData: localExpense.data,
        requiresUserInput: false,
      };
    }

    // 서버 버전 비교 (낙관적 잠금)
    const serverVersion = serverExpense.version
      ? parseInt(serverExpense.version, 10)
      : 0;
    const localSyncVersion = localExpense.syncMeta.serverVersion
      ? parseInt(localExpense.syncMeta.serverVersion, 10)
      : 0;

    // 서버 버전이 동일하면 로컬 데이터 사용
    if (serverVersion === localSyncVersion) {
      return {
        resolution: 'keep_local',
        resolvedData: localExpense.data,
        requiresUserInput: false,
      };
    }

    // 충돌 감지
    const conflicts = this.detectConflicts(localExpense.data, serverExpense);

    // 충돌이 없으면 자동 병합
    if (conflicts.length === 0) {
      const mergedData = this.autoMerge(localExpense.data, serverExpense);
      return {
        resolution: 'merge',
        resolvedData: mergedData,
        requiresUserInput: false,
      };
    }

    // 충돌이 있으면 수동 해결 필요
    return {
      resolution: 'manual',
      requiresUserInput: true,
    };
  }

  /**
   * 충돌 필드 감지
   */
  detectConflicts(
    localData: OfflineExpenseFormData,
    serverData: ServerExpense
  ): ConflictField[] {
    const conflicts: ConflictField[] = [];

    // 금액 비교 (가장 중요한 필드)
    const localTotal = localData.items.reduce((sum, item) => sum + item.amount, 0);
    const serverTotal = serverData.requestAmount;

    if (localTotal !== serverTotal) {
      conflicts.push({
        field: 'requestAmount',
        localValue: localTotal,
        serverValue: serverTotal,
        description: '총 금액',
      });
    }

    // 항목 수 비교
    if (localData.items.length !== serverData.items.length) {
      conflicts.push({
        field: 'items',
        localValue: localData.items.length,
        serverValue: serverData.items.length,
        description: '항목 수',
      });
    }

    // 계좌 정보 비교
    if (localData.bankName !== serverData.bankName) {
      conflicts.push({
        field: 'bankName',
        localValue: localData.bankName,
        serverValue: serverData.bankName,
        description: '은행명',
      });
    }

    if (localData.accountNumber !== serverData.accountNumber) {
      conflicts.push({
        field: 'accountNumber',
        localValue: localData.accountNumber,
        serverValue: serverData.accountNumber,
        description: '계좌번호',
      });
    }

    return conflicts;
  }

  /**
   * 자동 병합
   * 충돌이 없는 필드만 병합합니다.
   */
  autoMerge(
    localData: OfflineExpenseFormData,
    serverData: ServerExpense
  ): OfflineExpenseFormData {
    // 기본적으로 로컬 데이터 우선, 서버에서 누락된 정보만 보완
    return {
      ...localData,
      // 서버에서 최신 상태 반영 가능한 필드들
      committee: localData.committee || serverData.committee,
      department: localData.department || serverData.department,
    };
  }

  /**
   * 수동 병합 (사용자 선택 기반)
   */
  manualMerge(
    localData: OfflineExpenseFormData,
    serverData: ServerExpense,
    selections: Record<string, 'local' | 'server'>
  ): OfflineExpenseFormData {
    const result = { ...localData };

    for (const [field, choice] of Object.entries(selections)) {
      if (choice === 'server') {
        switch (field) {
          case 'bankName':
            result.bankName = serverData.bankName;
            break;
          case 'accountNumber':
            result.accountNumber = serverData.accountNumber;
            break;
          case 'accountHolder':
            result.accountHolder = serverData.accountHolder;
            break;
          case 'applicantName':
            result.applicantName = serverData.applicantName;
            break;
          case 'items':
            // 서버 항목으로 교체
            result.items = serverData.items.map((item, index) => ({
              localId: `server-${item.id}`,
              budgetDetailId: item.budgetDetailId,
              description: item.description,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              amount: item.amount,
              order: index,
            }));
            break;
        }
      }
    }

    return result;
  }

  /**
   * 서버 데이터로 로컬 덮어쓰기
   */
  useServerData(serverData: ServerExpense): OfflineExpenseFormData {
    return {
      committee: serverData.committee,
      department: serverData.department,
      expenseDate: serverData.expenseDate,
      applicantName: serverData.applicantName,
      applicantTitle: serverData.applicantTitle,
      bankName: serverData.bankName,
      accountNumber: serverData.accountNumber,
      accountHolder: serverData.accountHolder,
      items: serverData.items.map((item, index) => ({
        localId: `server-${item.id}`,
        budgetDetailId: item.budgetDetailId,
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        amount: item.amount,
        order: index,
      })),
    };
  }
}

// 충돌 필드 타입
interface ConflictField {
  field: string;
  localValue: unknown;
  serverValue: unknown;
  description: string;
}

// 싱글톤 인스턴스
export const conflictResolver = new ConflictResolver();

// 유틸리티 함수들

/**
 * 서버에서 지출결의서 조회
 */
export async function fetchServerExpense(
  serverId: string
): Promise<ServerExpense | null> {
  try {
    const response = await fetch(`/api/expenses/${serverId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('서버 조회 실패');
    }

    return response.json();
  } catch (error) {
    console.error('[ConflictResolver] 서버 조회 오류:', error);
    return null;
  }
}

/**
 * 충돌 여부 빠른 확인
 */
export async function hasConflict(
  localExpense: OfflineExpense
): Promise<boolean> {
  if (!localExpense.serverId) {
    return false;
  }

  const serverExpense = await fetchServerExpense(localExpense.serverId);

  if (!serverExpense) {
    return false;
  }

  const result = conflictResolver.resolve(localExpense, serverExpense);
  return result.requiresUserInput;
}
