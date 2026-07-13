/**
 * 테넌트별 역할→권한 정본 캐시 (AC3)
 *
 * 권한을 JWT에 스냅샷하지 않고 요청 시 DB(Role.permissions)에서 해석하되,
 * 테넌트 단위로 짧은 TTL 캐시 + 역할 변경 시 무효화한다.
 * → 관리자가 Role.permissions 를 바꾸면 재로그인 없이 캐시 TTL 내(또는 무효화 즉시) 반영.
 *
 * 참고: spec_rbac_refactoring.md §4.8
 */

import {
  presetResolver,
  RolePermissionResolver,
} from './permissions';

/** 역할 정의 로더 결과 행 */
export interface RoleRow {
  code: string;
  permissions: string[];
}

/** tenantId → 역할 정의 행 목록 로더 (DB 백엔드 주입 가능) */
export type RoleLoader = (tenantId: string) => Promise<RoleRow[]>;

interface CacheEntry {
  map: Map<string, string[]>;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 60초
const cache = new Map<string, CacheEntry>();

/** 기본 로더: DB Role 테이블 (테넌트 스코프, 활성 역할만) */
const defaultLoader: RoleLoader = async (tenantId) => {
  const { prismaBase } = await import('@/lib/prisma');
  const roles = await prismaBase.role.findMany({
    where: { tenantId, isActive: true },
    select: { code: true, permissions: true },
  });
  return roles.map((r) => ({ code: r.code, permissions: r.permissions ?? [] }));
};

/**
 * 역할 정의 맵으로부터 resolver 생성.
 * DB에 해당 역할의 permissions가 비어있거나 역할 자체가 없으면 코드 프리셋으로 폴백.
 */
export function buildResolver(map: Map<string, string[]>): RolePermissionResolver {
  return (roleCode) => {
    const fromDb = map.get(roleCode);
    if (fromDb && fromDb.length > 0) return fromDb;
    return presetResolver(roleCode);
  };
}

export interface ResolverCacheOptions {
  loader?: RoleLoader;
  ttlMs?: number;
  /** 현재 시각 함수(테스트 주입용) */
  now?: () => number;
}

/**
 * 테넌트의 역할→권한 resolver 를 캐시와 함께 반환.
 * 캐시 미스/만료 시 loader 로 재적재.
 */
export async function getTenantRoleResolver(
  tenantId: string,
  options: ResolverCacheOptions = {}
): Promise<RolePermissionResolver> {
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const loader = options.loader ?? defaultLoader;

  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > now()) {
    return buildResolver(cached.map);
  }

  const rows = await loader(tenantId);
  const map = new Map<string, string[]>(rows.map((r) => [r.code, r.permissions]));
  cache.set(tenantId, { map, expiresAt: now() + ttl });
  return buildResolver(map);
}

/**
 * 역할 변경 시 캐시 무효화 (재로그인 없이 즉시 반영).
 * tenantId 미지정 시 전체 무효화.
 */
export function invalidateRolePermissionCache(tenantId?: string): void {
  if (tenantId) {
    cache.delete(tenantId);
  } else {
    cache.clear();
  }
}

/** 테스트/진단용: 현재 캐시 크기 */
export function _rolePermissionCacheSize(): number {
  return cache.size;
}
