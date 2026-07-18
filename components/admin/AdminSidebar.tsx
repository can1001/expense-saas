'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAdminSidebarMenu } from '@/lib/constants/admin-menu';
import { filterAdminMenuByRoles } from '@/lib/constants/menu-permissions';
import { useTenant } from '@/lib/contexts/TenantContext';
import { useMeConfig } from '@/lib/contexts/MeConfigContext';
import { apiBase } from '@/lib/api/api-base';
import Sidebar, { SidebarConfig } from '@/components/layout/Sidebar';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * 관리자 사이드바 — 데이터(역할 조회·권한 필터·메뉴 IA)만 담당하고
 * 렌더링은 공용 Sidebar(딥그린)에 위임한다.
 * (docs/SPEC_DESIGN_TOKENS_APPSHELL_2026-07-18.md T5)
 */
export default function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const { orgType } = useTenant();
  // 서버 주도 기능 플래그 (B5) — 없으면 getAdminSidebarMenu가 orgType 분기로 폴백
  const { config } = useMeConfig();
  const [userRoles, setUserRoles] = useState<string[] | null>(null);

  // 사용자 역할 조회 (다중 역할 지원)
  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const response = await fetch(`${apiBase('auth')}/auth/me`);
        const data = await response.json();
        if (response.ok && data.user) {
          // roles 배열 사용, 없으면 role을 배열로 변환
          const roles = data.user.roles || [data.user.role];
          setUserRoles(roles);
        }
      } catch {
        setUserRoles(null);
      }
    };
    fetchUserRoles();
  }, []);

  // 조직 유형별 메뉴 + 역할 기반 필터링 (다중 역할 지원)
  const sidebarConfig = useMemo<SidebarConfig>(() => {
    const baseMenu = getAdminSidebarMenu(orgType, config?.features);
    const filtered =
      userRoles && userRoles.length > 0
        ? filterAdminMenuByRoles(baseMenu, userRoles)
        : baseMenu;
    return {
      variant: 'admin',
      backLink: { href: '/', label: '홈으로' },
      groups: filtered,
    };
  }, [orgType, config, userRoles]);

  return <Sidebar config={sidebarConfig} isOpen={isOpen} onClose={onClose} />;
}
