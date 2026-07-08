import { NextRequest, NextResponse } from 'next/server';
import { findTenantBySubdomain } from './tenant';
import { getTenantContext, TenantContext, withTenantAsync } from './tenant-context';

// API 핸들러 타입
type ApiHandler<T = unknown> = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<T>>;

// Tenant 정보가 포함된 API 핸들러 타입
type TenantApiHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>>; tenant: TenantContext | undefined }
) => Promise<NextResponse<T>>;

/**
 * 요청에서 tenant 정보 추출
 * 미들웨어가 설정한 헤더 또는 쿼리 파라미터에서 추출
 */
async function resolveTenantFromRequest(request: NextRequest): Promise<TenantContext | null> {
  // 1. 미들웨어가 설정한 헤더 확인
  const subdomainHeader = request.headers.get('x-tenant-subdomain');
  const tenantParamHeader = request.headers.get('x-tenant-param');

  // 2. 쿼리 파라미터 확인 (개발 환경용)
  const url = new URL(request.url);
  const tenantParam = tenantParamHeader || url.searchParams.get('tenant');

  // 테넌트 파라미터 우선
  if (tenantParam) {
    return findTenantBySubdomain(tenantParam);
  }

  // subdomain 사용
  if (subdomainHeader) {
    return findTenantBySubdomain(subdomainHeader);
  }

  return null;
}

/**
 * API 라우트에 tenant 컨텍스트를 자동으로 적용하는 래퍼
 *
 * 사용법:
 * ```typescript
 * export const GET = withTenant(async (request, { tenant }) => {
 *   // tenant.tenantId 사용 가능
 *   // prisma 쿼리는 자동으로 tenantId 필터 적용
 *   const users = await prisma.user.findMany();
 *   return NextResponse.json(users);
 * });
 * ```
 */
export function withTenant<T = unknown>(handler: TenantApiHandler<T>): ApiHandler<T> {
  return async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    // 요청에서 tenant 정보 추출
    const tenant = await resolveTenantFromRequest(request);

    if (!tenant) {
      // 테넌트 컨텍스트 없이 실행 (필터링 없음)
      return handler(request, {
        params: context?.params ?? Promise.resolve({}),
        tenant: undefined,
      });
    }

    // tenant 컨텍스트 내에서 핸들러 실행
    return withTenantAsync(tenant, async () => {
      return handler(request, {
        params: context?.params ?? Promise.resolve({}),
        tenant,
      });
    });
  };
}

/**
 * Tenant가 필수인 API 라우트 래퍼
 * tenant가 없으면 401 에러 반환
 */
export function withRequiredTenant<T = unknown>(
  handler: (
    request: NextRequest,
    context: { params: Promise<Record<string, string>>; tenant: TenantContext }
  ) => Promise<NextResponse<T>>
): ApiHandler<T | { error: string }> {
  return withTenant(async (request, { params, tenant }) => {
    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다. 올바른 도메인으로 접속해주세요.' },
        { status: 401 }
      ) as NextResponse<T | { error: string }>;
    }

    return handler(request, { params, tenant }) as Promise<NextResponse<T | { error: string }>>;
  });
}

/**
 * API 에러 응답 헬퍼
 */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * API 성공 응답 헬퍼
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * 요청 본문 파싱 헬퍼 (에러 핸들링 포함)
 */
export async function parseBody<T>(request: NextRequest): Promise<T | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * 페이지네이션 파라미터 파싱
 */
export function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * 정렬 파라미터 파싱
 */
export function parseSort(url: URL, allowedFields: string[], defaultField: string = 'createdAt') {
  const sortBy = url.searchParams.get('sortBy') || defaultField;
  const sortOrder = (url.searchParams.get('sortOrder') || 'desc').toLowerCase();

  // 허용된 필드만 사용
  const field = allowedFields.includes(sortBy) ? sortBy : defaultField;
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  return { [field]: order };
}

/**
 * 현재 tenant 정보 가져오기 (API 핸들러 내에서 사용)
 * withTenant 또는 withRequiredTenant 래퍼 내에서만 사용 가능
 */
export function getCurrentTenant(): TenantContext | undefined {
  return getTenantContext();
}

/**
 * 현재 tenantId 가져오기 (API 핸들러 내에서 사용)
 */
export function getCurrentTenantId(): string | undefined {
  return getTenantContext()?.tenantId;
}
