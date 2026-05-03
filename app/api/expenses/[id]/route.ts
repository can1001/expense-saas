import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateExpenseSchema, calculateAmount, calculateTotal } from '@/lib/validators';
import { deleteImages } from '@/lib/cloudinary';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { deriveRequestTeam } from '@/lib/domain/request-team';
import { getSessionUserId, getCurrentUser } from '@/lib/auth';
import { maskAccountNumber } from '@/lib/utils';
import { getEffectiveRole, CURRENT_YEAR } from '@/lib/services/user-service';
import { APPROVED_EDIT_ROLES } from '@/lib/constants/menu-permissions';

// GET /api/expenses/[id] - 지출결의서 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: {
            order: 'asc',
          },
        },
        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!expense) {
      throw new ApiError('지출결의서를 찾을 수 없습니다.', 404);
    }

    // 현재 로그인한 사용자 확인
    const currentUserId = await getSessionUserId();
    const isOwner = currentUserId && expense.userId === currentUserId;

    // 계좌번호 열람 권한이 있는 역할 (프린트 시 계좌번호 전체 표시 필요)
    const ACCOUNT_VIEW_ROLES = ['admin', 'finance_head', 'accountant', 'admin_assistant'];

    // 계좌번호 열람 권한 확인 (연도별 유효 역할 기준)
    let canViewAccount = isOwner;
    if (currentUserId && !canViewAccount) {
      const { role: effectiveRole } = await getEffectiveRole(currentUserId, CURRENT_YEAR);
      canViewAccount = ACCOUNT_VIEW_ROLES.includes(effectiveRole);
    }

    // 계좌번호 열람 권한이 없는 경우에만 마스킹
    if (!canViewAccount) {
      return NextResponse.json({
        ...expense,
        accountNumber: maskAccountNumber(expense.accountNumber),
      });
    }

    return NextResponse.json(expense);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/expenses/[id] - 지출결의서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 유효성 검증
    const validatedData = updateExpenseSchema.parse(body);

    // 현재 데이터 조회 (상태 확인 및 청구팀 자동 생성/검증을 위해)
    const existing = await prisma.expense.findUnique({
      where: { id },
      select: { status: true, paymentStatus: true, committee: true, department: true, applicantName: true },
    });
    if (!existing) {
      throw new ApiError('지출결의서를 찾을 수 없습니다.', 404);
    }

    // 수정 가능한 상태인지 확인
    const BASIC_EDITABLE = ['DRAFT', 'REJECTED', 'WITHDRAWN'];
    const isBasicEditable = BASIC_EDITABLE.includes(existing.status);
    const isApprovedPending = existing.status === 'APPROVED_FINAL' &&
                              existing.paymentStatus === 'PENDING';

    // 최종승인 + 지급대기 상태에서는 역할 체크 필요 (연도별 유효 역할 기준)
    let canEditApprovedPending = false;
    if (isApprovedPending) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const { role: effectiveRole } = await getEffectiveRole(currentUser.id, CURRENT_YEAR);
        canEditApprovedPending = APPROVED_EDIT_ROLES.includes(effectiveRole as any);
      }
    }

    if (!isBasicEditable && !canEditApprovedPending) {
      throw new ApiError('이 상태에서는 수정할 수 없습니다.', 403);
    }

    const finalCommittee = validatedData.committee ?? existing.committee;
    const finalDepartment = validatedData.department ?? existing.department;
    const derivedRequestTeam = deriveRequestTeam(finalCommittee, finalDepartment);
    if (!derivedRequestTeam) {
      throw new ApiError('청구팀을 생성할 수 없습니다. 위원회/사역팀을 확인해주세요.', 400);
    }

    // requestTeam을 직접 보내는 경우에도 규칙 위반이면 거부
    if (
      typeof body.requestTeam === 'string' &&
      body.requestTeam.trim() !== '' &&
      body.requestTeam !== derivedRequestTeam
    ) {
      throw new ApiError('청구팀은 선택한 위원회/사역팀과 동일해야 합니다.', 400);
    }

    const shouldUpdateRequestTeam =
      validatedData.committee !== undefined ||
      validatedData.department !== undefined ||
      validatedData.requestTeam !== undefined;

    // 기존 항목 삭제
    await prisma.expenseItem.deleteMany({
      where: { expenseId: id },
    });

    // 항목별 금액 계산 및 순서 할당 (항/목/세목 포함)
    const itemsWithCalculatedAmount = validatedData.items?.map((item, index) => ({
      budgetCategory: item.budgetCategory,
      budgetSubcategory: item.budgetSubcategory,
      budgetDetail: item.budgetDetail,
      description: item.description,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      amount: calculateAmount(item.unitPrice, item.quantity),
      order: index + 1,
    })) || [];

    // 전체 청구금액 계산
    const requestAmount = itemsWithCalculatedAmount.length > 0
      ? calculateTotal(itemsWithCalculatedAmount)
      : undefined;

    // 상태 처리: 최종승인 + 지급대기 상태에서는 상태 변경하지 않음
    const statusUpdate: { status?: 'DRAFT' | 'PENDING'; submittedAt?: Date | null } = {};
    if (!canEditApprovedPending) {
      if (body.status === 'PENDING') {
        statusUpdate.status = 'PENDING';
        statusUpdate.submittedAt = new Date();
      } else if (body.status === 'DRAFT') {
        statusUpdate.status = 'DRAFT';
        // submittedAt은 그대로 유지 (재저장 시)
      }
    }

    // 데이터베이스 업데이트 (budgetCategory, budgetSubcategory는 items에만 저장)
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(validatedData.committee && { committee: validatedData.committee }),
        ...(validatedData.department && { department: validatedData.department }),
        ...(validatedData.expenseDate !== undefined && { expenseDate: validatedData.expenseDate }),
        ...(requestAmount !== undefined && { requestAmount }),
        ...(validatedData.requestDate && { requestDate: validatedData.requestDate }),
        ...(shouldUpdateRequestTeam && { requestTeam: derivedRequestTeam }),
        ...(validatedData.applicantName && { applicantName: validatedData.applicantName }),
        ...(validatedData.applicantTitle !== undefined && { applicantTitle: validatedData.applicantTitle }),
        ...(validatedData.bankName && { bankName: validatedData.bankName }),
        ...(validatedData.accountNumber && { accountNumber: validatedData.accountNumber }),
        ...(validatedData.accountHolder && { accountHolder: validatedData.accountHolder }),
        ...statusUpdate,
        ...(itemsWithCalculatedAmount.length > 0 && {
          items: {
            create: itemsWithCalculatedAmount,
          },
        }),
      },
      include: {
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    // 최종승인 + 지급대기 상태에서 수정한 경우 감사 로그 기록
    if (canEditApprovedPending) {
      await prisma.approvalLog.create({
        data: {
          expenseId: id,
          action: 'MODIFY_CONTENT',
          actorName: validatedData.applicantName || existing.applicantName,
          previousStatus: existing.status,
          newStatus: existing.status,
          comment: '최종승인 후 내용 수정',
          metadata: {
            modifiedAt: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json(expense);
  } catch (error: any) {
    if (error.name === 'ZodError' && error.errors) {
      const errorMessages = error.errors.map((err: any) =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return NextResponse.json(
        { error: '입력 데이터가 유효하지 않습니다.', details: errorMessages },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}

// 수정/삭제 가능한 상태
const EDITABLE_STATUSES = ['DRAFT', 'REJECTED', 'WITHDRAWN'];

// DELETE /api/expenses/[id] - 지출결의서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 상태 확인
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!expense) {
      throw new ApiError('지출결의서를 찾을 수 없습니다.', 404);
    }

    if (!EDITABLE_STATUSES.includes(expense.status)) {
      throw new ApiError('제출된 지출결의서는 삭제할 수 없습니다.', 403);
    }

    // 첨부파일 정보 가져오기
    const attachments = await prisma.expenseAttachment.findMany({
      where: { expenseId: id },
      select: { publicId: true },
    });

    // Cloudinary에서 이미지 삭제
    if (attachments.length > 0) {
      const publicIds = attachments.map(att => att.publicId);
      try {
        await deleteImages(publicIds);
      } catch (cloudinaryError) {
        console.error('Error deleting images from Cloudinary:', cloudinaryError);
        // Cloudinary 삭제 실패해도 DB는 삭제 진행
      }
    }

    // 데이터베이스에서 지출결의서 삭제 (Cascade로 첨부파일도 함께 삭제됨)
    await prisma.expense.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
