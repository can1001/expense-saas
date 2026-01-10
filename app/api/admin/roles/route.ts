import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * GET /api/admin/roles
 * 역할 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const roles = await prisma.role.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            userYearRoles: true,
          },
        },
      },
    });

    return NextResponse.json(roles);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/roles
 * 역할 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      code,
      name,
      description,
      stepNumber,
      sortOrder,
      canApprove,
      canManageExpense,
      canAccessAdmin,
      canExportData,
    } = body;

    // 필수 필드 검증
    if (!code || !name) {
      return NextResponse.json(
        { error: '역할 코드와 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    // 중복 코드 검사
    const existingRole = await prisma.role.findUnique({
      where: { code },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: '이미 존재하는 역할 코드입니다.' },
        { status: 409 }
      );
    }

    const role = await prisma.role.create({
      data: {
        code,
        name,
        description,
        stepNumber: stepNumber ?? null,
        sortOrder: sortOrder ?? 0,
        canApprove: canApprove ?? false,
        canManageExpense: canManageExpense ?? false,
        canAccessAdmin: canAccessAdmin ?? false,
        canExportData: canExportData ?? false,
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
