import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withPermissions, UserApiHandler } from '@/lib/auth/user';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { areAllItemsReceiptExempt } from '@/lib/constants/receipt-exempt-details';

// GET /api/receipts/missing - 영수증 미첨부 결의서 목록 (예외 세목만인 건 제외)
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where: Prisma.ExpenseWhereInput = {
      attachments: { none: {} },
    };

    // 기간(월) 필터: YYYY-MM
    const month = searchParams.get('month');
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      if (year && mon) {
        where.requestDate = {
          gte: new Date(year, mon - 1, 1),
          lt: new Date(year, mon, 1),
        };
      }
    }

    const department = searchParams.get('department');
    if (department) where.department = department;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { requestDate: 'desc' },
      select: {
        id: true,
        applicantName: true,
        department: true,
        committee: true,
        requestAmount: true,
        status: true,
        requestDate: true,
        items: { select: { budgetDetail: true } },
      },
    });

    const missing = expenses.filter((expense) => !areAllItemsReceiptExempt(expense.items));

    const total = missing.length;
    const skip = (page - 1) * limit;
    const paged = missing.slice(skip, skip + limit);

    const results = paged.map((expense) => ({
      expenseId: expense.id,
      applicantName: expense.applicantName,
      department: expense.department,
      committee: expense.committee,
      requestAmount: expense.requestAmount,
      status: expense.status,
      requestDate: expense.requestDate,
    }));

    return NextResponse.json({
      expenses: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withPermissions(PERMISSIONS.RECEIPT_READ, handleGet);
