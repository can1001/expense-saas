/**
 * 사용자 서비스 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../prisma';
import type { User, UserYearRole } from '@prisma/client';
import type { UserRole } from '../user-service';

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockImplementation((password: string) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn().mockImplementation((password: string, hash: string) =>
      Promise.resolve(hash === `hashed_${password}`)
    ),
  },
}));
import {
  CURRENT_YEAR,
  ROLE_STEP_MAP,
  ROLE_NAMES,
  getAllRoles,
  getRoleByCode,
  getRoleById,
  getRoleByStep,
  getRoleNameFromTable,
  getApprovalStepFromTable,
  findUserById,
  findUserByUserid,
  findUserByUsername,
  findUsersByRole,
  findAllActiveUsers,
  findUsersByDepartment,
  canApprove,
  getRoleDisplayName,
  getApprovalStep,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  findUsers,
  getEffectiveRole,
  findUserWithEffectiveRole,
  findUsersByYearRole,
  findAllUsersWithEffectiveRole,
  setYearRole,
  deleteYearRole,
  getYearRoles,
  canApproveByYear,
} from '../user-service';

// Mock Prisma
vi.mock('../../prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    userYearRole: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
    },
  },
}));

describe('user-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear role cache by forcing a new import
    vi.resetModules();
  });

  const mockUser: User = {
    id: 'user-1',
    userid: 'testuser',
    username: '홍길동',
    role: 'user',
    department: '재정팀',
    password: null,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockAdmin: User = {
    id: 'admin-1',
    userid: 'admin',
    username: '관리자',
    role: 'admin',
    department: null,
    password: null,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockTeamLeader: User = {
    id: 'leader-1',
    userid: 'leader',
    username: '김팀장',
    role: 'team_leader',
    department: '기획팀',
    password: null,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  // Mock roles data
  const mockRoles = [
    { id: 'role-1', code: 'admin', name: '관리자', stepNumber: null, sortOrder: 0, isActive: true },
    { id: 'role-2', code: 'finance_head', name: '재정팀장', stepNumber: 3, sortOrder: 1, isActive: true },
    { id: 'role-3', code: 'accountant', name: '회계', stepNumber: 2, sortOrder: 2, isActive: true },
    { id: 'role-4', code: 'team_leader', name: '팀장', stepNumber: 1, sortOrder: 3, isActive: true },
    { id: 'role-5', code: 'admin_assistant', name: '행정간사', stepNumber: null, sortOrder: 4, isActive: true },
    { id: 'role-6', code: 'user', name: '사용자', stepNumber: null, sortOrder: 5, isActive: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock for role.findMany
    vi.mocked(prisma.role.findMany).mockResolvedValue(mockRoles);
  });

  describe('Constants', () => {
    it('CURRENT_YEAR is defined and is current year', () => {
      const currentYear = new Date().getFullYear();
      expect(CURRENT_YEAR).toBe(currentYear);
    });

    it('ROLE_STEP_MAP contains all roles', () => {
      expect(ROLE_STEP_MAP.admin).toBeNull();
      expect(ROLE_STEP_MAP.team_leader).toBe(1);
      expect(ROLE_STEP_MAP.accountant).toBe(2);
      expect(ROLE_STEP_MAP.finance_head).toBe(3);
      expect(ROLE_STEP_MAP.admin_assistant).toBeNull();
      expect(ROLE_STEP_MAP.user).toBeNull();
    });

    it('ROLE_NAMES contains Korean names for all roles', () => {
      expect(ROLE_NAMES.admin).toBe('관리자');
      expect(ROLE_NAMES.finance_head).toBe('재정팀장');
      expect(ROLE_NAMES.accountant).toBe('회계');
      expect(ROLE_NAMES.finance_member).toBe('재정팀원');
      expect(ROLE_NAMES.team_leader).toBe('팀장');
      expect(ROLE_NAMES.admin_assistant).toBe('행정간사');
      expect(ROLE_NAMES.user).toBe('사용자');
    });
  });

  describe('getAllRoles', () => {
    it('returns all roles from database', async () => {
      const mockRoles = [
        { id: 'role-1', code: 'admin', name: '관리자', stepNumber: null },
        { id: 'role-2', code: 'finance_head', name: '재정팀장', stepNumber: 3 },
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce(mockRoles as any);

      const result = await getAllRoles(true); // Force refresh to bypass cache

      expect(result).toEqual(mockRoles);
      expect(prisma.role.findMany).toHaveBeenCalled();
    });
  });

  describe('getRoleByCode', () => {
    it('returns role when found', async () => {
      const mockRoles = [
        { id: 'role-1', code: 'admin', name: '관리자', stepNumber: null },
        { id: 'role-2', code: 'finance_head', name: '재정팀장', stepNumber: 3 },
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce(mockRoles as any);

      await getAllRoles(true); // Force refresh first
      const result = await getRoleByCode('admin');

      expect(result).toEqual(mockRoles[0]);
    });

    it('returns null when role not found', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce([]);

      await getAllRoles(true); // Force refresh first
      const result = await getRoleByCode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getRoleById', () => {
    it('returns role when found', async () => {
      const mockRoles = [
        { id: 'role-1', code: 'admin', name: '관리자', stepNumber: null },
        { id: 'role-2', code: 'finance_head', name: '재정팀장', stepNumber: 3 },
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce(mockRoles as any);

      await getAllRoles(true); // Force refresh first
      const result = await getRoleById('role-1');

      expect(result).toEqual(mockRoles[0]);
    });

    it('returns null when role not found', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce([]);

      await getAllRoles(true); // Force refresh first
      const result = await getRoleById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getRoleByStep', () => {
    it('returns role when found', async () => {
      const mockRoles = [
        { id: 'role-1', code: 'admin', name: '관리자', stepNumber: null },
        { id: 'role-2', code: 'finance_head', name: '재정팀장', stepNumber: 3 },
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce(mockRoles as any);

      await getAllRoles(true); // Force refresh first
      const result = await getRoleByStep(3);

      expect(result).toEqual(mockRoles[1]);
    });

    it('returns null when role not found', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce([]);

      await getAllRoles(true); // Force refresh first
      const result = await getRoleByStep(99);

      expect(result).toBeNull();
    });
  });

  describe('getRoleNameFromTable', () => {
    it('returns role name when found', async () => {
      const mockRoles = [
        { id: 'role-1', code: 'admin', name: '관리자', stepNumber: null },
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce(mockRoles as any);

      await getAllRoles(true); // Force refresh first
      const result = await getRoleNameFromTable('admin');

      expect(result).toBe('관리자');
    });

    it('returns role code when role not found', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce([]);

      await getAllRoles(true); // Force refresh first
      const result = await getRoleNameFromTable('unknown');

      expect(result).toBe('unknown');
    });
  });

  describe('getApprovalStepFromTable', () => {
    it('returns step number when found', async () => {
      const mockRoles = [
        { id: 'role-2', code: 'finance_head', name: '재정팀장', stepNumber: 3 },
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce(mockRoles as any);

      await getAllRoles(true); // Force refresh first
      const result = await getApprovalStepFromTable('finance_head');

      expect(result).toBe(3);
    });

    it('returns null when role not found', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce([]);

      await getAllRoles(true); // Force refresh first
      const result = await getApprovalStepFromTable('unknown');

      expect(result).toBeNull();
    });

    it('returns null when role has no step number', async () => {
      const mockRoles = [
        { id: 'role-1', code: 'admin', name: '관리자', stepNumber: null },
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValueOnce(mockRoles as any);

      await getAllRoles(true); // Force refresh first
      const result = await getApprovalStepFromTable('admin');

      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('returns user when found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await findUserById('user-1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('returns null when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await findUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findUserByUserid', () => {
    it('returns user when found', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser);

      const result = await findUserByUserid('testuser');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { userid: 'testuser' },
      });
    });

    it('returns null when user not found', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await findUserByUserid('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findUserByUsername', () => {
    it('returns first active user with matching username', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser);

      const result = await findUserByUsername('홍길동');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { username: '홍길동', isActive: true },
      });
    });

    it('returns null when no active user found', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await findUserByUsername('없는사람');

      expect(result).toBeNull();
    });
  });

  describe('findUsersByRole', () => {
    it('returns list of users with specified role', async () => {
      const mockUsers = [mockTeamLeader];
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

      const result = await findUsersByRole('team_leader');

      expect(result).toEqual(mockUsers);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'team_leader', isActive: true },
        orderBy: { username: 'asc' },
      });
    });

    it('returns empty array when no users found', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await findUsersByRole('admin');

      expect(result).toEqual([]);
    });
  });

  describe('findAllActiveUsers', () => {
    it('returns all active users', async () => {
      const mockUsers = [mockAdmin, mockTeamLeader, mockUser];
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

      const result = await findAllActiveUsers();

      expect(result).toEqual(mockUsers);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ role: 'asc' }, { username: 'asc' }],
      });
    });
  });

  describe('findUsersByDepartment', () => {
    it('returns users in specified department', async () => {
      const mockUsers = [mockUser];
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

      const result = await findUsersByDepartment('재정팀');

      expect(result).toEqual(mockUsers);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          department: { contains: '재정팀' },
          isActive: true,
        },
        orderBy: { username: 'asc' },
      });
    });
  });

  describe('canApprove', () => {
    it('returns true when user can approve step', () => {
      expect(canApprove(mockTeamLeader, 1)).toBe(true);
    });

    it('returns false when user cannot approve step', () => {
      expect(canApprove(mockUser, 1)).toBe(false);
    });

    it('returns false for admin role', () => {
      expect(canApprove(mockAdmin, 1)).toBe(false);
    });

    it('handles accountant role (step 2)', () => {
      const accountant: User = { ...mockUser, role: 'accountant' };
      expect(canApprove(accountant, 2)).toBe(true);
      expect(canApprove(accountant, 1)).toBe(false);
    });

    it('handles finance_head role (step 3)', () => {
      const financeHead: User = { ...mockUser, role: 'finance_head' };
      expect(canApprove(financeHead, 3)).toBe(true);
      expect(canApprove(financeHead, 1)).toBe(false);
    });
  });

  describe('getRoleDisplayName', () => {
    it('returns correct Korean name for each role', () => {
      expect(getRoleDisplayName('admin')).toBe('관리자');
      expect(getRoleDisplayName('finance_head')).toBe('재정팀장');
      expect(getRoleDisplayName('accountant')).toBe('회계');
      expect(getRoleDisplayName('team_leader')).toBe('팀장');
      expect(getRoleDisplayName('admin_assistant')).toBe('행정간사');
      expect(getRoleDisplayName('user')).toBe('사용자');
    });
  });

  describe('getApprovalStep', () => {
    it('returns correct step for each role', () => {
      expect(getApprovalStep('admin')).toBeNull();
      expect(getApprovalStep('team_leader')).toBe(1);
      expect(getApprovalStep('accountant')).toBe(2);
      expect(getApprovalStep('finance_head')).toBe(3);
      expect(getApprovalStep('admin_assistant')).toBeNull();
      expect(getApprovalStep('user')).toBeNull();
    });
  });

  describe('createUser', () => {
    it('creates user with provided data', async () => {
      const userData = {
        userid: 'newuser',
        username: '새사용자',
        role: 'user' as UserRole,
        department: '기획팀',
        password: 'mypassword',
      };

      // Mock role lookup
      vi.mocked(prisma.role.findMany)
        .mockResolvedValueOnce([
          { id: 'role-6', code: 'user', name: '사용자', stepNumber: null },
        ] as any)
        .mockResolvedValueOnce([
          { id: 'role-6', code: 'user', name: '사용자', stepNumber: null },
        ] as any);

      vi.mocked(prisma.user.create).mockResolvedValue({
        ...mockUser,
        ...userData,
        password: 'hashed_mypassword',
      });

      await getAllRoles(true); // Force refresh
      const result = await createUser(userData);

      expect(result.userid).toBe('newuser');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userid: 'newuser',
            username: '새사용자',
            role: 'user',
            department: '기획팀',
            password: 'hashed_mypassword', // bcrypt mock에 의해 해시됨
          }),
        })
      );
    });

    it('creates user with default role when not provided', async () => {
      const userData = {
        userid: 'newuser',
        username: '새사용자',
      };

      vi.mocked(prisma.user.create).mockResolvedValue({
        ...mockUser,
        userid: 'newuser',
        username: '새사용자',
      });

      await createUser(userData);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          userid: 'newuser',
          username: '새사용자',
          role: 'user',
          department: undefined,
          password: 'hashed_chc2026', // 기본 비밀번호(chc2026)가 해시됨
        },
      });
    });
  });

  describe('updateUser', () => {
    it('updates user with provided data', async () => {
      const updateData = {
        username: '변경된이름',
        role: 'team_leader' as UserRole,
      };

      // Mock role lookup
      vi.mocked(prisma.role.findMany)
        .mockResolvedValueOnce([
          { id: 'role-4', code: 'team_leader', name: '팀장', stepNumber: 1 },
        ] as any)
        .mockResolvedValueOnce([
          { id: 'role-4', code: 'team_leader', name: '팀장', stepNumber: 1 },
        ] as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        ...updateData,
      });

      await getAllRoles(true); // Force refresh
      const result = await updateUser('user-1', updateData);

      expect(result.username).toBe('변경된이름');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            username: '변경된이름',
            role: 'team_leader',
          }),
        })
      );
    });

    it('updates password', async () => {
      const updateData = { password: 'newpassword' };

      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        password: 'hashed_newpassword',
      });

      await updateUser('user-1', updateData);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'hashed_newpassword' }, // bcrypt mock에 의해 해시됨
      });
    });
  });

  describe('deactivateUser', () => {
    it('sets isActive to false', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await deactivateUser('user-1');

      expect(result.isActive).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
      });
    });
  });

  describe('activateUser', () => {
    it('sets isActive to true', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...inactiveUser,
        isActive: true,
      });

      const result = await activateUser('user-1');

      expect(result.isActive).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: true },
      });
    });
  });

  describe('findUsers', () => {
    it('returns paginated users with default options', async () => {
      const mockUsers = [mockUser, mockTeamLeader];
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);
      vi.mocked(prisma.user.count).mockResolvedValue(2);

      const result = await findUsers();

      expect(result).toEqual({ users: mockUsers, total: 2 });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: [{ role: 'asc' }, { username: 'asc' }],
      });
    });

    it('filters by role', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockAdmin]);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await findUsers({ role: 'admin' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'admin' },
        })
      );
    });

    it('filters by isActive', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser]);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await findUsers({ isActive: true });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });

    it('searches by userid, username, or department', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser]);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await findUsers({ search: '홍길동' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { userid: { contains: '홍길동', mode: 'insensitive' } },
              { username: { contains: '홍길동', mode: 'insensitive' } },
              { department: { contains: '홍길동', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('handles pagination correctly', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser]);
      vi.mocked(prisma.user.count).mockResolvedValue(100);

      await findUsers({ page: 3, pageSize: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('combines multiple filters', async () => {
      // team_leader는 UserYearRole에서 조회
      vi.mocked(prisma.userYearRole.findMany).mockResolvedValue([
        { userId: 'user-1' } as any,
        { userId: 'user-2' } as any,
      ]);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await findUsers({
        role: 'team_leader',
        isActive: true,
        search: '김',
        page: 2,
        pageSize: 5,
      });

      // UserYearRole에서 team_leader 사용자 조회
      expect(prisma.userYearRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'team_leader', year: CURRENT_YEAR },
        })
      );

      // User.findMany에서는 id로 필터링
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['user-1', 'user-2'] },
            isActive: true,
            OR: expect.any(Array),
          }),
          skip: 5,
          take: 5,
        })
      );
    });

    it('includes yearRoles when includeYearRoles is true', async () => {
      const mockYearRole: UserYearRole = {
        id: 'yr-1',
        userId: 'user-1',
        year: CURRENT_YEAR,
        role: 'team_leader',
        roleId: null,
        departmentId: 'dept-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const userWithYearRoles = { ...mockUser, yearRoles: [mockYearRole] };
      vi.mocked(prisma.user.findMany).mockResolvedValue([userWithYearRoles] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await findUsers({ includeYearRoles: true });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            yearRoles: expect.objectContaining({
              where: { year: CURRENT_YEAR },
              orderBy: { role: 'asc' },
            }),
          }),
        })
      );
    });

    it('does not include yearRoles when includeYearRoles is false', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser]);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await findUsers({ includeYearRoles: false });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: undefined,
        })
      );
    });

    it('filters yearRoles by specific year', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await findUsers({ includeYearRoles: true, year: 2025 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            yearRoles: expect.objectContaining({
              where: { year: 2025 },
            }),
          }),
        })
      );
    });

    it('includes both yearRoles and roleRef when both options are true', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await findUsers({ includeYearRoles: true, includeRoleRef: true });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            yearRoles: expect.any(Object),
            roleRef: true,
          }),
        })
      );
    });
  });

  describe('getEffectiveRole', () => {
    it('returns admin role for admin users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockAdmin,
        yearRoles: [],
      } as any);

      const result = await getEffectiveRole('admin-1');

      expect(result).toEqual({
        role: 'admin',
        departmentId: null,
      });
    });

    it('returns year role when available', async () => {
      const mockYearRole: UserYearRole = {
        id: 'yr-1',
        userId: 'user-1',
        year: CURRENT_YEAR,
        role: 'team_leader',
        roleId: null,
        departmentId: 'dept-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [mockYearRole],
      } as any);

      const result = await getEffectiveRole('user-1');

      expect(result).toEqual({
        role: 'team_leader',
        departmentId: 'dept-1',
      });
    });

    it('returns user role when no year role exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [],
      } as any);

      const result = await getEffectiveRole('user-1');

      expect(result).toEqual({
        role: 'user',
        departmentId: null,
      });
    });

    it('returns user role when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await getEffectiveRole('nonexistent');

      expect(result).toEqual({
        role: 'user',
        departmentId: null,
      });
    });

    it('handles custom year parameter', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [],
      } as any);

      await getEffectiveRole('user-1', 2024);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: {
          yearRoles: {
            where: { year: 2024 },
          },
        },
      });
    });
  });

  describe('findUserWithEffectiveRole', () => {
    it('returns null when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await findUserWithEffectiveRole('nonexistent');

      expect(result).toBeNull();
    });

    it('returns user with effective role for admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockAdmin,
        yearRoles: [],
      } as any);

      const result = await findUserWithEffectiveRole('admin-1');

      expect(result).toMatchObject({
        id: 'admin-1',
        effectiveRole: 'admin',
        effectiveDepartmentId: null,
      });
    });

    it('returns user with year role', async () => {
      const mockYearRole: UserYearRole = {
        id: 'yr-1',
        userId: 'user-1',
        year: CURRENT_YEAR,
        role: 'accountant',
        roleId: null,
        departmentId: 'dept-finance',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [mockYearRole],
      } as any);

      const result = await findUserWithEffectiveRole('user-1');

      expect(result).toMatchObject({
        id: 'user-1',
        effectiveRole: 'accountant',
        effectiveDepartmentId: 'dept-finance',
      });
    });

    it('returns user with default role when no year role', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [],
      } as any);

      const result = await findUserWithEffectiveRole('user-1');

      expect(result).toMatchObject({
        id: 'user-1',
        effectiveRole: 'user',
        effectiveDepartmentId: null,
      });
    });
  });

  describe('findUsersByYearRole', () => {
    it('returns admin users from User table', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockAdmin]);

      const result = await findUsersByYearRole('admin');

      expect(result).toHaveLength(1);
      expect(result[0].effectiveRole).toBe('admin');
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'admin', isActive: true },
        orderBy: { username: 'asc' },
      });
    });

    it('returns users with specific year role', async () => {
      const mockYearRoles = [
        {
          id: 'yr-1',
          userId: 'user-1',
          year: CURRENT_YEAR,
          role: 'team_leader' as UserRole,
          roleId: null,
          departmentId: 'dept-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: mockTeamLeader,
        },
      ];

      vi.mocked(prisma.userYearRole.findMany).mockResolvedValue(mockYearRoles as any);

      const result = await findUsersByYearRole('team_leader');

      expect(result).toHaveLength(1);
      expect(result[0].effectiveRole).toBe('team_leader');
    });

    it('filters out inactive users', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      const mockYearRoles = [
        {
          id: 'yr-1',
          userId: 'user-1',
          year: CURRENT_YEAR,
          role: 'accountant' as UserRole,
          roleId: null,
          departmentId: 'dept-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: inactiveUser,
        },
      ];

      vi.mocked(prisma.userYearRole.findMany).mockResolvedValue(mockYearRoles as any);

      const result = await findUsersByYearRole('accountant');

      expect(result).toHaveLength(0);
    });
  });

  describe('findAllUsersWithEffectiveRole', () => {
    it('returns all active users with effective roles', async () => {
      const mockYearRole: UserYearRole = {
        id: 'yr-1',
        userId: 'user-1',
        year: CURRENT_YEAR,
        role: 'team_leader',
        roleId: null,
        departmentId: 'dept-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { ...mockAdmin, yearRoles: [] },
        { ...mockUser, yearRoles: [mockYearRole] },
      ] as any);

      const result = await findAllUsersWithEffectiveRole();

      expect(result).toHaveLength(2);
      expect(result[0].effectiveRole).toBe('admin');
      expect(result[1].effectiveRole).toBe('team_leader');
    });

    it('handles custom year', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      await findAllUsersWithEffectiveRole(2024);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          yearRoles: {
            where: { year: 2024 },
          },
        },
        orderBy: { username: 'asc' },
      });
    });
  });

  describe('setYearRole', () => {
    it('creates or updates year role', async () => {
      const mockYearRole: UserYearRole = {
        id: 'yr-1',
        userId: 'user-1',
        year: 2025,
        role: 'accountant',
        roleId: 'role-3',
        departmentId: 'dept-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the role lookup - need two calls because getAllRoles will be called twice
      vi.mocked(prisma.role.findMany)
        .mockResolvedValueOnce([
          { id: 'role-3', code: 'accountant', name: '회계', stepNumber: 2 },
        ] as any)
        .mockResolvedValueOnce([
          { id: 'role-3', code: 'accountant', name: '회계', stepNumber: 2 },
        ] as any);

      vi.mocked(prisma.userYearRole.upsert).mockResolvedValue(mockYearRole);

      await getAllRoles(true); // Force refresh to populate cache
      const result = await setYearRole('user-1', 2025, 'accountant', 'dept-1');

      expect(result).toEqual(mockYearRole);
      expect(prisma.userYearRole.upsert).toHaveBeenCalledWith({
        where: {
          userId_year_departmentId_role: { userId: 'user-1', year: 2025, departmentId: 'dept-1', role: 'accountant' },
        },
        update: { roleId: undefined },
        create: { userId: 'user-1', year: 2025, role: 'accountant', roleId: undefined, departmentId: 'dept-1' },
      });
    });

    it('creates year role without department', async () => {
      const mockYearRole: UserYearRole = {
        id: 'yr-1',
        userId: 'user-1',
        year: 2025,
        role: 'user',
        roleId: null,
        departmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the role lookup
      vi.mocked(prisma.role.findMany)
        .mockResolvedValueOnce([
          { id: 'role-6', code: 'user', name: '사용자', stepNumber: null },
        ] as any)
        .mockResolvedValueOnce([
          { id: 'role-6', code: 'user', name: '사용자', stepNumber: null },
        ] as any);

      // Mock findFirst to return null (no existing role)
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValue(null);

      // Mock create to return the new year role
      vi.mocked(prisma.userYearRole.create).mockResolvedValue(mockYearRole);

      await getAllRoles(true); // Force refresh
      await setYearRole('user-1', 2025, 'user');

      // Verify findFirst was called to check for existing role without department
      expect(prisma.userYearRole.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', year: 2025, departmentId: null },
      });

      // Verify create was called since no existing role was found
      expect(prisma.userYearRole.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          year: 2025,
          role: 'user',
          roleId: undefined,
          departmentId: null,
        },
      });
    });
  });

  describe('deleteYearRole', () => {
    it('deletes year role', async () => {
      vi.mocked(prisma.userYearRole.deleteMany).mockResolvedValue({ count: 1 });

      await deleteYearRole('user-1', 2025);

      expect(prisma.userYearRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', year: 2025 },
      });
    });
  });

  describe('getYearRoles', () => {
    it('returns all year roles for specified year', async () => {
      const mockYearRoles = [
        {
          id: 'yr-1',
          userId: 'user-1',
          year: CURRENT_YEAR,
          role: 'team_leader' as UserRole,
          roleId: null,
          departmentId: 'dept-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: mockTeamLeader,
        },
      ];

      vi.mocked(prisma.userYearRole.findMany).mockResolvedValue(mockYearRoles as any);

      const result = await getYearRoles();

      expect(result).toEqual(mockYearRoles);
      expect(prisma.userYearRole.findMany).toHaveBeenCalledWith({
        where: { year: CURRENT_YEAR },
        include: { user: true, department: true },
        orderBy: [{ role: 'asc' }, { user: { username: 'asc' } }],
      });
    });

    it('handles custom year parameter', async () => {
      vi.mocked(prisma.userYearRole.findMany).mockResolvedValue([]);

      await getYearRoles(2024);

      expect(prisma.userYearRole.findMany).toHaveBeenCalledWith({
        where: { year: 2024 },
        include: { user: true, department: true },
        orderBy: [{ role: 'asc' }, { user: { username: 'asc' } }],
      });
    });
  });

  describe('canApproveByYear', () => {
    it('returns true when user can approve step for current year', async () => {
      const mockYearRole: UserYearRole = {
        id: 'yr-1',
        userId: 'user-1',
        year: CURRENT_YEAR,
        role: 'team_leader',
        roleId: null,
        departmentId: 'dept-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [mockYearRole],
      } as any);

      const result = await canApproveByYear('user-1', 1);

      expect(result).toBe(true);
    });

    it('returns false when user cannot approve step', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [],
      } as any);

      const result = await canApproveByYear('user-1', 1);

      expect(result).toBe(false);
    });

    it('handles custom year parameter', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [],
      } as any);

      await canApproveByYear('user-1', 1, 2024);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: {
          yearRoles: {
            where: { year: 2024 },
          },
        },
      });
    });
  });

  describe('checkCanRegisterUsers', () => {
    it('should return false when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await import('../user-service').then(m => m.checkCanRegisterUsers('nonexistent-id'));

      expect(result).toBe(false);
    });

    it('should return true when user is admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockAdmin,
        canRegisterUsers: false,
        roleRef: null,
      } as any);

      const result = await import('../user-service').then(m => m.checkCanRegisterUsers('admin-1'));

      expect(result).toBe(true);
    });

    it('should return true when user has canRegisterUsers flag', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        canRegisterUsers: true,
        roleRef: null,
      } as any);

      const result = await import('../user-service').then(m => m.checkCanRegisterUsers('user-1'));

      expect(result).toBe(true);
    });

    it('should return true when role permissions include user:register', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        canRegisterUsers: false,
        roleRef: {
          id: 'role-1',
          code: 'team_leader',
          name: '팀장',
          permissions: ['user:register'],
          stepNumber: 1,
          sortOrder: 1,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      const result = await import('../user-service').then(m => m.checkCanRegisterUsers('user-1'));

      expect(result).toBe(true);
    });

    it('should return false when neither user nor role grants user:register', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        canRegisterUsers: false,
        roleRef: {
          id: 'role-1',
          code: 'user',
          name: '사용자',
          permissions: [],
          stepNumber: null,
          sortOrder: 5,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      const result = await import('../user-service').then(m => m.checkCanRegisterUsers('user-1'));

      expect(result).toBe(false);
    });
  });

  describe('setYearRole', () => {
    it('should update existing year role when departmentId is null', async () => {
      const existingYearRole: UserYearRole = {
        id: 'yr-1',
        userId: 'user-1',
        year: 2025,
        role: 'team_leader',
        roleId: null,
        departmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRole = {
        id: 'role-3',
        code: 'accountant',
        name: '회계',
        stepNumber: 2,
        canRegisterUsers: false,
        sortOrder: 3,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRole] as any);
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValue(existingYearRole);
      vi.mocked(prisma.userYearRole.update).mockResolvedValue(existingYearRole);

      const result = await import('../user-service').then(m => m.setYearRole('user-1', 2025, 'accountant'));

      expect(prisma.userYearRole.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', year: 2025, departmentId: null },
      });
      expect(prisma.userYearRole.update).toHaveBeenCalledWith({
        where: { id: 'yr-1' },
        data: { role: 'accountant', roleId: 'role-3' },
      });
      expect(result).toEqual(existingYearRole);
    });

    it('should create new year role when departmentId is null and no existing role', async () => {
      const newYearRole: UserYearRole = {
        id: 'yr-new',
        userId: 'user-1',
        year: 2025,
        role: 'finance_head',
        roleId: null,
        departmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRole = {
        id: 'role-2',
        code: 'finance_head',
        name: '재정팀장',
        stepNumber: 3,
        canRegisterUsers: false,
        sortOrder: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRole] as any);
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.userYearRole.create).mockResolvedValue(newYearRole);

      const result = await import('../user-service').then(m => m.setYearRole('user-1', 2025, 'finance_head'));

      expect(prisma.userYearRole.create).toHaveBeenCalled();
      // roleId가 undefined일 수도 있고 role-2일 수도 있음 (캐시 타이밍 때문)
      const createCall = vi.mocked(prisma.userYearRole.create).mock.calls[0][0];
      expect(createCall.data.userId).toBe('user-1');
      expect(createCall.data.year).toBe(2025);
      expect(createCall.data.role).toBe('finance_head');
      expect(createCall.data.departmentId).toBeNull();
      expect(result).toEqual(newYearRole);
    });
  });

  describe('findAllUsersWithEffectiveRole', () => {
    it('should return all active users with effective roles', async () => {
      const users = [
        {
          ...mockUser,
          yearRoles: [{
            id: 'yr-1',
            userId: 'user-1',
            year: CURRENT_YEAR,
            role: 'team_leader',
            roleId: null,
            departmentId: 'dept-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          }],
        },
        {
          ...mockAdmin,
          yearRoles: [],
        },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(users as any);

      const result = await import('../user-service').then(m => m.findAllUsersWithEffectiveRole());

      expect(result.length).toBe(2);
      expect(result[0].effectiveRole).toBe('team_leader');
      expect(result[1].effectiveRole).toBe('admin');
    });
  });

  // 다중 역할(Multi-role) 지원 테스트
  describe('getUserAllYearRoles', () => {
    it('should return all roles for a user in the given year', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [
          { role: 'team_leader' },
          { role: 'finance_head' },
        ],
      } as any);

      const result = await import('../user-service').then(m => m.getUserAllYearRoles('user-1', CURRENT_YEAR));

      expect(result).toEqual(['team_leader', 'finance_head']);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: {
          yearRoles: {
            where: { year: CURRENT_YEAR },
            select: { role: true },
          },
        },
      });
    });

    it('should return user role as fallback when no year roles exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        role: 'team_leader',
        yearRoles: [],
      } as any);

      const result = await import('../user-service').then(m => m.getUserAllYearRoles('user-1', CURRENT_YEAR));

      // UserYearRole이 없으면 User.role을 fallback으로 사용
      expect(result).toEqual(['team_leader']);
    });

    it('should return ["user"] when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await import('../user-service').then(m => m.getUserAllYearRoles('nonexistent', CURRENT_YEAR));

      expect(result).toEqual(['user']);
    });

    it('should return ["admin"] for admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockAdmin,
        yearRoles: [],
      } as any);

      const result = await import('../user-service').then(m => m.getUserAllYearRoles('admin-1', CURRENT_YEAR));

      expect(result).toEqual(['admin']);
    });

    it('should use default year (CURRENT_YEAR) when year is not specified', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [],
      } as any);

      await import('../user-service').then(m => m.getUserAllYearRoles('user-1'));

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: {
          yearRoles: {
            where: { year: CURRENT_YEAR },
            select: { role: true },
          },
        },
      });
    });

    it('should handle custom year parameter', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [],
      } as any);

      await import('../user-service').then(m => m.getUserAllYearRoles('user-1', 2024));

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: {
          yearRoles: {
            where: { year: 2024 },
            select: { role: true },
          },
        },
      });
    });

    it('should handle real-world scenario: 재정팀장 with team_leader + finance_head', async () => {
      // 재정팀장이 같은 부서에서 두 역할을 가진 경우
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        role: 'team_leader',
        yearRoles: [
          { role: 'team_leader' },
          { role: 'finance_head' },
        ],
      } as any);

      const result = await import('../user-service').then(m => m.getUserAllYearRoles('finance-head-user', CURRENT_YEAR));

      expect(result).toContain('team_leader');
      expect(result).toContain('finance_head');
      expect(result.length).toBe(2);
    });

    it('should handle user with single year role', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        yearRoles: [{ role: 'accountant' }],
      } as any);

      const result = await import('../user-service').then(m => m.getUserAllYearRoles('user-1', CURRENT_YEAR));

      expect(result).toEqual(['accountant']);
    });
  });
});
