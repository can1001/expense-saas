import { prisma } from '../prisma';
import { User, UserRole } from '@prisma/client';

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

// ========================================
// 사용자 조회 함수들
// ========================================

/**
 * ID로 사용자 조회
 */
export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

/**
 * 로그인 ID(userid)로 사용자 조회
 */
export async function findUserByUserid(userid: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { userid },
  });
}

/**
 * 이름(username)으로 사용자 조회
 * 동명이인이 있을 수 있으므로 첫 번째 결과만 반환
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { username, isActive: true },
  });
}

/**
 * 역할로 사용자 목록 조회
 */
export async function findUsersByRole(role: UserRole): Promise<User[]> {
  return prisma.user.findMany({
    where: { role, isActive: true },
    orderBy: { username: 'asc' },
  });
}

/**
 * 모든 활성 사용자 조회
 */
export async function findAllActiveUsers(): Promise<User[]> {
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
  });
}

/**
 * 부서로 사용자 조회
 */
export async function findUsersByDepartment(department: string): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      department: { contains: department },
      isActive: true,
    },
    orderBy: { username: 'asc' },
  });
}

// ========================================
// 결재 관련 함수들
// ========================================

/**
 * 결재 가능 여부 확인
 */
export function canApprove(user: User, stepNumber: number): boolean {
  const userStep = ROLE_STEP_MAP[user.role];
  return userStep === stepNumber;
}

/**
 * 역할 표시명 가져오기
 */
export function getRoleDisplayName(role: UserRole): string {
  return ROLE_NAMES[role];
}

/**
 * 결재 단계 가져오기
 */
export function getApprovalStep(role: UserRole): number | null {
  return ROLE_STEP_MAP[role];
}

// ========================================
// 사용자 관리 함수들 (CRUD)
// ========================================

/**
 * 사용자 생성
 */
export async function createUser(data: {
  userid: string;
  username: string;
  role?: UserRole;
  department?: string;
  password?: string;
}): Promise<User> {
  return prisma.user.create({
    data: {
      userid: data.userid,
      username: data.username,
      role: data.role ?? 'user',
      department: data.department,
      password: data.password,
    },
  });
}

/**
 * 사용자 정보 업데이트
 */
export async function updateUser(
  id: string,
  data: {
    username?: string;
    role?: UserRole;
    department?: string;
    password?: string;
    isActive?: boolean;
  }
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data,
  });
}

/**
 * 사용자 비활성화 (soft delete)
 */
export async function deactivateUser(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * 사용자 활성화
 */
export async function activateUser(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { isActive: true },
  });
}

/**
 * 사용자 목록 조회 (페이지네이션)
 */
export async function findUsers(options?: {
  page?: number;
  pageSize?: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}): Promise<{ users: User[]; total: number }> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (options?.role) {
    where.role = options.role;
  }

  if (options?.isActive !== undefined) {
    where.isActive = options.isActive;
  }

  if (options?.search) {
    where.OR = [
      { userid: { contains: options.search, mode: 'insensitive' } },
      { username: { contains: options.search, mode: 'insensitive' } },
      { department: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}
