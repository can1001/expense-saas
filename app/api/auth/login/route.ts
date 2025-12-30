import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { findUserByUserid } from '@/lib/services/user-service';

export async function POST(request: Request) {
  try {
    const { userid } = await request.json();

    if (!userid || typeof userid !== 'string') {
      return NextResponse.json(
        { error: '사용자 아이디가 필요합니다.' },
        { status: 400 }
      );
    }

    // DB에서 사용자 조회 (비동기)
    const user = await findUserByUserid(userid);
    if (!user) {
      return NextResponse.json(
        { error: '존재하지 않는 사용자입니다.' },
        { status: 401 }
      );
    }

    // 비활성화된 사용자 체크
    if (!user.isActive) {
      return NextResponse.json(
        { error: '비활성화된 사용자입니다.' },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        userid: user.userid,
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
