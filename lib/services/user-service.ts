import { prisma } from '../prisma';
import { User, UserRole, UserYearRole } from '@prisma/client';

// 현재 연도
export const CURRENT_YEAR = new Date().getFullYear();

// 사용자와 연도별 역할 정보를 포함한 타입
export interface UserWithYearRole extends User {
  yearRoles?: UserYearRole[];
  effectiveRole?: UserRole;      // 현재 연도 기준 유효 역할
  effectiveDepartment?: string | null;  // 현재 연도 기준 부서
}

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

// ========================================
// 연도별 역할 관리 함수들
// ========================================

/**
 * 사용자의 유효 역할 가져오기 (연도 기준)
 * - User.role이 admin이면 admin 반환
 * - 아니면 해당 연도의 UserYearRole에서 역할 조회
 * - 없으면 user 반환
 */
export async function getEffectiveRole(
  userId: string,
  year: number = CURRENT_YEAR
): Promise<{ role: UserRole; department: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      yearRoles: {
        where: { year },
      },
    },
  });

  if (!user) {
    return { role: 'user', department: null };
  }

  // admin은 영구 역할
  if (user.role === 'admin') {
    return { role: 'admin', department: user.department };
  }

  // 연도별 역할이 있으면 해당 역할 반환
  const yearRole = user.yearRoles?.[0];
  if (yearRole) {
    return { role: yearRole.role, department: yearRole.department };
  }

  // 기본값: user
  return { role: 'user', department: user.department };
}

/**
 * 사용자를 유효 역할 정보와 함께 조회
 */
export async function findUserWithEffectiveRole(
  userId: string,
  year: number = CURRENT_YEAR
): Promise<UserWithYearRole | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      yearRoles: {
        where: { year },
      },
    },
  });

  if (!user) return null;

  const yearRole = user.yearRoles?.[0];
  return {
    ...user,
    effectiveRole: user.role === 'admin' ? 'admin' : (yearRole?.role ?? 'user'),
    effectiveDepartment: user.role === 'admin' ? user.department : (yearRole?.department ?? user.department),
  };
}

/**
 * 연도별 역할로 사용자 목록 조회
 */
export async function findUsersByYearRole(
  role: UserRole,
  year: number = CURRENT_YEAR
): Promise<UserWithYearRole[]> {
  // admin 역할은 User.role에서 조회
  if (role === 'admin') {
    const users = await prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      orderBy: { username: 'asc' },
    });
    return users.map(u => ({ ...u, effectiveRole: 'admin' as UserRole }));
  }

  // 나머지 역할은 UserYearRole에서 조회
  const yearRoles = await prisma.userYearRole.findMany({
    where: { role, year },
    include: {
      user: true,
    },
    orderBy: { user: { username: 'asc' } },
  });

  return yearRoles
    .filter(yr => yr.user.isActive)
    .map(yr => ({
      ...yr.user,
      yearRoles: [yr],
      effectiveRole: yr.role,
      effectiveDepartment: yr.department,
    }));
}

/**
 * 모든 활성 사용자를 유효 역할과 함께 조회
 */
export async function findAllUsersWithEffectiveRole(
  year: number = CURRENT_YEAR
): Promise<UserWithYearRole[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      yearRoles: {
        where: { year },
      },
    },
    orderBy: { username: 'asc' },
  });

  return users.map(user => {
    const yearRole = user.yearRoles?.[0];
    return {
      ...user,
      effectiveRole: user.role === 'admin' ? 'admin' : (yearRole?.role ?? 'user'),
      effectiveDepartment: user.role === 'admin' ? user.department : (yearRole?.department ?? user.department),
    };
  });
}

/**
 * 연도별 역할 설정
 */
export async function setYearRole(
  userId: string,
  year: number,
  role: UserRole,
  department?: string
): Promise<UserYearRole> {
  return prisma.userYearRole.upsert({
    where: {
      userId_year: { userId, year },
    },
    update: { role, department },
    create: { userId, year, role, department },
  });
}

/**
 * 연도별 역할 삭제
 */
export async function deleteYearRole(userId: string, year: number): Promise<void> {
  await prisma.userYearRole.deleteMany({
    where: { userId, year },
  });
}

/**
 * 특정 연도의 모든 역할 조회
 */
export async function getYearRoles(year: number = CURRENT_YEAR): Promise<UserYearRole[]> {
  return prisma.userYearRole.findMany({
    where: { year },
    include: { user: true },
    orderBy: [{ role: 'asc' }, { user: { username: 'asc' } }],
  });
}

/**
 * 결재 가능 여부 확인 (연도별 역할 기준)
 */
export async function canApproveByYear(
  userId: string,
  stepNumber: number,
  year: number = CURRENT_YEAR
): Promise<boolean> {
  const { role } = await getEffectiveRole(userId, year);
  const userStep = ROLE_STEP_MAP[role];
  return userStep === stepNumber;
}
