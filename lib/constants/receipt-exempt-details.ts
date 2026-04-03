/**
 * 영수증 첨부가 선택사항인 세목 목록
 *
 * 이 세목들은 영수증 없이도 지출결의서 제출이 가능합니다.
 * - 교역자식대: 교역자 식대 지원
 * - 사무간사식대: 사무간사 식대 지원
 * - 목회_통신비: 목회 통신비 지원
 * - 공간사역비: 공간사역팀 운영비
 * - 사택관리비: 사택 관리비 지원
 */
export const RECEIPT_EXEMPT_DETAILS = [
  '교역자식대',
  '사무간사식대',
  '목회_통신비',
  '공간사역비',
  '사택관리비',
] as const;

export type ReceiptExemptDetail = (typeof RECEIPT_EXEMPT_DETAILS)[number];

/**
 * 모든 항목이 영수증 예외 세목인지 확인
 *
 * @param items - 지출 항목 배열 (budgetDetail 필드 포함)
 * @returns 모든 항목이 예외 세목이면 true, 하나라도 일반 세목이면 false
 */
export function areAllItemsReceiptExempt(
  items: Array<{ budgetDetail?: string }>
): boolean {
  if (items.length === 0) return false;

  return items.every(
    (item) =>
      item.budgetDetail &&
      RECEIPT_EXEMPT_DETAILS.includes(item.budgetDetail as ReceiptExemptDetail)
  );
}
