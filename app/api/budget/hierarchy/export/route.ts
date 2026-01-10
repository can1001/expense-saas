import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

/**
 * GET /api/budget/hierarchy/export
 * 예산 현황 Excel 내보내기
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const committeeId = searchParams.get('committeeId') || '';

    // 위원회 필터 조건
    const committeeWhere = committeeId
      ? { id: committeeId, isActive: true }
      : { isActive: true };

    // 위원회 목록 조회
    const committees = await prisma.committee.findMany({
      where: committeeWhere,
      orderBy: { sortOrder: 'asc' },
      include: {
        departments: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // 각 부서별로 예산 세목 조회
    const budgetData: Array<{
      committee: string;
      department: string;
      category: string;
      subcategory: string;
      detail: string;
      manager: string;
      budgetAmount: number;
    }> = [];

    for (const committee of committees) {
      for (const dept of committee.departments) {
        const departmentDetails = await prisma.departmentBudgetDetail.findMany({
          where: {
            departmentId: dept.id,
            isActive: true,
            budgetDetail: { isActive: true },
          },
          include: {
            budgetDetail: {
              include: {
                subcategory: {
                  include: { category: true },
                },
                yearSettings: {
                  where: { year },
                  include: {
                    manager: {
                      select: { id: true, username: true },
                    },
                  },
                },
              },
            },
          },
        });

        for (const dbd of departmentDetails) {
          const detail = dbd.budgetDetail;
          if (!detail) continue;

          const yearData = detail.yearSettings[0];

          budgetData.push({
            committee: committee.name,
            department: dept.name,
            category: detail.subcategory.category.name,
            subcategory: detail.subcategory.name,
            detail: detail.name,
            manager: yearData?.manager?.username || '',
            budgetAmount: yearData?.budgetAmount || 0,
          });
        }
      }
    }

    // Excel 워크북 생성
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '지출결의서 시스템';
    workbook.created = new Date();

    // 워크시트 생성
    const worksheet = workbook.addWorksheet(`${year}년 예산현황`);

    // 헤더 스타일
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    // 컬럼 정의
    worksheet.columns = [
      { header: '위원회', key: 'committee', width: 15 },
      { header: '사역팀', key: 'department', width: 15 },
      { header: '예산(항)', key: 'category', width: 15 },
      { header: '예산(목)', key: 'subcategory', width: 15 },
      { header: '예산(세목)', key: 'detail', width: 20 },
      { header: '담당자', key: 'manager', width: 12 },
      { header: '예산금액', key: 'budgetAmount', width: 15 },
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });
    worksheet.getRow(1).height = 25;

    // 데이터 행 추가
    let rowIndex = 2;
    for (const data of budgetData) {
      worksheet.addRow(data);

      // 셀 스타일 적용
      const row = worksheet.getRow(rowIndex);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // 금액 셀 포맷
      const amountCell = row.getCell('budgetAmount');
      amountCell.numFmt = '#,##0';
      amountCell.alignment = { horizontal: 'right' };

      rowIndex++;
    }

    // 합계 행 추가
    if (rowIndex > 2) {
      worksheet.addRow({});
      rowIndex++;

      const totalRow = worksheet.addRow({
        committee: '',
        department: '',
        category: '',
        subcategory: '',
        detail: '합계',
        manager: '',
        budgetAmount: { formula: `SUM(G2:G${rowIndex - 2})` },
      });

      totalRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' },
        };
      });
      totalRow.getCell('budgetAmount').numFmt = '#,##0';
      totalRow.getCell('budgetAmount').alignment = { horizontal: 'right' };
    }

    // 필터 추가
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 7 },
    };

    // Buffer로 변환
    const buffer = await workbook.xlsx.writeBuffer();

    // Response 반환
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="budget_${year}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: '내보내기에 실패했습니다.' },
      { status: 500 }
    );
  }
}
