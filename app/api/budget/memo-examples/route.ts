import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/budget/memo-examples?budgetDetailId=xxx
 * 세목의 적요 예제 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const budgetDetailId = searchParams.get('budgetDetailId');
    const budgetDetailName = searchParams.get('budgetDetailName');

    if (!budgetDetailId && !budgetDetailName) {
      return NextResponse.json(
        { error: 'budgetDetailId 또는 budgetDetailName이 필요합니다.' },
        { status: 400 }
      );
    }

    let budgetDetail = null;

    // ID로 조회
    if (budgetDetailId) {
      budgetDetail = await prisma.budgetDetail.findUnique({
        where: { id: budgetDetailId },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });
    }

    // 이름으로 조회 (ID가 없거나 찾지 못한 경우)
    if (!budgetDetail && budgetDetailName) {
      budgetDetail = await prisma.budgetDetail.findFirst({
        where: { name: budgetDetailName },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });
    }

    if (!budgetDetail) {
      return NextResponse.json(
        { examples: [], budgetDetail: null },
        { status: 200 }
      );
    }

    // description 필드를 콤마로 분리하여 예제 목록 생성
    const examples = budgetDetail.description
      ? budgetDetail.description
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    return NextResponse.json({
      examples,
      budgetDetail: {
        id: budgetDetail.id,
        name: budgetDetail.name,
      },
    });
  } catch (error) {
    console.error('적요 예제 조회 실패:', error);
    return NextResponse.json(
      { error: '적요 예제 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
