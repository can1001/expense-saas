import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// 로그인이 필요한 경로
const protectedPaths = ['/expenses', '/approvals', '/recurring-expenses'];

// 로그인 후 접근 불가 경로
const authPaths = ['/login'];

// tenant 설정이 불필요한 API 경로 (플랫폼 레벨)
const platformApiPaths = ['/api/platform', '/api/super-admin'];

// 세션 서명용 비밀키 (Edge Runtime에서 사용)
function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET 환경변수가 프로덕션에서 필수입니다.');
    }
    return new TextEncoder().encode('dev-only-secret-do-not-use-in-production');
  }
  return new TextEncoder().encode(secret);
}

// JWT 토큰 검증
async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSessionSecret());
    return true;
  } catch {
    return false;
  }
}

// 테넌트 서브도메인으로 취급하지 않는 PaaS/플랫폼 기본 도메인.
// 이 도메인들의 첫 라벨은 배포 서비스명이지 테넌트가 아니다.
const PLATFORM_BASE_DOMAINS = ['onrender.com', 'vercel.app', 'netlify.app'];

/**
 * subdomain 추출
 * @param host 호스트 헤더 (예: chungyeon.expense-saas.com)
 */
function extractSubdomain(host: string | null): string | null {
  if (!host) return null;

  // 포트 제거 (예: chungyeon.expense-saas.com:3000)
  const hostname = host.split(':')[0];

  // localhost 개발 환경 처리
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
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

  // 최소 3개 파트가 필요 (subdomain.domain.com)
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

export async function proxy(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host');

  // 요청 헤더에 tenant 정보 추가 (API 라우트에서 사용)
  const requestHeaders = new Headers(request.headers);

  // subdomain 추출
  const subdomain = extractSubdomain(host);

  // 개발 환경에서 쿼리 파라미터로 tenant 지정 가능
  const tenantParam = request.nextUrl.searchParams.get('tenant');

  // tenant 정보를 헤더에 추가 (API 라우트에서 사용)
  if (subdomain) {
    requestHeaders.set('x-tenant-subdomain', subdomain);
  }
  if (tenantParam) {
    requestHeaders.set('x-tenant-param', tenantParam);
  }

  // 플랫폼 레벨 API는 tenant 검증 건너뜀
  if (platformApiPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // API 라우트는 인증 미들웨어 건너뜀 (API 핸들러에서 처리)
  if (pathname.startsWith('/api')) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 보호된 경로 접근 시 로그인 필요
  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    if (!session?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // JWT 토큰 유효성 검증
    const isValid = await verifySessionToken(session.value);
    if (!isValid) {
      // 무효한 토큰 - 쿠키 삭제 후 로그인 페이지로 리다이렉트
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('session');
      return response;
    }
  }

  // 로그인 상태에서 로그인 페이지 접근 시 리다이렉트
  if (authPaths.includes(pathname) && session?.value) {
    const isValid = await verifySessionToken(session.value);
    if (isValid) {
      return NextResponse.redirect(new URL('/expenses', request.url));
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // 모든 경로에 미들웨어 적용 (정적 파일 제외)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|logo).*)'],
};
