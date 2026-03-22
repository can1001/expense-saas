import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createUser, findUserByUserid, checkCanRegisterUsers, DEFAULT_PASSWORD } from '@/lib/services/user-service';

// 아이디 접두사
const USERID_PREFIX = '청연';

/**
 * POST /api/users/quick-register
 * 간편 사용자 등록 (이름만 입력하면 자동 등록)
 */
export async function POST(request: NextRequest) {
  try {
    // 현재 사용자 확인
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 사용자 등록 권한 확인
    const hasPermission = await checkCanRegisterUsers(currentUser.id);
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: '사용자 등록 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    // 이름 유효성 검사
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // 아이디 생성 (청연 + 이름)
    const userid = `${USERID_PREFIX}${trimmedName}`;

    // 아이디 중복 체크
    const existingUser = await findUserByUserid(userid);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: `이미 등록된 사용자입니다: ${userid}` },
        { status: 409 }
      );
    }

    // 사용자 생성
    const newUser = await createUser({
      userid,
      username: trimmedName,
      role: 'user',
      password: DEFAULT_PASSWORD,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        userid: newUser.userid,
        username: newUser.username,
        role: newUser.role,
      },
      message: `사용자가 등록되었습니다.\n아이디: ${userid}\n기본 비밀번호: ${DEFAULT_PASSWORD}`,
    });
  } catch (error) {
    console.error('Quick register error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
