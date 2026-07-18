'use client';

/**
 * 서버 주도 설정 컨텍스트 (ARC-002 §4, B5)
 *
 * 로그인/조직 전환 시 GET /api/me/config를 조회해 레이블·기능 플래그·브랜딩을
 * 앱 전역에 제공한다. TenantProvider보다 바깥에 두어 TenantContext가
 * config.labels를 org-terms 오버라이드로 연결할 수 있게 한다.
 *
 * - 미로그인(401)/조회 실패 시 config는 null — 소비처는 기존 orgType 기반 동작으로
 *   폴백한다 (Membership 백필 전·단일 소속 사용자 회귀 방지)
 * - 캐시: localStorage 캐시 즉시 적용 + 포그라운드/포커스 진입 시 재검증 (§4.2 표)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { TenantFeatures, TenantLabels } from '@/lib/tenant/settings';

/** GET /api/me/config 응답 계약 (ARC-002 §4.1, B4) */
export interface MeConfig {
  tenant: { id: string; name: string; orgType: string };
  labels: TenantLabels;
  features: TenantFeatures;
  branding: { logoUrl: string | null; primaryColor: string };
}

interface MeConfigContextValue {
  config: MeConfig | null;
  isLoading: boolean;
  /** 로그인/조직 전환 직후 등 서버 설정을 다시 조회할 때 호출 */
  refresh: () => Promise<void>;
}

const ME_CONFIG_CACHE_KEY = 'me_config_cache';

/** 로그아웃·조직 전환 시 저장된 설정 캐시 제거 (컨텍스트 밖에서도 호출 가능) */
export function clearMeConfigCache() {
  try {
    window.localStorage.removeItem(ME_CONFIG_CACHE_KEY);
  } catch {
    // localStorage 사용 불가 환경 무시
  }
}

// 캐시/응답이 계약 형태인지 최소 검증 (구버전 캐시·오염 데이터 방어)
function isMeConfig(value: unknown): value is MeConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Boolean(v.tenant && v.labels && v.features && v.branding);
}

const MeConfigContext = createContext<MeConfigContextValue>({
  config: null,
  isLoading: true,
  refresh: async () => {},
});

export function MeConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<MeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/me/config');

      // 미로그인 — 설정 없음 상태로 초기화 (소비처는 orgType 기반 폴백)
      if (response.status === 401) {
        setConfig(null);
        clearMeConfigCache();
        return;
      }

      const data = await response.json();
      if (response.ok && isMeConfig(data)) {
        setConfig(data);
        try {
          window.localStorage.setItem(ME_CONFIG_CACHE_KEY, JSON.stringify(data));
        } catch {
          // 무시
        }
      }
    } catch {
      // 네트워크 실패 — 기존 값(캐시) 유지 (§4.2 캐시 우선)
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1) 캐시된 설정 즉시 적용 (레이블/메뉴 깜빡임 최소화)
    try {
      const cached = window.localStorage.getItem(ME_CONFIG_CACHE_KEY);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (isMeConfig(parsed)) {
          setConfig(parsed);
        }
      }
    } catch {
      // 무시
    }

    // 2) 서버 재검증
    void refresh();

    // 3) 포그라운드/포커스 진입 시 재검증 (§4.2)
    const handleFocus = () => {
      void refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  return (
    <MeConfigContext.Provider value={{ config, isLoading, refresh }}>
      {children}
    </MeConfigContext.Provider>
  );
}

/** 서버 주도 설정 접근 훅 — config가 null이면 미로그인/조회 전 (orgType 폴백 사용) */
export function useMeConfig(): MeConfigContextValue {
  return useContext(MeConfigContext);
}
