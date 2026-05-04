import { NextRequest, NextResponse } from 'next/server';
import { processRecurringExpenses } from '@/lib/services/recurring-expense-service';
import { handleApiError, ApiError } from '@/lib/api/error-handler';

// POST /api/recurring-expenses/process - 자동이체 일괄 처리 (크론잡용)
export async function POST(request: NextRequest) {
  try {
    // 크론잡 인증을 위한 시크릿 키 확인
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // CRON_SECRET이 설정되어 있으면 인증 필요
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      throw new ApiError('인증에 실패했습니다.', 401);
    }

    const result = await processRecurringExpenses();

    return NextResponse.json({
      success: true,
      message: `${result.generated}건의 지출결의서가 생성되었습니다.`,
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
