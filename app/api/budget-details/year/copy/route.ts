import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/budget-details/year/copy
 * 이전 연도 설정을 새 연도로 복사
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromYear, toYear } = body as {
      fromYear: number;
      toYear: number;
    };

    if (!fromYear || !toYear) {
      return NextResponse.json({ error: '필수 파라미터 누락 (fromYear, toYear)' }, { status: 400 });
    }

    if (fromYear === toYear) {
      return NextResponse.json({ error: '같은 연도로 복사할 수 없습니다' }, { status: 400 });
    }

    // 원본 연도의 설정 조회
    const sourceSettings = await prisma.budgetDetailYear.findMany({
      where: { year: fromYear, isActive: true },
    });

    if (sourceSettings.length === 0) {
      return NextResponse.json({ error: `${fromYear}년 설정이 없습니다` }, { status: 404 });
    }

    // 대상 연도에 이미 설정이 있는지 확인
    const existingSettings = await prisma.budgetDetailYear.findMany({
      where: { year: toYear },
      select: { budgetDetailId: true },
    });
    const existingIds = new Set(existingSettings.map((s) => s.budgetDetailId));

    let createdCount = 0;
    let skippedCount = 0;

    for (const source of sourceSettings) {
      if (existingIds.has(source.budgetDetailId)) {
        // 이미 존재하면 스킵
        skippedCount++;
        continue;
      }

      await prisma.budgetDetailYear.create({
        data: {
          budgetDetailId: source.budgetDetailId,
          year: toYear,
          managerId: source.managerId,
          budgetAmount: source.budgetAmount,
          usedAmount: 0, // 사용금액은 0으로 초기화
          isActive: true,
        },
      });
      createdCount++;
    }

    return NextResponse.json({
      message: `${fromYear}년 → ${toYear}년 복사 완료`,
      fromYear,
      toYear,
      createdCount,
      skippedCount,
      totalSource: sourceSettings.length,
    });
  } catch (error) {
    console.error('연도 복사 오류:', error);
    return NextResponse.json({ error: '연도 복사 실패' }, { status: 500 });
  }
}
