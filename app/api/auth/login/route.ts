import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { findUserByUsername } from '@/lib/users';

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: '사용자 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    const user = findUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: '존재하지 않는 사용자입니다.' },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        department: user.department,
      },
    });
  } catch {
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
