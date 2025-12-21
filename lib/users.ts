// 사용자 역할 정의
export type UserRole =
  | 'finance_head'   // 재정팀장 (3차/최종 결재)
  | 'accountant'     // 회계 (2차 결재)
  | 'team_leader'    // 팀장 (1차 결재)
  | 'user';          // 일반 사용자

// 역할별 결재 단계 매핑
export const ROLE_STEP_MAP: Record<UserRole, number | null> = {
  team_leader: 1,    // 1차 결재
  accountant: 2,     // 2차 결재
  finance_head: 3,   // 3차 결재
  user: null,        // 결재 권한 없음
};

// 역할 한글명
export const ROLE_NAMES: Record<UserRole, string> = {
  finance_head: '재정팀장',
  accountant: '회계',
  team_leader: '팀장',
  user: '사용자',
};

// 사용자 정의
export interface UserInfo {
  id: string;
  username: string;
  role: UserRole;
  department?: string;  // 소속 부서 (팀장인 경우)
}

export const USERS: readonly UserInfo[] = [
  { id: '1', username: '청연정혜종', role: 'finance_head' },
  { id: '2', username: '청연김흥래', role: 'team_leader', department: '교육훈련위원회' },
  { id: '3', username: '청연신창국', role: 'team_leader', department: '예배위원회' },
  { id: '4', username: '청연윤운문', role: 'accountant' },
  { id: '5', username: '청연송원영', role: 'user' },
] as const;

export type User = (typeof USERS)[number];

export function findUserById(id: string): UserInfo | undefined {
  return USERS.find((u) => u.id === id);
}

export function findUserByUsername(username: string): UserInfo | undefined {
  return USERS.find((u) => u.username === username);
}

// 역할로 사용자 찾기
export function findUsersByRole(role: UserRole): UserInfo[] {
  return USERS.filter((u) => u.role === role);
}

// 결재 가능 여부 확인
export function canApprove(user: UserInfo, stepNumber: number): boolean {
  const userStep = ROLE_STEP_MAP[user.role];
  return userStep === stepNumber;
}

// 역할 표시명 가져오기
export function getRoleDisplayName(role: UserRole): string {
  return ROLE_NAMES[role];
}
