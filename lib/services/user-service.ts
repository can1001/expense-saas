import { prisma, prismaBase } from '../prisma';
import { User, UserYearRole, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getTenantIdOptional } from '../tenant-context';
import { roleCodeToMembershipRole } from './membership';

// 역할 코드 타입 (Role.code와 동일)
export type UserRole = 'admin' | 'finance_head' | 'accountant' | 'finance_member' | 'team_leader' | 'admin_assistant' | 'user';

// 현재 연도
export const CURRENT_YEAR = new Date().getFullYear();

// 사용자와 연도별 역할 정보를 포함한 타입
export interface UserWithYearRole extends User {
  yearRoles?: UserYearRole[];
  effectiveRole?: string;        // 현재 연도 기준 유효 역할
  effectiveDepartmentId?: string | null;  // 현재 연도 기준 부서 ID
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
  finance_member: '재정팀원',
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
  return prisma.user.findFirst({
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
  /** 배정된 비밀번호로 생성 시 true — 첫 로그인에 변경 강제 */
  mustChangePassword?: boolean;
}): Promise<User> {
  const plainPassword = data.password || DEFAULT_PASSWORD;
  const hashedPassword = await hashPassword(plainPassword);

  // roleId가 없으면 role enum에서 찾아서 설정
  let roleId = data.roleId;
  if (!roleId && data.role) {
    const roleRef = await getRoleByCode(data.role);
    roleId = roleRef?.id;
  }

  const role = data.role ?? 'user';
  const userData = {
    userid: data.userid,
    username: data.username,
    role,
    roleId,
    department: data.department,
    phoneNumber: data.phoneNumber,
    password: hashedPassword,
    mustChangePassword: data.mustChangePassword ?? false,
  };

  // 테넌트 컨텍스트가 있으면 User + Membership을 한 트랜잭션으로 이중 기록한다 (ARC-002 §2.2).
  // Membership이 없으면 /api/me/memberships·switch-tenant에서 사용자가 누락되므로,
  // 백필(M2)에 의존하지 않고 생성 시점에 소속을 함께 기록한다.
  // 컨텍스트가 없는 경로(공개 회원가입·플랫폼/시드)는 tenantId가 없어 기존처럼 User만 생성한다.
  const tenantId = getTenantIdOptional();
  if (!tenantId) {
    return prisma.user.create({ data: userData });
  }

  return prismaBase.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { ...userData, tenantId } });
    await tx.membership.create({
      data: {
        userId: user.id,
        tenantId,
        role: roleCodeToMembershipRole(role),
        isDefault: true, // 신규 사용자의 첫(유일) 소속이므로 기본 진입 조직
      },
    });
    return user;
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
    canRegisterUsers?: boolean;
    mustChangePassword?: boolean;
  }
): Promise<User> {
  const updateData = { ...data };

  // 비밀번호가 있으면 해시화
  if (updateData.password) {
    updateData.password = await hashPassword(updateData.password);
  }

  // role이 변경되면 roleId도 업데이트
  if (updateData.role && !updateData.roleId) {
    const roleRef = await getRoleByCode(updateData.role);
    if (roleRef) {
      (updateData as { roleId?: string }).roleId = roleRef.id;
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
  includeYearRoles?: boolean;
  year?: number;
}): Promise<{ users: (User & { roleRef?: Role | null; yearRoles?: UserYearRole[] })[]; total: number }> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;
  const year = options?.year ?? CURRENT_YEAR;

  const where: Record<string, unknown> = {};

  // 역할 필터링: admin은 User.role, 나머지는 UserYearRole에서 조회
  if (options?.role) {
    if (options.role === 'admin') {
      where.role = 'admin';
    } else {
      // UserYearRole에서 해당 역할을 가진 사용자 ID 조회
      const yearRoleUsers = await prisma.userYearRole.findMany({
        where: { role: options.role, year },
        select: { userId: true },
      });
      where.id = { in: (yearRoleUsers ?? []).map(yr => yr.userId) };
    }
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

  // include 옵션 구성
  const include: Record<string, unknown> = {};
  if (options?.includeRoleRef) {
    include.roleRef = true;
  }
  if (options?.includeYearRoles) {
    include.yearRoles = {
      where: { year },
      orderBy: { role: 'asc' },
    };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
      include: Object.keys(include).length > 0 ? include : undefined,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

// ========================================
// 연도별 역할 관리 함수들
// ========================================

// 역할 우선순위 (낮을수록 높은 우선순위)
// 다중 역할인 경우 가장 높은 우선순위의 역할을 반환
const ROLE_PRIORITY: Record<string, number> = {
  'finance_head': 0,
  'accountant': 1,
  'finance_member': 2,
  'admin_assistant': 3,
  'team_leader': 4,
  'user': 99,
};

/**
 * 사용자의 유효 역할 가져오기 (연도 기준)
 * - User.role이 admin이면 admin 반환
 * - 아니면 해당 연도의 UserYearRole에서 역할 조회 (우선순위 적용)
 * - 없으면 user 반환
 */
export async function getEffectiveRole(
  userId: string,
  year: number = CURRENT_YEAR
): Promise<{ role: string; departmentId: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      yearRoles: {
        where: { year },
      },
    },
  });

  if (!user) {
    return { role: 'user', departmentId: null };
  }

  // admin은 영구 역할
  if (user.role === 'admin') {
    return { role: 'admin', departmentId: null };
  }

  // 연도별 역할이 있으면 우선순위에 따라 정렬하여 가장 높은 역할 반환
  if (user.yearRoles && user.yearRoles.length > 0) {
    const sortedYearRoles = [...user.yearRoles].sort((a, b) => {
      const aPriority = ROLE_PRIORITY[a.role] ?? 99;
      const bPriority = ROLE_PRIORITY[b.role] ?? 99;
      return aPriority - bPriority;
    });
    const yearRole = sortedYearRoles[0];
    return { role: yearRole.role, departmentId: yearRole.departmentId };
  }

  // UserYearRole이 없으면 User.role을 fallback으로 사용
  return { role: user.role, departmentId: null };
}

/**
 * 사용자의 모든 연도별 역할 조회 (다중 역할 지원)
 * - 관리 메뉴 접근 권한 등 여러 역할 기반 권한 체크에 사용
 */
export async function getUserAllYearRoles(
  userId: string,
  year: number = CURRENT_YEAR
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      yearRoles: {
        where: { year },
        select: { role: true },
      },
    },
  });

  if (!user) {
    return ['user'];
  }

  // admin은 영구 역할
  if (user.role === 'admin') {
    return ['admin'];
  }

  // 연도별 역할이 있으면 모든 역할 반환
  if (user.yearRoles && user.yearRoles.length > 0) {
    return user.yearRoles.map(yr => yr.role);
  }

  // UserYearRole이 없으면 User.role을 fallback으로 사용
  return [user.role];
}

/**
 * 사용자가 특정 역할을 가지고 있는지 확인 (다중 역할 지원)
 */
export async function userHasRole(
  userId: string,
  targetRole: string,
  year: number = CURRENT_YEAR
): Promise<boolean> {
  const roles = await getUserAllYearRoles(userId, year);
  return roles.includes(targetRole);
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
    effectiveDepartmentId: user.role === 'admin' ? null : (yearRole?.departmentId ?? null),
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
      effectiveDepartmentId: yr.departmentId,
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
      effectiveDepartmentId: user.role === 'admin' ? null : (yearRole?.departmentId ?? null),
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
  departmentId?: string,
  roleId?: string
): Promise<UserYearRole> {
  // roleId가 없으면 role enum에서 찾아서 설정
  let resolvedRoleId = roleId;
  if (!resolvedRoleId) {
    const roleRef = await getRoleByCode(role);
    resolvedRoleId = roleRef?.id;
  }

  // departmentId가 없으면 upsert 대신 findFirst + create/update 사용
  if (!departmentId) {
    // departmentId 없이 해당 사용자+연도의 역할 찾기
    const existing = await prisma.userYearRole.findFirst({
      where: { userId, year, departmentId: null },
    });

    if (existing) {
      return prisma.userYearRole.update({
        where: { id: existing.id },
        data: { role, roleId: resolvedRoleId },
      });
    } else {
      return prisma.userYearRole.create({
        data: { userId, year, role, roleId: resolvedRoleId, departmentId: null },
      });
    }
  }

  // departmentId와 role이 있는 경우 upsert 사용
  return prisma.userYearRole.upsert({
    where: {
      userId_year_departmentId_role: { userId, year, departmentId, role },
    },
    update: { roleId: resolvedRoleId },
    create: { userId, year, role, roleId: resolvedRoleId, departmentId },
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
    include: { user: true, department: true },
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

/**
 * 사용자 등록 권한 확인
 * - User의 canRegisterUsers 플래그 확인
 * - User의 Role의 canRegisterUsers 플래그 확인
 * - 둘 중 하나라도 true면 권한 있음
 */
export async function checkCanRegisterUsers(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleRef: true },
  });

  if (!user) return false;

  // 사용자에게 직접 부여된 권한 확인 (개별 플래그)
  if (user.canRegisterUsers) return true;

  // 역할 permission 확인: roleRef.permissions[] 우선, 없으면 코드 프리셋(admin 등)
  const { PERMISSIONS, roleHasPermission } = await import('@/lib/auth/permissions');
  const rolePerms = user.roleRef?.permissions ?? [];
  if (rolePerms.length > 0) {
    if (rolePerms.includes(PERMISSIONS.USER_REGISTER)) return true;
  } else if (roleHasPermission(user.role, PERMISSIONS.USER_REGISTER)) {
    return true;
  }

  return false;
}
