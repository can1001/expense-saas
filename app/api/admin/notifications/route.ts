import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { webPushProvider } from '@/lib/services/notification/web-push-provider';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/admin/notifications
 * 어드민 알림 발송 이력 조회
 */
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.adminNotification.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminNotification.count(),
    ]);

    return NextResponse.json({
      notifications,
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

/**
 * POST /api/admin/notifications
 * 어드민 알림 발송
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const body = await request.json();
    const { title, message, targetType, targetValue } = body;

    // 유효성 검사
    if (!title || !message || !targetType) {
      return NextResponse.json(
        { error: '제목, 메시지, 대상 타입은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!['ALL', 'ROLE', 'USER'].includes(targetType)) {
      return NextResponse.json(
        { error: '유효하지 않은 대상 타입입니다.' },
        { status: 400 }
      );
    }

    if ((targetType === 'ROLE' || targetType === 'USER') && !targetValue) {
      return NextResponse.json(
        { error: '대상 값이 필요합니다.' },
        { status: 400 }
      );
    }

    // 대상 사용자 조회
    let targetUsers: { id: string; username: string }[] = [];

    if (targetType === 'ALL') {
      targetUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, username: true },
      });
    } else if (targetType === 'ROLE') {
      targetUsers = await prisma.user.findMany({
        where: { role: targetValue, isActive: true },
        select: { id: true, username: true },
      });
    } else if (targetType === 'USER') {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetValue },
        select: { id: true, username: true },
      });
      if (targetUser) {
        targetUsers = [targetUser];
      }
    }

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { error: '발송 대상 사용자가 없습니다.' },
        { status: 400 }
      );
    }

    // 웹 푸시 발송
    let sentCount = 0;
    let failedCount = 0;

    const pushPayload = {
      title,
      body: message,
      url: '/',
      tag: 'admin-notification',
    };

    for (const targetUser of targetUsers) {
      try {
        // 웹 푸시 발송 (eventType은 SUBMIT을 사용하되, expenseId 없이)
        const results = await webPushProvider.sendToUser(
          targetUser.id,
          pushPayload,
          'SUBMIT' // 어드민 알림용 이벤트 타입이 없으므로 기존 타입 사용
        );

        const hasSuccess = results.some((r) => r.success);
        if (hasSuccess) {
          sentCount++;
        } else {
          // 구독이 없거나 모두 실패
          const hasSubscription = results.some((r) => r.subscriptionId);
          if (hasSubscription) {
            failedCount++;
          }
          // 구독 자체가 없는 경우는 카운트하지 않음
        }
      } catch (error) {
        console.error(`Push to user ${targetUser.id} failed:`, error);
        failedCount++;
      }
    }

    // 발송 이력 저장
    const status = sentCount > 0 ? (failedCount > 0 ? 'PARTIAL' : 'SENT') : 'FAILED';

    const notification = await prisma.adminNotification.create({
      data: {
        title,
        message,
        targetType,
        targetValue: targetType === 'ALL' ? null : targetValue,
        sentCount,
        failedCount,
        status,
        createdBy: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      notification,
      summary: {
        targetCount: targetUsers.length,
        sentCount,
        failedCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAdmin(handleGet);
export const POST = withAdmin(handlePost);
