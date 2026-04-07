import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEffectiveRole, getUserAllYearRoles, CURRENT_YEAR } from '@/lib/services/user-service';

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

    // 연도별 유효 역할 조회 (UserYearRole 테이블 기준)
    const { role: effectiveRole, departmentId: effectiveDepartmentId } =
      await getEffectiveRole(user.id, CURRENT_YEAR);

    // 모든 연도별 역할 조회 (다중 역할 지원)
    const allRoles = await getUserAllYearRoles(user.id, CURRENT_YEAR);

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

    // departmentId가 있으면 해당 부서 이름 조회
    let effectiveDepartment: string | null = null;
    if (effectiveDepartmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: effectiveDepartmentId },
        include: { committee: { select: { name: true } } },
      });
      if (dept) {
        effectiveDepartment = `${dept.committee.name}/${dept.name}`;
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: effectiveRole,  // 연도별 유효 역할 (대표 역할)
        roles: allRoles,      // 모든 연도별 역할 (다중 역할 지원)
        department: effectiveDepartment ?? user.department,
        departmentId: effectiveDepartmentId,  // 부서 ID도 함께 반환
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
