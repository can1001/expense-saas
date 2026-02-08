import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateExcelBuffer,
  generateExcelFilename,
  ExpenseForExcel,
  generateWooriBankBuffer,
  generateWooriBankFilename,
  ExpenseForWooriBank,
} from '@/lib/excel-export';

/**
 * GET /api/expenses/export/excel
 * 지출결의서 엑셀 다운로드
 *
 * Query params:
 * - ids: 지출결의서 ID 목록 (쉼표 구분)
 * - status: 상태 필터 (기본값: APPROVED_FINAL)
 * - startDate: 시작일 (YYYY-MM-DD)
 * - endDate: 종료일 (YYYY-MM-DD)
 * - expenseDate: 사용자 지정 지출일자 (YYYY-MM-DD)
 * - useSameDate: true면 모든 항목에 expenseDate 적용
 * - format: 엑셀 양식 (default: 웹교적, woori: 우리은행 대량이체)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 쿼리 파라미터 파싱
    const idsParam = searchParams.get('ids');
    const status = searchParams.get('status') || 'APPROVED_FINAL';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const expenseDateParam = searchParams.get('expenseDate');
    const useSameDateParam = searchParams.get('useSameDate');
    const format = searchParams.get('format') || 'default'; // 'default' | 'woori'

    // 사용자 지정 날짜
    const overrideDate = expenseDateParam ? new Date(expenseDateParam) : undefined;
    const useSameDate = useSameDateParam === 'true';

    // where 조건 구성
    const where: any = {};

    // ID 목록이 있으면 해당 건만 조회
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        where.id = { in: ids };
      }
    }

    // 상태 필터 (all이 아닌 경우)
    if (status !== 'all') {
      where.status = status;
    }

    // 기간 필터
    if (startDateParam || endDateParam) {
      where.requestDate = {};
      if (startDateParam) {
        where.requestDate.gte = new Date(startDateParam);
      }
      if (endDateParam) {
        // 종료일은 해당일 23:59:59까지 포함
        const endDate = new Date(endDateParam);
        endDate.setHours(23, 59, 59, 999);
        where.requestDate.lte = endDate;
      }
    }

    // 지출결의서 조회
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { requestDate: 'desc' },
    });

    if (expenses.length === 0) {
      return NextResponse.json(
        { error: '내보낼 지출결의서가 없습니다.' },
        { status: 404 }
      );
    }

    let buffer: Buffer;
    let filename: string;

    // 우리은행 대량이체 양식
    if (format === 'woori') {
      const expensesForWoori: ExpenseForWooriBank[] = expenses.map((expense) => ({
        bankName: expense.bankName,
        accountNumber: expense.accountNumber,
        accountHolder: expense.accountHolder,
        requestAmount: expense.requestAmount,
      }));

      buffer = generateWooriBankBuffer(expensesForWoori);
      filename = generateWooriBankFilename();
    } else {
      // 기본 (웹교적 지출재정) 양식
      const expensesForExcel: ExpenseForExcel[] = expenses.map((expense) => ({
        accountHolder: expense.accountHolder,
        bankName: expense.bankName,
        accountNumber: expense.accountNumber,
        expenseDate: expense.expenseDate,
        requestDate: expense.requestDate,
        items: expense.items.map((item) => ({
          budgetCategory: item.budgetCategory,
          budgetSubcategory: item.budgetSubcategory,
          budgetDetail: item.budgetDetail,
          description: item.description,
          amount: item.amount,
        })),
      }));

      buffer = generateExcelBuffer(
        expensesForExcel,
        useSameDate ? overrideDate : undefined
      );

      const startDate = startDateParam ? new Date(startDateParam) : undefined;
      const endDate = endDateParam ? new Date(endDateParam) : undefined;
      filename = generateExcelFilename(expensesForExcel, startDate, endDate);
    }

    // 엑셀 파일 응답 (Buffer를 Uint8Array로 변환)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error: any) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { error: '엑셀 내보내기 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
