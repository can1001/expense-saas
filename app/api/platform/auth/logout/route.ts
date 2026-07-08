import { NextResponse } from 'next/server';
import { createLogoutCookie } from '@/lib/auth/super-admin';

// POST /api/platform/auth/logout - SuperAdmin 로그아웃
export async function POST() {
  const response = NextResponse.json({
    message: '로그아웃 되었습니다.',
  });

  // 쿠키 삭제
  response.headers.set('Set-Cookie', createLogoutCookie());

  return response;
}
