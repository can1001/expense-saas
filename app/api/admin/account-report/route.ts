/**
 * 재정보고서 조회 API
 *
 * GET /api/admin/account-report
 * - 재정보고서 조회 (당해/전년 비교 포함)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api/response-handler';
import { AccountReportType } from '@prisma/client';
import type { SummaryData } from '@/lib/account-report-parser';

/**
 * GET: 재정보고서 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || '') || new Date().getFullYear();
    const quarter = parseInt(searchParams.get('quarter') || '') || 1;
    const compareWithPrevious = searchParams.get('compare') === 'true';
    const includeTrend = searchParams.get('trend') === 'true';

    // 당해년도 보고서 조회
    const currentYearReport = await prisma.accountReport.findUnique({
      where: {
        year_quarter_reportType: {
          year,
          quarter,
          reportType: AccountReportType.CURRENT_YEAR,
        },
      },
      include: {
        incomeItems: {
          orderBy: { sortOrder: 'asc' },
        },
        expenseItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // 전년도 보고서 조회 (비교 모드일 때)
    let previousYearReport = null;
    if (compareWithPrevious) {
      previousYearReport = await prisma.accountReport.findUnique({
        where: {
          year_quarter_reportType: {
            year,
            quarter,
            reportType: AccountReportType.PREVIOUS_YEAR,
          },
        },
        include: {
          incomeItems: {
            orderBy: { sortOrder: 'asc' },
          },
          expenseItems: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    }

    // 비교 데이터 생성
    let comparison = null;
    if (currentYearReport && previousYearReport) {
      comparison = generateComparison(currentYearReport, previousYearReport);
    }

    // 분기별 추이 데이터 조회 (trend 모드일 때)
    let trendData = null;
    if (includeTrend) {
      trendData = await fetchTrendData(year, compareWithPrevious);
    }

    return apiSuccess({
      year,
      quarter,
      currentYear: currentYearReport
        ? {
            id: currentYearReport.id,
            fileName: currentYearReport.originalFileName,
            uploadedAt: currentYearReport.uploadedAt,
            summary: currentYearReport.summaryData as unknown as SummaryData,
            incomeItems: currentYearReport.incomeItems,
            expenseItems: currentYearReport.expenseItems,
          }
        : null,
      previousYear: previousYearReport
        ? {
            id: previousYearReport.id,
            fileName: previousYearReport.originalFileName,
            uploadedAt: previousYearReport.uploadedAt,
            summary: previousYearReport.summaryData as unknown as SummaryData,
            incomeItems: previousYearReport.incomeItems,
            expenseItems: previousYearReport.expenseItems,
          }
        : null,
      comparison,
      trendData,
    });
  } catch (error) {
    console.error('Account report fetch error:', error);
    return apiError(
      error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.',
      {
        type: 'SERVER_ERROR',
        code: 'FETCH_ERROR',
        status: 500,
      }
    );
  }
}

/**
 * 분기별 추이 데이터 조회
 */
async function fetchTrendData(year: number, includePrevious: boolean) {
  // 해당 연도의 모든 분기 데이터 조회
  const currentYearReports = await prisma.accountReport.findMany({
    where: {
      year,
      reportType: AccountReportType.CURRENT_YEAR,
    },
    orderBy: { quarter: 'asc' },
  });

  // 전년도 데이터 조회 (비교 모드일 때)
  let previousYearReports: typeof currentYearReports = [];
  if (includePrevious) {
    previousYearReports = await prisma.accountReport.findMany({
      where: {
        year: year - 1,
        reportType: AccountReportType.CURRENT_YEAR,
      },
      orderBy: { quarter: 'asc' },
    });
  }

  const previousMap = new Map(previousYearReports.map((r) => [r.quarter, r]));

  return currentYearReports.map((report) => {
    const summary = report.summaryData as unknown as SummaryData;
    const prevReport = previousMap.get(report.quarter);
    const prevSummary = prevReport?.summaryData as unknown as SummaryData | undefined;

    return {
      name: `${report.quarter}분기`,
      quarter: report.quarter,
      income: summary?.current?.totalIncome || 0,
      expense: summary?.current?.totalExpense || 0,
      previousIncome: prevSummary?.current?.totalIncome || undefined,
      previousExpense: prevSummary?.current?.totalExpense || undefined,
    };
  });
}

/**
 * 전년 대비 비교 데이터 생성
 */
function generateComparison(
  currentReport: {
    summaryData: unknown;
    incomeItems: Array<{
      itemName: string;
      level: number;
      budgetAmount: number;
      cumulativeAmount: number;
      currentAmount: number;
      executionRate: number;
    }>;
    expenseItems: Array<{
      itemName: string;
      level: number;
      budgetAmount: number;
      cumulativeAmount: number;
      currentAmount: number;
      executionRate: number;
    }>;
  },
  previousReport: {
    summaryData: unknown;
    incomeItems: Array<{
      itemName: string;
      level: number;
      budgetAmount: number;
      cumulativeAmount: number;
      currentAmount: number;
      executionRate: number;
    }>;
    expenseItems: Array<{
      itemName: string;
      level: number;
      budgetAmount: number;
      cumulativeAmount: number;
      currentAmount: number;
      executionRate: number;
    }>;
  }
) {
  const currentSummary = currentReport.summaryData as SummaryData;
  const previousSummary = previousReport.summaryData as SummaryData;

  // 요약 비교
  const summaryComparison = {
    totalIncome: {
      current: currentSummary?.current?.totalIncome || 0,
      previous: previousSummary?.current?.totalIncome || 0,
      diff: (currentSummary?.current?.totalIncome || 0) - (previousSummary?.current?.totalIncome || 0),
      diffRate: previousSummary?.current?.totalIncome
        ? (((currentSummary?.current?.totalIncome || 0) - previousSummary.current.totalIncome) /
            previousSummary.current.totalIncome) *
          100
        : 0,
    },
    totalExpense: {
      current: currentSummary?.current?.totalExpense || 0,
      previous: previousSummary?.current?.totalExpense || 0,
      diff: (currentSummary?.current?.totalExpense || 0) - (previousSummary?.current?.totalExpense || 0),
      diffRate: previousSummary?.current?.totalExpense
        ? (((currentSummary?.current?.totalExpense || 0) - previousSummary.current.totalExpense) /
            previousSummary.current.totalExpense) *
          100
        : 0,
    },
    nextCarryover: {
      current: currentSummary?.current?.nextCarryover || 0,
      previous: previousSummary?.current?.nextCarryover || 0,
      diff: (currentSummary?.current?.nextCarryover || 0) - (previousSummary?.current?.nextCarryover || 0),
      diffRate: previousSummary?.current?.nextCarryover
        ? (((currentSummary?.current?.nextCarryover || 0) - previousSummary.current.nextCarryover) /
            previousSummary.current.nextCarryover) *
          100
        : 0,
    },
  };

  // 수입 항목 비교 (레벨 1만)
  const incomeComparison = compareItems(
    currentReport.incomeItems.filter((i) => i.level === 1),
    previousReport.incomeItems.filter((i) => i.level === 1)
  );

  // 지출 항목 비교 (레벨 1만)
  const expenseComparison = compareItems(
    currentReport.expenseItems.filter((i) => i.level === 1),
    previousReport.expenseItems.filter((i) => i.level === 1)
  );

  return {
    summary: summaryComparison,
    income: incomeComparison,
    expense: expenseComparison,
  };
}

/**
 * 항목 비교
 */
function compareItems(
  currentItems: Array<{
    itemName: string;
    budgetAmount: number;
    cumulativeAmount: number;
    currentAmount: number;
    executionRate: number;
  }>,
  previousItems: Array<{
    itemName: string;
    budgetAmount: number;
    cumulativeAmount: number;
    currentAmount: number;
    executionRate: number;
  }>
) {
  const previousMap = new Map(previousItems.map((item) => [item.itemName, item]));
  const compared: Array<{
    itemName: string;
    current: {
      budgetAmount: number;
      cumulativeAmount: number;
      currentAmount: number;
      executionRate: number;
    };
    previous: {
      budgetAmount: number;
      cumulativeAmount: number;
      currentAmount: number;
      executionRate: number;
    } | null;
    diff: {
      cumulativeDiff: number;
      cumulativeDiffRate: number;
    };
  }> = [];

  for (const item of currentItems) {
    const prevItem = previousMap.get(item.itemName);

    compared.push({
      itemName: item.itemName,
      current: {
        budgetAmount: item.budgetAmount,
        cumulativeAmount: item.cumulativeAmount,
        currentAmount: item.currentAmount,
        executionRate: item.executionRate,
      },
      previous: prevItem
        ? {
            budgetAmount: prevItem.budgetAmount,
            cumulativeAmount: prevItem.cumulativeAmount,
            currentAmount: prevItem.currentAmount,
            executionRate: prevItem.executionRate,
          }
        : null,
      diff: {
        cumulativeDiff: prevItem ? item.cumulativeAmount - prevItem.cumulativeAmount : item.cumulativeAmount,
        cumulativeDiffRate: prevItem?.cumulativeAmount
          ? ((item.cumulativeAmount - prevItem.cumulativeAmount) / prevItem.cumulativeAmount) * 100
          : 0,
      },
    });
  }

  return compared;
}
