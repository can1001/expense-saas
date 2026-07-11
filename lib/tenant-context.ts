import { AsyncLocalStorage } from 'async_hooks';

// 테넌트 컨텍스트 타입
export interface TenantContext {
  tenantId: string;
  subdomain: string;
  plan?: string;
}

// Node.js AsyncLocalStorage를 사용한 요청별 컨텍스트 관리
// 각 요청마다 독립적인 테넌트 컨텍스트 유지
const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * 현재 요청의 테넌트 컨텍스트 가져오기
 * @returns TenantContext 또는 undefined (테넌트 컨텍스트가 없는 경우)
 */
export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/**
 * 현재 요청의 tenantId 가져오기
 * @throws Error 테넌트 컨텍스트가 없는 경우
 */
export function getTenantId(): string {
  const context = getTenantContext();
  if (!context) {
    throw new Error('테넌트 컨텍스트가 설정되지 않았습니다. withTenant()를 사용하세요.');
  }
  return context.tenantId;
}

/**
 * 현재 요청의 tenantId 가져오기 (옵셔널)
 * @returns tenantId 또는 undefined
 */
export function getTenantIdOptional(): string | undefined {
  return getTenantContext()?.tenantId;
}

/**
 * 테넌트 컨텍스트 내에서 콜백 실행
 * @param context 테넌트 컨텍스트
 * @param callback 실행할 함수
 */
export function withTenant<T>(context: TenantContext, callback: () => T): T {
  return tenantStorage.run(context, callback);
}

/**
 * 테넌트 컨텍스트 내에서 비동기 콜백 실행
 * @param context 테넌트 컨텍스트
 * @param callback 실행할 비동기 함수
 */
export async function withTenantAsync<T>(
  context: TenantContext,
  callback: () => Promise<T>
): Promise<T> {
  return tenantStorage.run(context, callback);
}

// 테넌트 서브도메인으로 취급하지 않는 PaaS/플랫폼 기본 도메인.
// 이 도메인들의 첫 라벨은 배포 서비스명이지 테넌트가 아니다.
export const PLATFORM_BASE_DOMAINS = ['onrender.com', 'vercel.app', 'netlify.app'];

/**
 * 요청 헤더에서 subdomain 추출
 * @param host 호스트 헤더 (예: chungyeon.expense-saas.com)
 * @returns subdomain 또는 null
 */
export function extractSubdomain(host: string | null): string | null {
  if (!host) return null;

  // 포트 제거 (예: chungyeon.expense-saas.com:3000)
  const hostname = host.split(':')[0];

  // localhost 개발 환경 처리
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    // localhost:3000?tenant=chungyeon 형식 지원
    return null; // 개발 환경에서는 쿼리 파라미터로 처리
  }

  // PaaS 기본 도메인(예: zionyul-expense-saas.onrender.com)의 첫 라벨은
  // 서비스명이므로 테넌트 서브도메인으로 취급하지 않는다.
  if (
    PLATFORM_BASE_DOMAINS.some(
      (base) => hostname === base || hostname.endsWith(`.${base}`)
    )
  ) {
    return null;
  }

  // subdomain.domain.com 형식에서 subdomain 추출
  const parts = hostname.split('.');

  // expense-saas.com (2 parts) - 기본 도메인
  // chungyeon.expense-saas.com (3 parts) - 테넌트 서브도메인
  // www.expense-saas.com (3 parts, www는 무시)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // www, app 등 시스템 서브도메인 제외
    if (['www', 'app', 'api', 'admin', 'static'].includes(subdomain)) {
      return null;
    }
    return subdomain;
  }

  return null;
}

/**
 * 커스텀 도메인에서 테넌트 찾기 (DB 조회 필요)
 * @param domain 커스텀 도메인 (예: expense.chungyeon.org)
 * @returns Promise<string | null> tenantId
 */
export async function findTenantByCustomDomain(
  domain: string
): Promise<string | null> {
  // 이 함수는 실제 구현 시 Prisma를 사용하여 DB 조회
  // 순환 참조 방지를 위해 여기서는 인터페이스만 정의
  // 실제 구현은 lib/tenant.ts에서 수행
  throw new Error('findTenantByCustomDomain은 lib/tenant.ts에서 구현해야 합니다.');
}
