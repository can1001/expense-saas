/**
 * 재정보고서(표준) 엑셀 내보내기 API
 *
 * GET /api/admin/account-report/export
 * - 재정보고서(표준) 형식의 xlsx 파일 다운로드
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AccountReportType } from '@prisma/client';
import {
  generateAccountReportBuffer,
  generateAccountReportFilename,
  type ReportData,
} from '@/lib/account-report-excel-generator';
import type { SummaryData } from '@/lib/account-report-parser';

/**
 * GET: 재정보고서 엑셀 다운로드
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || '') || new Date().getFullYear();
    const quarter = parseInt(searchParams.get('quarter') || '') || 1;

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

    if (!currentYearReport) {
      return NextResponse.json(
        { error: `${year}년 ${quarter}분기 재정보고서 데이터가 없습니다.` },
        { status: 404 }
      );
    }

    // 전년도 보고서 조회
    const previousYearReport = await prisma.accountReport.findUnique({
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

    // ReportData 형식으로 변환
    const currentYear: ReportData = {
      id: currentYearReport.id,
      fileName: currentYearReport.originalFileName,
      uploadedAt: currentYearReport.uploadedAt.toISOString(),
      summary: currentYearReport.summaryData as unknown as SummaryData,
      incomeItems: currentYearReport.incomeItems.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        parentItemName: item.parentItemName || undefined,
        level: item.level,
        budgetAmount: item.budgetAmount,
        cumulativeAmount: item.cumulativeAmount,
        currentAmount: item.currentAmount,
        executionRate: item.executionRate,
        sortOrder: item.sortOrder,
      })),
      expenseItems: currentYearReport.expenseItems.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        parentItemName: item.parentItemName || undefined,
        level: item.level,
        budgetAmount: item.budgetAmount,
        cumulativeAmount: item.cumulativeAmount,
        currentAmount: item.currentAmount,
        executionRate: item.executionRate,
        sortOrder: item.sortOrder,
      })),
    };

    let previousYear: ReportData | null = null;
    if (previousYearReport) {
      previousYear = {
        id: previousYearReport.id,
        fileName: previousYearReport.originalFileName,
        uploadedAt: previousYearReport.uploadedAt.toISOString(),
        summary: previousYearReport.summaryData as unknown as SummaryData,
        incomeItems: previousYearReport.incomeItems.map((item) => ({
          id: item.id,
          itemName: item.itemName,
          parentItemName: item.parentItemName || undefined,
          level: item.level,
          budgetAmount: item.budgetAmount,
          cumulativeAmount: item.cumulativeAmount,
          currentAmount: item.currentAmount,
          executionRate: item.executionRate,
          sortOrder: item.sortOrder,
        })),
        expenseItems: previousYearReport.expenseItems.map((item) => ({
          id: item.id,
          itemName: item.itemName,
          parentItemName: item.parentItemName || undefined,
          level: item.level,
          budgetAmount: item.budgetAmount,
          cumulativeAmount: item.cumulativeAmount,
          currentAmount: item.currentAmount,
          executionRate: item.executionRate,
          sortOrder: item.sortOrder,
        })),
      };
    }

    // 엑셀 파일 생성
    const buffer = generateAccountReportBuffer({
      year,
      quarter,
      currentYear,
      previousYear,
    });

    // 파일명 생성
    const filename = generateAccountReportFilename(year, quarter);

    // 응답 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    headers.set('Content-Length', buffer.length.toString());

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error('Account report export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '엑셀 내보내기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
