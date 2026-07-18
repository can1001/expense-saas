/**
 * 로그인 페이지 테스트 (B5)
 *
 * 테스트 대상:
 * - 단일 소속: 로그인 성공 시 조직 선택 화면 없이 바로 진입 (기존 UX 무변경)
 * - 복수 소속: requiresTenantSelection 응답 시 조직 선택 화면 표시
 *   → 선택 시 switch-tenant 호출 후 진입
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../page';

// 테스트 파일 로컬 라우터 모킹 — push/refresh 호출 검증용 (setup.ts 전역 모킹 오버라이드)
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

// URL별 fetch 응답 구성 헬퍼
function mockFetchByUrl(routes: Record<string, { ok: boolean; body: unknown }>) {
  (global.fetch as Mock).mockImplementation(async (url: string) => {
    for (const [prefix, response] of Object.entries(routes)) {
      if (String(url).startsWith(prefix)) {
        return {
          ok: response.ok,
          status: response.ok ? 200 : 400,
          json: async () => response.body,
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
  });
}

async function submitLogin() {
  fireEvent.change(await screen.findByLabelText('아이디'), {
    target: { value: 'testuser' },
  });
  fireEvent.change(screen.getByLabelText('비밀번호'), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    (global.fetch as Mock).mockReset();
    mockPush.mockReset();
    mockRefresh.mockReset();
    window.localStorage.clear();
  });

  it('단일 소속: 로그인 성공 시 조직 선택 없이 바로 진입한다 (기존 UX 무변경)', async () => {
    mockFetchByUrl({
      '/api/tenant/info': { ok: true, body: { tenant: null } },
      '/api/auth/login': {
        ok: true,
        body: { success: true, user: { id: 'u1' }, token: 't' },
      },
      '/api/me/config': { ok: true, body: {} },
    });

    render(<LoginPage />);
    await submitLogin();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('소속 조직 선택')).not.toBeInTheDocument();
  });

  it('복수 소속: 조직 선택 화면을 표시하고 선택 시 switch-tenant 후 진입한다', async () => {
    mockFetchByUrl({
      '/api/tenant/info': { ok: true, body: { tenant: null } },
      '/api/auth/login': {
        ok: true,
        body: {
          success: true,
          requiresTenantSelection: true,
          memberships: [
            {
              tenantId: 'tenant-company',
              tenantName: '청연컨설팅',
              orgType: 'COMPANY',
              role: 'MEMBER',
            },
            {
              tenantId: 'tenant-church',
              tenantName: '청연교회',
              orgType: 'CHURCH',
              role: 'MEMBER',
            },
          ],
        },
      },
      '/api/auth/switch-tenant': { ok: true, body: { success: true } },
      '/api/me/config': { ok: true, body: {} },
    });

    render(<LoginPage />);
    await submitLogin();

    // 조직 선택 화면 표시 — 아직 진입하지 않음
    expect(await screen.findByText('소속 조직 선택')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    // 조직 선택 → switch-tenant 호출 후 진입
    fireEvent.click(screen.getByText('청연교회'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/switch-tenant',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-church' }),
      })
    );
  });

  it('복수 소속: 조직 선택 실패 시 에러를 표시하고 진입하지 않는다', async () => {
    mockFetchByUrl({
      '/api/tenant/info': { ok: true, body: { tenant: null } },
      '/api/auth/login': {
        ok: true,
        body: {
          success: true,
          requiresTenantSelection: true,
          memberships: [
            {
              tenantId: 'tenant-company',
              tenantName: '청연컨설팅',
              orgType: 'COMPANY',
              role: 'MEMBER',
            },
            {
              tenantId: 'tenant-church',
              tenantName: '청연교회',
              orgType: 'CHURCH',
              role: 'MEMBER',
            },
          ],
        },
      },
      '/api/auth/switch-tenant': {
        ok: false,
        body: { error: '해당 조직에 소속되어 있지 않습니다.' },
      },
    });

    render(<LoginPage />);
    await submitLogin();

    fireEvent.click(await screen.findByText('청연교회'));

    expect(
      await screen.findByText('해당 조직에 소속되어 있지 않습니다.')
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
