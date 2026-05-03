import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// 로그인이 필요한 경로
const protectedPaths = ['/expenses', '/approvals'];

// 로그인 후 접근 불가 경로
const authPaths = ['/login'];

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

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
