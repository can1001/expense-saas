import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findUserById, updateUser } from '@/lib/services/user-service';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const userId = user.id;

    // 요청 데이터 파싱
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
    const dbUser = await findUserById(userId);
    if (!dbUser) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!dbUser.password) {
      return NextResponse.json(
        { error: '비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 400 }
      );
    }

    // 4. 현재 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 5. 새 비밀번호로 업데이트 — 배정 비번 강제 변경 플래그도 함께 해제
    await updateUser(userId, { password: newPassword, mustChangePassword: false });

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
};

export const POST = withAuth(handlePost);
