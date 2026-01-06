import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByUserid } from '@/lib/services/user-service';

// POST /api/auth/signup - 회원가입
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userid, username, password, department } = body;

    // 필수 필드 검증
    if (!userid?.trim()) {
      return NextResponse.json(
        { error: '아이디를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!username?.trim()) {
      return NextResponse.json(
        { error: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: '비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: '비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 중복 확인
    const existingUser = await findUserByUserid(userid.trim());
    if (existingUser) {
      return NextResponse.json(
        { error: '이미 존재하는 아이디입니다.' },
        { status: 409 }
      );
    }

    // 사용자 생성 (역할은 user로 고정)
    const user = await createUser({
      userid: userid.trim(),
      username: username.trim(),
      password,
      role: 'user', // 회원가입은 항상 일반 사용자
      department: department?.trim() || undefined,
    });

    return NextResponse.json(
      {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: user.role,
        department: user.department,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
