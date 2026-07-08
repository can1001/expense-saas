import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { deriveRequestTeam } from '@/lib/domain/request-team';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * POST /api/expenses/[id]/duplicate - 지출결의서 복제
 *
 * 본인이 작성한 지출결의서를 복제하여 새로운 DRAFT 상태의 지출결의서를 생성합니다.
 *
 * 복제 항목:
 * - 예산 정보 (위원회, 사역팀, 항/목/세목)
 * - 세부 항목 (적요, 단가, 수량, 금액)
 * - 청구인 정보 (이름, 직책)
 * - 은행 정보 (은행명, 계좌번호, 예금주)
 * - 첨부파일 (URL 참조 복사)
 *
 * 제외 항목:
 * - 청구일자 → 오늘 날짜로 설정
 * - 서명 → 새로 받아야 함
 * - 지출일자 → null로 초기화
 * - 결재선/결재 상태 → 생성하지 않음
 */
const handlePost: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params!;
    const currentUser = user;

    // 원본 지출결의서 조회
    const original = await prisma.expense.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!original) {
      throw new ApiError('지출결의서를 찾을 수 없습니다.', 404);
    }

    // 본인 확인
    if (original.userId !== currentUser.id) {
      throw new ApiError('본인이 작성한 지출결의서만 복제할 수 있습니다.', 403);
    }

    // 청구팀 자동 생성
    const requestTeam = deriveRequestTeam(original.committee, original.department);
    if (!requestTeam) {
      throw new ApiError('청구팀을 생성할 수 없습니다.', 400);
    }

    // 오늘 날짜
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 트랜잭션으로 복제 실행
    const duplicated = await prisma.$transaction(async (tx) => {
      // 1. 새 지출결의서 생성
      const newExpense = await tx.expense.create({
        data: {
          userId: currentUser.id,
          committee: original.committee,
          department: original.department,
          expenseDate: null, // 지출일자 초기화
          requestAmount: original.requestAmount,
          requestDate: today, // 오늘 날짜
          requestTeam: requestTeam,
          applicantName: original.applicantName,
          applicantTitle: original.applicantTitle,
          bankName: original.bankName,
          accountNumber: original.accountNumber,
          accountHolder: original.accountHolder,
          status: 'DRAFT', // 항상 DRAFT로 생성
          // 서명 데이터 제외 (applicantSignatureType, applicantSignatureData)
          version: original.version,
        },
      });

      // 2. 세부 항목 복제
      if (original.items.length > 0) {
        await tx.expenseItem.createMany({
          data: original.items.map((item) => ({
            expenseId: newExpense.id,
            budgetCategory: item.budgetCategory,
            budgetSubcategory: item.budgetSubcategory,
            budgetDetail: item.budgetDetail,
            description: item.description,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            amount: item.amount,
            order: item.order,
          })),
        });
      }

      // 3. 첨부파일 복제 (URL 참조 복사)
      if (original.attachments.length > 0) {
        await tx.expenseAttachment.createMany({
          data: original.attachments.map((att) => ({
            expenseId: newExpense.id,
            publicId: att.publicId,
            url: att.url,
            secureUrl: att.secureUrl,
            format: att.format,
            fileName: att.fileName,
            fileSize: att.fileSize,
            width: att.width,
            height: att.height,
          })),
        });
      }

      return newExpense;
    });

    // 생성된 지출결의서 전체 조회
    const result = await prisma.expense.findUnique({
      where: { id: duplicated.id },
      include: {
        items: { orderBy: { order: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });

    return NextResponse.json({
      success: true,
      message: '지출결의서가 복제되었습니다.',
      expense: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const POST = withAuth(handlePost);
