'use client';

/**
 * 테넌트 컨텍스트
 *
 * 루트 Providers에서 /api/tenant/info를 1회 조회해 테넌트 공개 정보(orgType 포함)를
 * 앱 전역에 제공한다. useOrgTerms()로 조직 유형별 화면 용어를 어디서든 사용할 수 있다.
 *
 * - orgType 미확정(로딩 중/실패) 시 교회 용어를 기본값으로 사용해 기존 동작을 유지한다.
 * - 라벨 깜빡임 최소화를 위해 sessionStorage에 orgType을 캐시한다.
 * - 서버 주도 설정(B5): 로그인 상태에서 MeConfig가 있으면 config.tenant.orgType과
 *   config.labels가 우선한다 — 조직 전환 직후에도 서버 기준으로 일관되게 렌더링.
 *   config가 없으면(미로그인/백필 전) 기존 동작 그대로.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { getOrgTerms, OrgTerms } from '@/lib/org-terms';
import { useMeConfig } from '@/lib/contexts/MeConfigContext';

export interface TenantPublicInfo {
  id: string;
  name: string;
  subdomain: string;
  orgType: string;
  logoUrl: string | null;
}

interface TenantContextValue {
  tenant: TenantPublicInfo | null;
  orgType: string | null;
  terms: OrgTerms;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  orgType: null,
  terms: getOrgTerms(null),
  isLoading: true,
});

export const ORG_TYPE_CACHE_KEY = 'tenant_org_type';

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantPublicInfo | null>(null);
  const [orgType, setOrgType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // 서버 주도 설정 (로그인 상태에서만 존재 — 없으면 기존 orgType 기반 폴백)
  const { config } = useMeConfig();

  useEffect(() => {
    // 1) 캐시된 orgType 우선 적용 (깜빡임 최소화, 하이드레이션 이후라 안전)
    try {
      const cached = sessionStorage.getItem(ORG_TYPE_CACHE_KEY);
      if (cached) setOrgType(cached);
    } catch {
      // sessionStorage 사용 불가 환경 무시
    }

    // 2) 서버에서 최신 테넌트 정보 조회
    const fetchTenantInfo = async () => {
      try {
        const response = await fetch('/api/tenant/info');
        const data = await response.json();
        if (response.ok && data.tenant) {
          setTenant(data.tenant);
          setOrgType(data.tenant.orgType ?? null);
          try {
            sessionStorage.setItem(ORG_TYPE_CACHE_KEY, data.tenant.orgType ?? '');
          } catch {
            // 무시
          }
        }
      } catch (err) {
        console.error('테넌트 정보 조회 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenantInfo();
  }, []);

  // 서버 주도 설정이 있으면 orgType·레이블 모두 서버 값 우선 (ARC-002 §4.2 — 하드코딩 금지)
  const effectiveOrgType = config?.tenant.orgType ?? orgType;
  const terms = getOrgTerms(
    effectiveOrgType,
    config ? { department: config.labels.department } : null
  );

  return (
    <TenantContext.Provider
      value={{ tenant, orgType: effectiveOrgType, terms, isLoading }}
    >
      {children}
    </TenantContext.Provider>
  );
}

/** 테넌트 전체 정보 접근 훅 */
export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}

/** 조직 유형별 화면 용어 훅 (예: terms.committee → 위원회/본부) */
export function useOrgTerms(): OrgTerms {
  return useContext(TenantContext).terms;
}
