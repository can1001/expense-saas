/**
 * useFetchCurrentUser 훅 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFetchCurrentUser } from '../useFetchCurrentUser';

// fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useFetchCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch current user successfully', async () => {
    const mockUser = { id: '1', name: '홍길동', email: 'hong@test.com', role: 'USER' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    const { result } = renderHook(() => useFetchCurrentUser());

    // 초기 상태
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/me');
  });

  it('should call onSuccess callback when user is fetched', async () => {
    const mockUser = { id: '1', name: '홍길동', email: 'hong@test.com', role: 'USER' };
    const onSuccess = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    const { result } = renderHook(() => useFetchCurrentUser({ onSuccess }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(onSuccess).toHaveBeenCalledWith(mockUser);
  });

  it('should skip fetching when skip option is true', async () => {
    const { result } = renderHook(() => useFetchCurrentUser({ skip: true }));

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const { result } = renderHook(() => useFetchCurrentUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 로그인되지 않은 경우 에러 없이 처리
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFetchCurrentUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle response without user field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useFetchCurrentUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('should not call onSuccess when no user in response', async () => {
    const onSuccess = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useFetchCurrentUser({ onSuccess }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});
