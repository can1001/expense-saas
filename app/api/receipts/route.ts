import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withPermissions, UserApiHandler } from '@/lib/auth/user';
import { PERMISSIONS } from '@/lib/auth/permissions';

// GET /api/receipts - 영수증 목록 조회 (갤러리)
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const expenseWhere: Prisma.ExpenseWhereInput = {};

    // 기간(월) 필터: YYYY-MM
    const month = searchParams.get('month');
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      if (year && mon) {
        expenseWhere.requestDate = {
          gte: new Date(year, mon - 1, 1),
          lt: new Date(year, mon, 1),
        };
      }
    }

    const department = searchParams.get('department');
    if (department) expenseWhere.department = department;

    const status = searchParams.get('status');
    if (status) expenseWhere.status = status as Prisma.ExpenseWhereInput['status'];

    const where: Prisma.ExpenseAttachmentWhereInput = { expense: expenseWhere };

    const [attachments, total] = await Promise.all([
      prisma.expenseAttachment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          url: true,
          secureUrl: true,
          fileName: true,
          format: true,
          expenseId: true,
          expense: {
            select: {
              department: true,
              committee: true,
              requestAmount: true,
              status: true,
              applicantName: true,
              requestDate: true,
            },
          },
        },
      }),
      prisma.expenseAttachment.count({ where }),
    ]);

    const receipts = attachments.map((a) => ({
      id: a.id,
      url: a.url,
      secureUrl: a.secureUrl,
      fileName: a.fileName,
      format: a.format,
      expenseId: a.expenseId,
      department: a.expense.department,
      committee: a.expense.committee,
      requestAmount: a.expense.requestAmount,
      status: a.expense.status,
      applicantName: a.expense.applicantName,
      requestDate: a.expense.requestDate,
    }));

    return NextResponse.json({
      receipts,
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
