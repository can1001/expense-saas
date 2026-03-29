/**
 * 세목 즐겨찾기 및 최근 사용 관련 타입 정의
 */

/**
 * 저장용 예산 세목 정보 (IndexedDB에 저장되는 형태)
 */
export interface StoredBudgetDetail {
  /** 고유 식별자: `${category}-${subcategory}-${name}` */
  id: string;
  /** 세목 이름 */
  name: string;
  /** 항 (카테고리) */
  category: string;
  /** 목 (서브카테고리) */
  subcategory: string;
  /** 담당자 ID (결재선 연결용) */
  managerId: string | null;
  /** 담당자 이름 */
  managerName: string | null;
}

/**
 * 즐겨찾기 예산 항목
 */
export interface FavoriteBudget {
  /** Primary key: `${userId}_${budgetId}` */
  id: string;
  /** 사용자 ID */
  userId: string;
  /** 예산 세목 ID */
  budgetId: string;
  /** 저장된 세목 정보 (비정규화) */
  budget: StoredBudgetDetail;
  /** 추가 시간 (timestamp) */
  addedAt: number;
}

/**
 * 최근 사용 예산 항목
 */
export interface RecentBudgetUsage {
  /** Primary key: `${userId}_${budgetId}` */
  id: string;
  /** 사용자 ID */
  userId: string;
  /** 예산 세목 ID */
  budgetId: string;
  /** 저장된 세목 정보 (비정규화) */
  budget: StoredBudgetDetail;
  /** 마지막 사용 시간 (timestamp) */
  usedAt: number;
  /** 사용 횟수 */
  usageCount: number;
}

/**
 * BudgetDetailInfo를 StoredBudgetDetail로 변환하는 헬퍼
 */
export function createStoredBudgetDetail(
  name: string,
  category: string,
  subcategory: string,
  managerId: string | null,
  managerName: string | null
): StoredBudgetDetail {
  return {
    id: `${category}-${subcategory}-${name}`,
    name,
    category,
    subcategory,
    managerId,
    managerName,
  };
}

/**
 * 복합 ID 생성 헬퍼
 */
export function createCompositeId(userId: string, budgetId: string): string {
  return `${userId}_${budgetId}`;
}
