/**
 * TenantSwitcher 컴포넌트 테스트 (B5)
 *
 * 테스트 대상:
 * - useMemberships: 로그인 시에만 조회, 실패 시 빈 배열 (전환 메뉴 미노출 → 기존 UX 무변경)
 * - 모달: 소속 목록 표시, 현재 조직 표시/비활성
 * - 전환: POST /api/auth/switch-tenant 호출, 실패 시 에러 메시지
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react';
import TenantSwitcher, {
  useMemberships,
  MembershipOption,
} from '../TenantSwitcher';

const MEMBERSHIPS: MembershipOption[] = [
  {
    tenantId: 'tenant-company',
    tenantName: '청연컨설팅',
    orgType: 'COMPANY',
    role: 'MEMBER',
    isCurrent: true,
  },
  {
    tenantId: 'tenant-church',
    tenantName: '청연교회',
    orgType: 'CHURCH',
    role: 'MEMBER',
    isCurrent: false,
  },
];

describe('useMemberships', () => {
  beforeEach(() => {
    (global.fetch as Mock).mockReset();
  });

  it('enabled=false(미로그인)면 조회하지 않고 빈 배열', () => {
    const { result } = renderHook(() => useMemberships(false));
    expect(result.current.memberships).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('enabled=true면 /api/me/memberships를 조회해 목록 반환', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ memberships: MEMBERSHIPS }),
    });

    const { result } = renderHook(() => useMemberships(true));

    await waitFor(() => expect(result.current.memberships).toHaveLength(2));
    expect(global.fetch).toHaveBeenCalledWith('/api/me/memberships');
  });

  it('조회 실패(백필 전 등) 시 빈 배열 유지 — 전환 메뉴 미노출', async () => {
    (global.fetch as Mock).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useMemberships(true));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(result.current.memberships).toEqual([]);
  });
});

describe('TenantSwitcher', () => {
  beforeEach(() => {
    (global.fetch as Mock).mockReset();
  });

  it('isOpen=false면 렌더링하지 않는다', () => {
    render(
      <TenantSwitcher isOpen={false} onClose={vi.fn()} memberships={MEMBERSHIPS} />
    );
    expect(screen.queryByText('조직 전환')).not.toBeInTheDocument();
  });

  it('소속 목록을 표시하고 현재 조직은 비활성 처리한다', () => {
    render(
      <TenantSwitcher isOpen={true} onClose={vi.fn()} memberships={MEMBERSHIPS} />
    );

    expect(screen.getByText('청연컨설팅')).toBeInTheDocument();
    expect(screen.getByText('청연교회')).toBeInTheDocument();
    expect(screen.getByText('현재')).toBeInTheDocument();

    const currentButton = screen.getByText('청연컨설팅').closest('button');
    expect(currentButton).toBeDisabled();
  });

  it('다른 조직 선택 시 switch-tenant를 호출한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <TenantSwitcher isOpen={true} onClose={vi.fn()} memberships={MEMBERSHIPS} />
    );

    fireEvent.click(screen.getByText('청연교회'));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-church' }),
      })
    );
  });

  it('전환 실패 시 서버 에러 메시지를 표시한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: '해당 조직에 소속되어 있지 않습니다.' }),
    });

    render(
      <TenantSwitcher isOpen={true} onClose={vi.fn()} memberships={MEMBERSHIPS} />
    );

    fireEvent.click(screen.getByText('청연교회'));

    await waitFor(() =>
      expect(
        screen.getByText('해당 조직에 소속되어 있지 않습니다.')
      ).toBeInTheDocument()
    );
  });
});
