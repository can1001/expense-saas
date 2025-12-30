import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';
import { findUserByUserid } from '@/lib/services/user-service';

export async function POST(request: Request) {
  try {
    const { userid, password } = await request.json();

    if (!userid || typeof userid !== 'string') {
      return NextResponse.json(
        { error: '아이디를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: '비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // DB에서 사용자 조회
    const user = await findUserByUserid(userid);
    if (!user) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
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

    // 비밀번호가 설정되지 않은 경우
    if (!user.password) {
      return NextResponse.json(
        { error: '비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 401 }
      );
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
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
