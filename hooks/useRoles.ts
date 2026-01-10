'use client';

import { useState, useEffect, useCallback } from 'react';

// Role 테이블 타입
export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stepNumber: number | null;
  sortOrder: number;
  isActive: boolean;
  canApprove: boolean;
  canManageExpense: boolean;
  canAccessAdmin: boolean;
  canExportData: boolean;
  _count?: {
    users: number;
    userYearRoles: number;
  };
}

// 역할별 색상 정의 (UI 관련이므로 클라이언트에서 관리)
export const ROLE_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  admin: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  finance_head: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  accountant: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  team_leader: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  admin_assistant: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  user: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
};

// 캐시 관리
let rolesCache: Role[] | null = null;
let rolesCacheTime = 0;
const CACHE_TTL = 60000; // 1분

/**
 * 역할 색상 조회
 */
export function getRoleColor(code: string): { bg: string; text: string; border?: string } {
  return ROLE_COLORS[code] || ROLE_COLORS.user;
}

/**
 * 역할 목록 가져오기 (서버 사이드 또는 클라이언트)
 */
export async function fetchRoles(forceRefresh = false): Promise<Role[]> {
  const now = Date.now();

  if (!forceRefresh && rolesCache && now - rolesCacheTime < CACHE_TTL) {
    return rolesCache;
  }

  const response = await fetch('/api/admin/roles');
  if (!response.ok) {
    throw new Error('Failed to fetch roles');
  }

  const roles = await response.json();
  rolesCache = roles;
  rolesCacheTime = now;

  return roles;
}

/**
 * 역할 코드로 역할명 조회
 */
export function getRoleName(roles: Role[], code: string): string {
  const role = roles.find(r => r.code === code);
  return role?.name || code;
}

/**
 * 역할 코드로 결재 단계 조회
 */
export function getRoleStep(roles: Role[], code: string): number | null {
  const role = roles.find(r => r.code === code);
  return role?.stepNumber || null;
}

/**
 * 확장 메뉴 접근 권한 체크 (간편 지출결의서 등)
 * Role.canManageExpense 기반
 */
export function canAccessExtendedMenu(roles: Role[], code: string): boolean {
  const role = roles.find(r => r.code === code);
  return role?.canManageExpense || code === 'admin';
}

/**
 * 결재함 접근 권한 체크
 * Role.canApprove 기반
 */
export function canAccessApprovalMenu(roles: Role[], code: string): boolean {
  const role = roles.find(r => r.code === code);
  return role?.canApprove || code === 'admin';
}

/**
 * 관리 메뉴 접근 권한 체크
 * Role.canAccessAdmin 기반
 */
export function canAccessAdminMenu(roles: Role[], code: string): boolean {
  const role = roles.find(r => r.code === code);
  return role?.canAccessAdmin || false;
}

/**
 * 데이터 내보내기 권한 체크
 * Role.canExportData 기반
 */
export function canExportData(roles: Role[], code: string): boolean {
  const role = roles.find(r => r.code === code);
  return role?.canExportData || false;
}

// Hook 결과 타입
interface UseRolesResult {
  roles: Role[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  getRoleName: (code: string) => string;
  getRoleStep: (code: string) => number | null;
  getRoleColor: (code: string) => { bg: string; text: string; border?: string };
  canAccessExtendedMenu: (code: string) => boolean;
  canAccessApprovalMenu: (code: string) => boolean;
  canAccessAdminMenu: (code: string) => boolean;
  canExportData: (code: string) => boolean;
}

/**
 * 역할 데이터를 가져오는 React Hook
 */
export function useRoles(): UseRolesResult {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRoles = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchRoles(forceRefresh);
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch roles'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const refresh = useCallback(() => {
    loadRoles(true);
  }, [loadRoles]);

  return {
    roles,
    isLoading,
    error,
    refresh,
    getRoleName: (code: string) => getRoleName(roles, code),
    getRoleStep: (code: string) => getRoleStep(roles, code),
    getRoleColor: (code: string) => getRoleColor(code),
    canAccessExtendedMenu: (code: string) => canAccessExtendedMenu(roles, code),
    canAccessApprovalMenu: (code: string) => canAccessApprovalMenu(roles, code),
    canAccessAdminMenu: (code: string) => canAccessAdminMenu(roles, code),
    canExportData: (code: string) => canExportData(roles, code),
  };
}

/**
 * 역할 선택 옵션 생성 (드롭다운용)
 */
export function getRoleOptions(roles: Role[], excludeCodes?: string[]): { value: string; label: string }[] {
  return roles
    .filter(r => r.isActive && (!excludeCodes || !excludeCodes.includes(r.code)))
    .map(r => ({ value: r.code, label: r.name }));
}

/**
 * 연도별 역할 선택 옵션 (admin, user 제외)
 */
export function getYearRoleOptions(roles: Role[]): { value: string; label: string }[] {
  return getRoleOptions(roles, ['admin', 'user']).map(opt => {
    const role = roles.find(r => r.code === opt.value);
    if (role?.stepNumber) {
      return { ...opt, label: `${opt.label} (${role.stepNumber}차 결재)` };
    }
    return opt;
  });
}
