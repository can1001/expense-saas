/**
 * 사용자 관리 모듈
 *
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 * 새로운 코드에서는 lib/services/user-service.ts를 사용하세요.
 */

import { User, UserRole } from '@prisma/client';

// 타입 re-export
export type { UserRole };

// 역할별 결재 단계 매핑
export const ROLE_STEP_MAP: Record<UserRole, number | null> = {
  admin: null,            // 시스템 관리자 (결재 없음, 모든 권한)
  team_leader: 1,         // 1차 결재
  accountant: 2,          // 2차 결재
  finance_head: 3,        // 3차 결재
  admin_assistant: null,  // 행정간사 (결재 없음, 지출관리/엑셀 권한)
  user: null,             // 결재 권한 없음
};

// 역할 한글명
export const ROLE_NAMES: Record<UserRole, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  team_leader: '팀장',
  admin_assistant: '행정간사',
  user: '사용자',
};

// 사용자 정보 인터페이스 (하위 호환성)
export interface UserInfo {
  id: string;
  userid: string;       // 로그인 아이디 (예: 청연정혜종)
  username: string;     // 표시 이름 (예: 정혜종)
  role: UserRole;
  department?: string | null;  // 소속 부서 (팀장인 경우)
}

// User를 UserInfo로 변환
export function toUserInfo(user: User): UserInfo {
  return {
    id: user.id,
    userid: user.userid,
    username: user.username,
    role: user.role,
    department: user.department,
  };
}

// ========================================
// 서비스 레이어 함수 re-export (비동기)
// ========================================

// 비동기 조회 함수들 re-export
export {
  findUserById,
  findUserByUserid,
  findUserByUsername,
  findUsersByRole,
  findAllActiveUsers,
  findUsersByDepartment,
  canApprove,
  getRoleDisplayName,
  getApprovalStep,
} from './services/user-service';

// ========================================
// 하위 호환성을 위한 DEPRECATED 코드
// ========================================

/**
 * @deprecated DB로 마이그레이션되었습니다.
 * API (/api/users)를 통해 사용자 목록을 가져오세요.
 *
 * 클라이언트 컴포넌트에서는:
 * ```typescript
 * const response = await fetch('/api/users');
 * const { users } = await response.json();
 * ```
 */
export const USERS: readonly UserInfo[] = [];

// 하위 호환용 타입
export type OldUser = UserInfo;
