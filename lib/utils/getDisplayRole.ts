/**
 * 사용자의 연도별 역할을 우선순위에 따라 표시할 역할 결정
 * yearRole이 있으면 우선 사용, 없으면 기본 role 사용
 */

export interface YearRole {
  id: string;
  role: string;
  department: string | null;
  year: number;
}

export interface UserWithYearRoles {
  role: string;
  department: string | null;
  yearRoles?: YearRole[];
}

export interface DisplayRole {
  role: string;
  department: string | null;
}

/**
 * 역할 우선순위 (낮은 인덱스가 높은 우선순위)
 */
export const ROLE_PRIORITY_ORDER = [
  'finance_head',    // 재정팀장
  'accountant',      // 회계
  'admin_assistant', // 행정간사
  'team_leader',     // 팀장
];

/**
 * 사용자의 표시할 역할을 결정합니다.
 * yearRoles가 있으면 우선순위에 따라 정렬 후 첫 번째 역할 반환
 * yearRoles가 없으면 기본 role 반환
 */
export function getDisplayRole(user: UserWithYearRoles): DisplayRole {
  if (user.yearRoles && user.yearRoles.length > 0) {
    const sorted = [...user.yearRoles].sort((a, b) => {
      const aIdx = ROLE_PRIORITY_ORDER.indexOf(a.role);
      const bIdx = ROLE_PRIORITY_ORDER.indexOf(b.role);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
    return { role: sorted[0].role, department: sorted[0].department };
  }
  return { role: user.role, department: user.department };
}
