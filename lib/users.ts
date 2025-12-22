// 사용자 역할 정의
export type UserRole =
  | 'admin'          // 시스템 관리자
  | 'finance_head'   // 재정팀장 (3차/최종 결재)
  | 'accountant'     // 회계 (2차 결재)
  | 'team_leader'    // 팀장 (1차 결재)
  | 'user';          // 일반 사용자

// 역할별 결재 단계 매핑
export const ROLE_STEP_MAP: Record<UserRole, number | null> = {
  admin: null,       // 시스템 관리자 (결재 없음, 모든 권한)
  team_leader: 1,    // 1차 결재
  accountant: 2,     // 2차 결재
  finance_head: 3,   // 3차 결재
  user: null,        // 결재 권한 없음
};

// 역할 한글명
export const ROLE_NAMES: Record<UserRole, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  team_leader: '팀장',
  user: '사용자',
};

// 사용자 정의
export interface UserInfo {
  id: string;
  userid: string;       // 로그인 아이디 (예: 청연정혜종)
  username: string;     // 표시 이름 (예: 정혜종)
  role: UserRole;
  department?: string;  // 소속 부서 (팀장인 경우)
}

export const USERS: readonly UserInfo[] = [
  // 기존 사용자
  { id: '1', userid: '청연정혜종', username: '정혜종', role: 'admin' },
  { id: '2', userid: '청연김흥래', username: '김흥래', role: 'team_leader', department: '교육훈련위원회' },
  { id: '3', userid: '청연신창국', username: '신창국', role: 'finance_head' },
  { id: '4', userid: '청연윤운문', username: '윤운문', role: 'accountant' },
  { id: '5', userid: '청연송원영', username: '송원영', role: 'user' },

  // 예배위원회 팀장
  { id: '6', userid: '청연김예찬', username: '김예찬', role: 'team_leader', department: '예배위원회/방송팀' },
  { id: '7', userid: '청연김민광', username: '김민광', role: 'team_leader', department: '예배위원회/찬양팀' },
  { id: '8', userid: '청연방순화', username: '방순화', role: 'team_leader', department: '예배위원회/기도팀' },
  { id: '9', userid: '청연전수희', username: '전수희', role: 'team_leader', department: '예배위원회/안내팀' },
  { id: '10', userid: '청연유정희', username: '유정희', role: 'team_leader', department: '예배위원회/예배지원팀' },

  // 교육훈련위원회 팀장
  { id: '11', userid: '청연장태규', username: '장태규', role: 'team_leader', department: '교육훈련위원회/새가족팀' },
  { id: '12', userid: '청연허지혜', username: '허지혜', role: 'team_leader', department: '교육훈련위원회/세바맘팀' },
  { id: '13', userid: '청연박영미', username: '박영미', role: 'team_leader', department: '교육훈련위원회/영유아부' },
  { id: '14', userid: '청연유미정', username: '유미정', role: 'team_leader', department: '교육훈련위원회/유치부' },
  { id: '15', userid: '청연김경민', username: '김경민', role: 'team_leader', department: '교육훈련위원회/유년부' },
  { id: '16', userid: '청연조민경', username: '조민경', role: 'team_leader', department: '교육훈련위원회/초등부' },
  { id: '17', userid: '청연김대현', username: '김대현', role: 'team_leader', department: '교육훈련위원회/중고등부' },
  { id: '18', userid: '청연오승환', username: '오승환', role: 'team_leader', department: '교육훈련위원회/청세포팀' },

  // 목양위원회 팀장
  { id: '19', userid: '청연강홍재', username: '강홍재', role: 'team_leader', department: '목양위원회/목양팀' },
  { id: '20', userid: '청연류지성', username: '류지성', role: 'team_leader', department: '목양위원회/마중물팀' },
  { id: '21', userid: '청연임대웅', username: '임대웅', role: 'team_leader', department: '목양위원회/양육지원' },

  // 기획위원회 팀장
  { id: '22', userid: '청연서주형', username: '서주형', role: 'team_leader', department: '기획위원회/홍보팀' },
  { id: '23', userid: '청연양찬승', username: '양찬승', role: 'team_leader', department: '기획위원회/공간사역팀' },
  { id: '24', userid: '청연이문희', username: '이문희', role: 'team_leader', department: '기획위원회/시설관리팀' },
  { id: '25', userid: '청연임한결', username: '임한결', role: 'team_leader', department: '기획위원회/이웃사랑팀' },
] as const;

export type User = (typeof USERS)[number];

export function findUserById(id: string): UserInfo | undefined {
  return USERS.find((u) => u.id === id);
}

export function findUserByUserid(userid: string): UserInfo | undefined {
  return USERS.find((u) => u.userid === userid);
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
