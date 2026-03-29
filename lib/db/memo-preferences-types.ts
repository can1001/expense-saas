/**
 * 적요 즐겨찾기 관련 타입 정의
 */

/**
 * 즐겨찾기 적요 항목
 */
export interface FavoriteMemo {
  /** Primary key: `${userId}_${memoHash}` */
  id: string;
  /** 사용자 ID */
  userId: string;
  /** 적요 텍스트 */
  memo: string;
  /** 관련 세목 이름 (선택) */
  budgetDetail?: string;
  /** 추가 시간 (timestamp) */
  addedAt: number;
}

/**
 * 적요 텍스트의 해시를 생성 (ID용)
 */
export function createMemoHash(memo: string): string {
  // 간단한 해시 함수 (충돌 가능성 낮음)
  let hash = 0;
  for (let i = 0; i < memo.length; i++) {
    const char = memo.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * 복합 ID 생성 헬퍼
 */
export function createMemoCompositeId(userId: string, memo: string): string {
  return `${userId}_${createMemoHash(memo)}`;
}
