import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUserId } from '@/lib/auth';
import { findUserById, updateUser } from '@/lib/services/user-service';

export async function POST(request: Request) {
  try {
    // 1. 로그인 확인
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 2. 요청 데이터 파싱
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { error: '현재 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: '새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: '새 비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 3. 사용자 조회 (password 포함)
    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: '비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 400 }
      );
    }

    // 4. 현재 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 5. 새 비밀번호로 업데이트
    await updateUser(userId, { password: newPassword });

    return NextResponse.json({
      success: true,
      message: '비밀번호가 변경되었습니다.',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
