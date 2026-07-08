import { prismaBase } from './prisma';
import { TenantContext, extractSubdomain, withTenantAsync } from './tenant-context';

// 테넌트 캐시 (인메모리, TTL 5분)
interface CachedTenant {
  data: TenantContext;
  expiresAt: number;
}

const tenantCache = new Map<string, CachedTenant>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 캐시에서 테넌트 조회
 */
function getCachedTenant(key: string): TenantContext | null {
  const cached = tenantCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) {
    tenantCache.delete(key); // 만료된 캐시 삭제
  }
  return null;
}

/**
 * 캐시에 테넌트 저장
 */
function setCachedTenant(key: string, data: TenantContext): void {
  tenantCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

/**
 * subdomain으로 테넌트 조회
 */
export async function findTenantBySubdomain(
  subdomain: string
): Promise<TenantContext | null> {
  // 캐시 확인
  const cacheKey = `subdomain:${subdomain}`;
  const cached = getCachedTenant(cacheKey);
  if (cached) return cached;

  // DB 조회 (prismaBase 사용 - 테넌트 필터링 없음)
  const tenant = await prismaBase.tenant.findUnique({
    where: { subdomain },
    select: {
      id: true,
      subdomain: true,
      plan: true,
      isActive: true,
    },
  });

  if (!tenant || !tenant.isActive) {
    return null;
  }

  const context: TenantContext = {
    tenantId: tenant.id,
    subdomain: tenant.subdomain,
    plan: tenant.plan,
  };

  // 캐시 저장
  setCachedTenant(cacheKey, context);

  return context;
}

/**
 * 커스텀 도메인으로 테넌트 조회
 */
export async function findTenantByCustomDomain(
  domain: string
): Promise<TenantContext | null> {
  // 캐시 확인
  const cacheKey = `domain:${domain}`;
  const cached = getCachedTenant(cacheKey);
  if (cached) return cached;

  // DB 조회
  const tenant = await prismaBase.tenant.findUnique({
    where: { customDomain: domain },
    select: {
      id: true,
      subdomain: true,
      plan: true,
      isActive: true,
    },
  });

  if (!tenant || !tenant.isActive) {
    return null;
  }

  const context: TenantContext = {
    tenantId: tenant.id,
    subdomain: tenant.subdomain,
    plan: tenant.plan,
  };

  // 캐시 저장
  setCachedTenant(cacheKey, context);

  return context;
}

/**
 * tenantId로 테넌트 조회
 */
export async function findTenantById(
  tenantId: string
): Promise<TenantContext | null> {
  // 캐시 확인
  const cacheKey = `id:${tenantId}`;
  const cached = getCachedTenant(cacheKey);
  if (cached) return cached;

  // DB 조회
  const tenant = await prismaBase.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      subdomain: true,
      plan: true,
      isActive: true,
    },
  });

  if (!tenant || !tenant.isActive) {
    return null;
  }

  const context: TenantContext = {
    tenantId: tenant.id,
    subdomain: tenant.subdomain,
    plan: tenant.plan,
  };

  // 캐시 저장
  setCachedTenant(cacheKey, context);

  return context;
}

/**
 * 요청에서 테넌트 컨텍스트 해석
 * @param host 호스트 헤더 (예: chungyeon.expense-saas.com)
 * @param tenantParam 쿼리 파라미터의 tenant 값 (개발용)
 */
export async function resolveTenant(
  host: string | null,
  tenantParam?: string | null
): Promise<TenantContext | null> {
  // 1. 개발 환경에서 쿼리 파라미터로 테넌트 지정
  if (tenantParam) {
    return findTenantBySubdomain(tenantParam);
  }

  if (!host) return null;

  // 2. subdomain 추출 시도
  const subdomain = extractSubdomain(host);
  if (subdomain) {
    return findTenantBySubdomain(subdomain);
  }

  // 3. 커스텀 도메인으로 조회
  // 기본 도메인이 아닌 경우 커스텀 도메인으로 간주
  const baseDomain = process.env.BASE_DOMAIN || 'expense-saas.com';
  if (!host.includes(baseDomain) && !host.includes('localhost')) {
    return findTenantByCustomDomain(host);
  }

  return null;
}

/**
 * 테넌트 컨텍스트 내에서 API 핸들러 실행
 * 미들웨어에서 사용
 */
export async function withTenantRequest<T>(
  host: string | null,
  tenantParam: string | null | undefined,
  handler: () => Promise<T>
): Promise<T> {
  const tenant = await resolveTenant(host, tenantParam);

  if (!tenant) {
    // 테넌트 없이 실행 (필터링 없음)
    return handler();
  }

  // 테넌트 컨텍스트 내에서 핸들러 실행
  return withTenantAsync(tenant, handler);
}

/**
 * 테넌트 캐시 무효화
 * 테넌트 설정 변경 시 호출
 */
export function invalidateTenantCache(tenantId: string, subdomain?: string): void {
  tenantCache.delete(`id:${tenantId}`);
  if (subdomain) {
    tenantCache.delete(`subdomain:${subdomain}`);
  }

  // 모든 캐시 순회하며 해당 tenantId 제거
  Array.from(tenantCache.entries()).forEach(([key, value]) => {
    if (value.data.tenantId === tenantId) {
      tenantCache.delete(key);
    }
  });
}

/**
 * 전체 캐시 초기화 (개발/테스트용)
 */
export function clearTenantCache(): void {
  tenantCache.clear();
}
