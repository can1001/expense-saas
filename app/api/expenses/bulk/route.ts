import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/expenses/bulk
 * 여러 건의 지출결의서를 일괄 조회 (인쇄용)
 *
 * Body: { ids: string[] }
 * Response: { expenses: ExpenseWithApproval[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '조회할 지출결의서 ID를 선택해주세요.' },
        { status: 400 }
      );
    }

    // 최대 50건 제한
    if (ids.length > 50) {
      return NextResponse.json(
        { error: '한 번에 최대 50건까지 조회할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 병렬로 지출결의서 + 결재정보 조회
    const expensesWithApproval = await Promise.all(
      ids.map(async (id) => {
        const [expense, approvalLine] = await Promise.all([
          prisma.expense.findUnique({
            where: { id },
            include: {
              items: {
                orderBy: { order: 'asc' },
              },
              attachments: {
                orderBy: { createdAt: 'asc' },
              },
            },
          }),
          prisma.approvalLine.findFirst({
            where: { expenseId: id },
            include: {
              steps: {
                orderBy: { stepNumber: 'asc' },
              },
            },
          }),
        ]);

        return { expense, approvalLine };
      })
    );

    // null인 expense 필터링 (삭제된 항목 등)
    const validExpenses = expensesWithApproval.filter(
      (item) => item.expense !== null
    );

    return NextResponse.json({
      success: true,
      expenses: validExpenses,
      total: validExpenses.length,
      requested: ids.length,
    });
  } catch (error: unknown) {
    console.error('Bulk expenses fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: '지출결의서 일괄 조회 중 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}
