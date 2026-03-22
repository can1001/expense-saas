import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    // 사용자 정보와 역할 정보 함께 조회
    const userWithRole = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roleRef: {
          select: {
            canRegisterUsers: true,
          },
        },
      },
    });

    // 기본 계좌 조회 (없으면 null)
    let defaultBankAccount = null;
    try {
      defaultBankAccount = await prisma.savedBankAccount.findFirst({
        where: {
          userId: user.id,
          isDefault: true,
        },
        select: {
          id: true,
          bankName: true,
          accountNumber: true,
          accountHolder: true,
          nickname: true,
        },
      });
    } catch {
      // 계좌 조회 실패 시 null 유지
    }

    return NextResponse.json({
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: user.role,
        department: user.department,
        defaultBankAccount,
        canRegisterUsers: userWithRole?.canRegisterUsers ?? false,
        roleRef: userWithRole?.roleRef ?? null,
      },
    });
  } catch (error) {
    console.error('auth/me error:', error);
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
