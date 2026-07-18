/**
 * MeConfigContext 테스트 (B5)
 *
 * 테스트 대상:
 * - /api/me/config 조회 성공 시 config 제공 + localStorage 캐시 저장
 * - 401(미로그인) 시 config null + 캐시 제거 (orgType 폴백 상태)
 * - 네트워크 실패 시 캐시된 설정 유지 (§4.2 캐시 우선)
 */

import { describe, it, expect, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  MeConfigProvider,
  useMeConfig,
  clearMeConfigCache,
  MeConfig,
} from '../MeConfigContext';

const CACHE_KEY = 'me_config_cache';

const CHURCH_CONFIG: MeConfig = {
  tenant: { id: 'tenant-1', name: '청연교회', orgType: 'CHURCH' },
  labels: { department: '부서', position: '직분', budget: '예산(회계연도)' },
  features: {
    incomeModule: true,
    budgetModule: true,
    vat: false,
    taxInvoice: false,
    offeringLink: true,
  },
  branding: { logoUrl: null, primaryColor: '#1F3864' },
};

function Probe() {
  const { config, isLoading } = useMeConfig();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="tenant-name">{config?.tenant.name ?? 'none'}</span>
      <span data-testid="income-module">
        {config ? String(config.features.incomeModule) : 'none'}
      </span>
    </div>
  );
}

describe('MeConfigProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    (global.fetch as Mock).mockReset();
  });

  it('조회 성공 시 config를 제공하고 localStorage에 캐시한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => CHURCH_CONFIG,
    });

    render(
      <MeConfigProvider>
        <Probe />
      </MeConfigProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('tenant-name')).toHaveTextContent('청연교회')
    );
    expect(screen.getByTestId('income-module')).toHaveTextContent('true');
    expect(JSON.parse(window.localStorage.getItem(CACHE_KEY)!)).toEqual(CHURCH_CONFIG);
  });

  it('401(미로그인)이면 config는 null이고 캐시를 제거한다', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(CHURCH_CONFIG));
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: '로그인이 필요합니다.' }),
    });

    render(
      <MeConfigProvider>
        <Probe />
      </MeConfigProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('tenant-name')).toHaveTextContent('none')
    );
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('네트워크 실패 시 캐시된 설정을 유지한다', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(CHURCH_CONFIG));
    (global.fetch as Mock).mockRejectedValue(new Error('network error'));

    render(
      <MeConfigProvider>
        <Probe />
      </MeConfigProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );
    expect(screen.getByTestId('tenant-name')).toHaveTextContent('청연교회');
  });

  it('형태가 유효하지 않은 캐시는 무시한다', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ garbage: true }));
    (global.fetch as Mock).mockRejectedValue(new Error('network error'));

    render(
      <MeConfigProvider>
        <Probe />
      </MeConfigProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );
    expect(screen.getByTestId('tenant-name')).toHaveTextContent('none');
  });
});

describe('clearMeConfigCache', () => {
  it('저장된 설정 캐시를 제거한다', () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(CHURCH_CONFIG));
    clearMeConfigCache();
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });
});
