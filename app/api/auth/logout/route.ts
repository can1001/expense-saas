import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';
import { createUserLogoutCookie } from '@/lib/auth/user';

// POST /api/auth/logout - 사용자 로그아웃
export async function POST() {
  try {
    // 기존 세션 삭제 (호환성)
    await deleteSession();

    const response = NextResponse.json({
      success: true,
      message: '로그아웃 되었습니다.',
    });

    // JWT 쿠키 삭제
    response.headers.set('Set-Cookie', createUserLogoutCookie());

    return response;
  } catch {
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
