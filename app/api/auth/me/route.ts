import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserFromRequest, deriveLegacyFlags } from '@/lib/auth/user';
import { prisma } from '@/lib/prisma';
import { getEffectiveRole, getUserAllYearRoles, CURRENT_YEAR } from '@/lib/services/user-service';
import { PERMISSIONS, subjectPermissions } from '@/lib/auth/permissions';

export async function GET(request: NextRequest) {
  try {
    // 1. JWT 토큰에서 사용자 확인 (새 방식)
    const jwtUser = await getUserFromRequest(request);

    // 2. 기존 세션에서 사용자 확인 (호환성)
    const sessionUser = await getCurrentUser();

    // 둘 중 하나라도 없으면 미인증
    const userId = jwtUser?.id || sessionUser?.id;

    if (!userId) {
      return NextResponse.json({ user: null });
    }

    // 사용자 정보와 역할 정보 함께 조회
    const userWithRole = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });

    if (!userWithRole) {
      return NextResponse.json({ user: null });
    }

    // 연도별 유효 역할 조회 (UserYearRole 테이블 기준)
    const { role: effectiveRole, departmentId: effectiveDepartmentId } =
      await getEffectiveRole(userId, CURRENT_YEAR);

    // 모든 연도별 역할 조회 (다중 역할 지원)
    const allRoles = await getUserAllYearRoles(userId, CURRENT_YEAR);

    // 기본 계좌 조회 (없으면 null)
    let defaultBankAccount = null;
    try {
      defaultBankAccount = await prisma.savedBankAccount.findFirst({
        where: {
          userId: userId,
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

    // 권한 정보: effective 역할 + 개별 부여(canRegisterUsers)로부터 파생 (단일 출처)
    const effectiveRoles = Array.from(new Set([effectiveRole, ...allRoles]));
    const granted = userWithRole.canRegisterUsers ? [PERMISSIONS.USER_REGISTER] : [];
    const permissions = deriveLegacyFlags(effectiveRoles, granted);
    const permissionCodes = Array.from(subjectPermissions({ roles: effectiveRoles, granted }));

    return NextResponse.json({
      user: {
        id: userWithRole.id,
        userid: userWithRole.userid,
        username: userWithRole.username,
        role: effectiveRole,
        roles: allRoles,
        department: effectiveDepartment ?? userWithRole.department,
        departmentId: effectiveDepartmentId,
        defaultBankAccount,
        permissions,
        permissionCodes,
        // 하위 호환성
        canRegisterUsers: permissions.canRegisterUsers,
      },
      tenant: userWithRole.tenant,
    });
  } catch (error) {
    console.error('auth/me error:', error);
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
