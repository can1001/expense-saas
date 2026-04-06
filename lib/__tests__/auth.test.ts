import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for proper initialization order
const { mockCookieStore, mockPrisma } = vi.hoisted(() => ({
  mockCookieStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  mockPrisma: {
    userYearRole: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock prisma
vi.mock('../prisma', () => ({
  prisma: mockPrisma,
}));

// Mock users module
vi.mock('../users', () => ({
  findUserById: vi.fn((id: string) => {
    if (id === '1') {
      return {
        id: '1',
        userid: '청연정혜종',
        username: '정혜종',
        role: 'user',
      };
    }
    if (id === '3') {
      return {
        id: '3',
        userid: '청연신창국',
        username: '신창국',
        role: 'finance_head',
      };
    }
    return undefined;
  }),
  toUserInfo: vi.fn((user) => ({
    id: user.id,
    userid: user.userid,
    username: user.username,
    role: user.role,
  })),
}));

import { createSession, deleteSession, getCurrentUser, getSessionUserId } from '../auth';
import { findUserById } from '../users';

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no yearRole found (use User.role)
    mockPrisma.userYearRole.findFirst.mockResolvedValue(null);
  });

  describe('createSession', () => {
    it('should create session cookie with userId', async () => {
      await createSession('test-user-id');

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'session',
        'test-user-id',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      );
    });

    it('should set secure flag in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await createSession('test-user-id');

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'session',
        'test-user-id',
        expect.objectContaining({
          secure: true,
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not set secure flag in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await createSession('test-user-id');

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'session',
        'test-user-id',
        expect.objectContaining({
          secure: false,
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should set maxAge to 7 days', async () => {
      await createSession('test-user-id');

      const sevenDaysInSeconds = 60 * 60 * 24 * 7;
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'session',
        'test-user-id',
        expect.objectContaining({
          maxAge: sevenDaysInSeconds,
        })
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete session cookie', async () => {
      await deleteSession();

      expect(mockCookieStore.delete).toHaveBeenCalledWith('session');
    });
  });

  describe('getCurrentUser', () => {
    it('should return user info when session exists', async () => {
      mockCookieStore.get.mockReturnValue({ value: '1' });

      const user = await getCurrentUser();

      expect(mockCookieStore.get).toHaveBeenCalledWith('session');
      expect(findUserById).toHaveBeenCalledWith('1');
      expect(user).toBeTruthy();
      expect(user?.userid).toBe('청연정혜종');
    });

    it('should return null when session does not exist', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const user = await getCurrentUser();

      expect(mockCookieStore.get).toHaveBeenCalledWith('session');
      expect(user).toBeNull();
    });

    it('should return null when user not found', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid-user-id' });

      const user = await getCurrentUser();

      expect(mockCookieStore.get).toHaveBeenCalledWith('session');
      expect(findUserById).toHaveBeenCalledWith('invalid-user-id');
      expect(user).toBeNull();
    });

    it('should return finance head user when session has finance head id', async () => {
      mockCookieStore.get.mockReturnValue({ value: '3' });

      const user = await getCurrentUser();

      expect(user).toBeTruthy();
      expect(user?.role).toBe('finance_head');
    });
  });

  describe('getSessionUserId', () => {
    it('should return userId when session exists', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'test-user-id' });

      const userId = await getSessionUserId();

      expect(mockCookieStore.get).toHaveBeenCalledWith('session');
      expect(userId).toBe('test-user-id');
    });

    it('should return null when session does not exist', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const userId = await getSessionUserId();

      expect(mockCookieStore.get).toHaveBeenCalledWith('session');
      expect(userId).toBeNull();
    });

    it('should return empty string when session value is empty', async () => {
      mockCookieStore.get.mockReturnValue({ value: '' });

      const userId = await getSessionUserId();

      // The function returns `value || null`, so empty string becomes null
      expect(userId).toBe(null);
    });
  });
});
