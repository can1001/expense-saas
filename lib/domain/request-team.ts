/**
 * 청구팀은 "위원회 + 사역팀(부)" 조합으로 자동 생성한다.
 * 예: "기획위원회 재정팀"
 */
export function deriveRequestTeam(committee?: string, department?: string): string {
  return [committee, department].filter(Boolean).join(' ').trim();
}


