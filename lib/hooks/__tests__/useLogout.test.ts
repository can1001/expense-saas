/**
 * useLogout 훅 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLogout } from '../useLogout';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('useLogout', () => {
  beforeEach(() => {
    push.mockReset();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset?.();
    global.fetch = vi.fn();
  });

  it('/auth/logout POST 후 /login으로 이동한다', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useLogout());
    await result.current();

    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('요청 실패 시에도 예외를 던지지 않는다', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useLogout());
    await expect(result.current()).resolves.toBeUndefined();

    expect(push).not.toHaveBeenCalled();
  });
});
