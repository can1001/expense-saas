import { prisma } from '../prisma';
import { User, UserYearRole, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

// 역할 코드 타입 (Role.code와 동일)
export type UserRole = 'admin' | 'finance_head' | 'accountant' | 'team_leader' | 'admin_assistant' | 'user';

// 현재 연도
export const CURRENT_YEAR = new Date().getFullYear();

// 사용자와 연도별 역할 정보를 포함한 타입
export interface UserWithYearRole extends User {
  yearRoles?: UserYearRole[];
  effectiveRole?: string;        // 현재 연도 기준 유효 역할
  effectiveDepartment?: string | null;  // 현재 연도 기준 부서
  roleRef?: Role | null;         // Role 테이블 참조 정보
}

// 역할별 결재 단계 매핑 (레거시 - Role 테이블의 stepNumber로 대체 예정)
export const ROLE_STEP_MAP: Record<string, number | null> = {
  admin: null,            // 시스템 관리자 (결재 없음, 모든 권한)
  team_leader: 1,         // 1차 결재
  accountant: 2,          // 2차 결재
  finance_head: 3,        // 3차 결재
  admin_assistant: null,  // 행정간사 (결재 없음, 지출관리/엑셀 권한)
  user: null,             // 결재 권한 없음
};

// 역할 한글명 (레거시 - Role 테이블의 name으로 대체 예정)
export const ROLE_NAMES: Record<string, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  team_leader: '팀장',
  admin_assistant: '행정간사',
  user: '사용자',
};

// ========================================
// Role 테이블 기반 함수들
// ========================================

// Role 캐시 (성능 최적화)
let roleCache: Role[] | null = null;
let roleCacheTime: number = 0;
const ROLE_CACHE_TTL = 60000; // 1분

/**
 * 모든 역할 조회 (캐시 사용)
 */
export async function getAllRoles(forceRefresh = false): Promise<Role[]> {
  const now = Date.now();
  if (!forceRefresh && roleCache && now - roleCacheTime < ROLE_CACHE_TTL) {
    return roleCache;
  }

  roleCache = await prisma.role.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  roleCacheTime = now;
  return roleCache;
}

/**
 * 역할 코드로 Role 조회
 */
export async function getRoleByCode(code: string): Promise<Role | null> {
  const roles = await getAllRoles();
  return roles.find(r => r.code === code) ?? null;
}

/**
 * 역할 ID로 Role 조회
 */
export async function getRoleById(id: string): Promise<Role | null> {
  const roles = await getAllRoles();
  return roles.find(r => r.id === id) ?? null;
}

/**
 * 결재 단계로 Role 조회
 */
export async function getRoleByStep(stepNumber: number): Promise<Role | null> {
  const roles = await getAllRoles();
  return roles.find(r => r.stepNumber === stepNumber) ?? null;
}

/**
 * Role 테이블에서 역할명 가져오기
 */
export async function getRoleNameFromTable(roleCode: string): Promise<string> {
  const role = await getRoleByCode(roleCode);
  return role?.name ?? roleCode;
}

/**
 * Role 테이블에서 결재 단계 가져오기
 */
export async function getApprovalStepFromTable(roleCode: string): Promise<number | null> {
  const role = await getRoleByCode(roleCode);
  return role?.stepNumber ?? null;
}

// ========================================
// 사용자 조회 함수들
// ========================================

/**
 * ID로 사용자 조회
 */
export async function findUserById(
  id: string,
  includeRoleRef = false
): Promise<(User & { roleRef?: Role | null }) | null> {
  return prisma.user.findUnique({
    where: { id },
    include: includeRoleRef ? { roleRef: true } : undefined,
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
export async function findUsersByRole(role: string): Promise<User[]> {
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
export function getRoleDisplayName(role: string): string {
  return ROLE_NAMES[role] ?? role;
}

/**
 * 결재 단계 가져오기
 */
export function getApprovalStep(role: string): number | null {
  return ROLE_STEP_MAP[role] ?? null;
}

// ========================================
// 사용자 관리 함수들 (CRUD)
// ========================================

// 기본 비밀번호
export const DEFAULT_PASSWORD = 'chc2026';

// bcrypt salt rounds
const SALT_ROUNDS = 10;

/**
 * 비밀번호 해시화
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * 사용자 생성
 */
export async function createUser(data: {
  userid: string;
  username: string;
  role?: string;
  roleId?: string;
  department?: string;
  password?: string;
  phoneNumber?: string;
}): Promise<User> {
  const plainPassword = data.password || DEFAULT_PASSWORD;
  const hashedPassword = await hashPassword(plainPassword);

  // roleId가 없으면 role enum에서 찾아서 설정
  let roleId = data.roleId;
  if (!roleId && data.role) {
    const roleRef = await getRoleByCode(data.role);
    roleId = roleRef?.id;
  }

  return prisma.user.create({
    data: {
      userid: data.userid,
      username: data.username,
      role: data.role ?? 'user',
      roleId,
      department: data.department,
      phoneNumber: data.phoneNumber,
      password: hashedPassword,
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
    role?: string;
    roleId?: string;
    department?: string;
    password?: string;
    phoneNumber?: string | null;
    isActive?: boolean;
  }
): Promise<User> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { ...data };

  // 비밀번호가 있으면 해시화
  if (updateData.password) {
    updateData.password = await hashPassword(updateData.password);
  }

  // role이 변경되면 roleId도 업데이트
  if (updateData.role && !updateData.roleId) {
    const roleRef = await getRoleByCode(updateData.role);
    if (roleRef) {
      updateData.roleId = roleRef.id;
    }
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
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
  role?: string;
  isActive?: boolean;
  search?: string;
  includeRoleRef?: boolean;
}): Promise<{ users: (User & { roleRef?: Role | null })[]; total: number }> {
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
      include: options?.includeRoleRef ? { roleRef: true } : undefined,
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
): Promise<{ role: string; department: string | null }> {
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
  role: string,
  year: number = CURRENT_YEAR
): Promise<UserWithYearRole[]> {
  // admin 역할은 User.role에서 조회
  if (role === 'admin') {
    const users = await prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      orderBy: { username: 'asc' },
    });
    return users.map(u => ({ ...u, effectiveRole: 'admin' }));
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
  role: string,
  department?: string,
  roleId?: string
): Promise<UserYearRole> {
  // roleId가 없으면 role enum에서 찾아서 설정
  let resolvedRoleId = roleId;
  if (!resolvedRoleId) {
    const roleRef = await getRoleByCode(role);
    resolvedRoleId = roleRef?.id;
  }

  return prisma.userYearRole.upsert({
    where: {
      userId_year: { userId, year },
    },
    update: { role, roleId: resolvedRoleId, department },
    create: { userId, year, role, roleId: resolvedRoleId, department },
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
