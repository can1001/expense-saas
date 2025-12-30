import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    // 기본 계좌 조회
    const defaultBankAccount = await prisma.savedBankAccount.findFirst({
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

    return NextResponse.json({
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: user.role,
        department: user.department,
        defaultBankAccount,
      },
    });
  } catch {
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
