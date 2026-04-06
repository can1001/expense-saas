import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface BudgetDetailInput {
  name: string;
  description: string;
  accountCode: string;
  managerId: string;
  budgetAmount: number;
}

// POST /api/budget-details - 예산 세목 일괄 등록 (마법사용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { departmentId, subcategoryId, details, year } = body as {
      departmentId: string;
      subcategoryId: string;
      details: BudgetDetailInput[];
      year: number;
    };

    if (!departmentId) {
      return NextResponse.json(
        { error: '사역팀을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!subcategoryId) {
      return NextResponse.json(
        { error: '예산(목)을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!details || details.length === 0) {
      return NextResponse.json(
        { error: '등록할 세목이 없습니다.' },
        { status: 400 }
      );
    }

    const currentYear = year || new Date().getFullYear();

    // 사역팀 존재 확인 + 연도별 팀장 조회
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        yearRoles: {
          where: {
            year: currentYear,
            role: 'team_leader',
          },
          select: { userId: true },
          take: 1,
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: '사역팀을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 서브카테고리 존재 확인
    const subcategory = await prisma.budgetSubcategory.findUnique({
      where: { id: subcategoryId },
    });

    if (!subcategory) {
      return NextResponse.json(
        { error: '예산(목)을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사역팀 팀장 ID (연도별)
    const departmentLeaderId = department.yearRoles[0]?.userId || null;
    const createdDetails: string[] = [];

    // 트랜잭션으로 일괄 생성
    await prisma.$transaction(async (tx) => {
      for (const detail of details) {
        if (!detail.name?.trim()) continue;

        // 마지막 순서 조회
        const lastDetail = await tx.budgetDetail.findFirst({
          where: { subcategoryId },
          orderBy: { sortOrder: 'desc' },
        });

        // 세목 생성
        const budgetDetail = await tx.budgetDetail.create({
          data: {
            subcategoryId,
            name: detail.name.trim(),
            accountCode: detail.accountCode?.trim() || null,
            description: detail.description?.trim() || null,
            sortOrder: (lastDetail?.sortOrder ?? 0) + 1,
          },
        });

        // 연도별 설정 생성 (담당자 + 예산금액)
        // 담당자: 입력값 우선, 없으면 사역팀 팀장을 기본값으로 설정
        const managerId = detail.managerId || departmentLeaderId;

        await tx.budgetDetailYear.create({
          data: {
            budgetDetailId: budgetDetail.id,
            year: currentYear,
            managerId,
            budgetAmount: detail.budgetAmount || 0,
            usedAmount: 0,
          },
        });

        // 사역팀-세목 연결 생성
        await tx.departmentBudgetDetail.create({
          data: {
            departmentId,
            budgetDetailId: budgetDetail.id,
          },
        });

        createdDetails.push(budgetDetail.id);
      }
    });

    return NextResponse.json(
      {
        success: true,
        createdCount: createdDetails.length,
        createdIds: createdDetails,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating budget details:', error);
    return NextResponse.json(
      { error: '예산 세목 등록에 실패했습니다.' },
      { status: 500 }
    );
  }
}
