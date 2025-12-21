import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 로그인이 필요한 경로
const protectedPaths = ['/expenses', '/approvals'];

// 로그인 후 접근 불가 경로
const authPaths = ['/login'];

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // 보호된 경로 접근 시 로그인 필요
  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 로그인 상태에서 로그인 페이지 접근 시 리다이렉트
  if (authPaths.includes(pathname) && session) {
    return NextResponse.redirect(new URL('/expenses', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
