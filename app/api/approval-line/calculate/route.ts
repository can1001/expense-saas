import { NextResponse } from 'next/server';
import {
  calculateApprovalLine,
  calculateApprovalLineForExpense,
} from '@/lib/services/approval-line-service';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/approval-line/calculate
 * 결재선 미리보기 (세목 ID 또는 예산 카테고리 기반)
 *
 * Query params:
 * - budgetDetailId: 예산 세목 ID (선택)
 * - budgetCategory: 예산(항) (선택)
 * - budgetSubcategory: 예산(목) (선택)
 * - budgetDetail: 예산(세목) 이름 (선택)
 * - year: 연도 (기본: 현재 연도)
 */
const handleGet: UserApiHandler = async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const budgetDetailId = searchParams.get('budgetDetailId');
    const budgetCategory = searchParams.get('budgetCategory');
    const budgetSubcategory = searchParams.get('budgetSubcategory');
    const budgetDetail = searchParams.get('budgetDetail');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    let approvalLineInfo;

    if (budgetDetailId) {
      // 세목 ID로 직접 조회
      approvalLineInfo = await calculateApprovalLine(budgetDetailId, year);
    } else if (budgetCategory && budgetSubcategory && budgetDetail) {
      // 카테고리 이름으로 조회
      approvalLineInfo = await calculateApprovalLineForExpense(
        budgetCategory,
        budgetSubcategory,
        budgetDetail,
        year
      );
    } else {
      return NextResponse.json(
        { error: 'budgetDetailId 또는 (budgetCategory, budgetSubcategory, budgetDetail) 필요' },
        { status: 400 }
      );
    }

    return NextResponse.json(approvalLineInfo);
  } catch (error) {
    console.error('결재선 조회 오류:', error);
    const message = error instanceof Error ? error.message : '결재선 조회 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

/**
 * POST /api/approval-line/calculate
 * 지출결의서 기반 결재선 산출 (제출 전 미리보기용)
 *
 * Body:
 * - budgetCategory: 예산(항)
 * - budgetSubcategory: 예산(목)
 * - items: [{ budgetDetail: string }]
 * - requestDate: 청구일자
 */
const handlePost: UserApiHandler = async (request) => {
  try {
    const body = await request.json();
    const { budgetCategory, budgetSubcategory, items, requestDate } = body;

    if (!budgetCategory || !budgetSubcategory || !items || items.length === 0) {
      return NextResponse.json(
        { error: '필수 파라미터 누락 (budgetCategory, budgetSubcategory, items)' },
        { status: 400 }
      );
    }

    // 연도 추출
    const year = requestDate
      ? new Date(requestDate).getFullYear()
      : new Date().getFullYear();

    // 첫 번째 항목의 세목 기준으로 결재선 산출
    const firstItem = items[0];
    const approvalLineInfo = await calculateApprovalLineForExpense(
      budgetCategory,
      budgetSubcategory,
      firstItem.budgetDetail,
      year
    );

    return NextResponse.json(approvalLineInfo);
  } catch (error) {
    console.error('결재선 산출 오류:', error);
    const message = error instanceof Error ? error.message : '결재선 산출 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
