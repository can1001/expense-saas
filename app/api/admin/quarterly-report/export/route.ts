import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { getCurrentUser } from '@/lib/auth';

// 재정보고서 Excel 내보내기 접근 권한이 있는 역할
const QUARTERLY_REPORT_EXPORT_ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'finance_member'];

/**
 * 분기별 날짜 범위 계산
 */
function getQuarterDateRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}

/**
 * 연간 날짜 범위 계산
 */
function getYearDateRange(year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  return { startDate, endDate };
}

/**
 * GET /api/admin/quarterly-report/export
 * 분기별 회계보고 Excel 내보내기
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !QUARTERLY_REPORT_EXPORT_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    // 이전 분기를 기본값으로 설정 (2분기에는 1분기, 3분기에는 2분기 조회)
    const actualQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    const defaultQuarter = actualQuarter === 1 ? 4 : actualQuarter - 1;
    const defaultYear = actualQuarter === 1 ? new Date().getFullYear() - 1 : new Date().getFullYear();
    const year = parseInt(searchParams.get('year') || String(defaultYear));
    const quarter = parseInt(searchParams.get('quarter') || String(defaultQuarter));
    const department = searchParams.get('department') || '';
    const category = searchParams.get('category') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';

    const { startDate, endDate } = getQuarterDateRange(year, quarter);
    const { startDate: yearStartDate, endDate: yearEndDate } = getYearDateRange(year);

    // 기본 필터 조건
    const baseWhere = {
      status: 'APPROVED_FINAL' as const,
      requestDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(department && { department }),
      ...(paymentStatus && { paymentStatus: paymentStatus as 'PENDING' | 'HOLD' | 'CANCELLED' | 'COMPLETED' }),
    };

    const categoryWhere = category
      ? { items: { some: { budgetCategory: category } } }
      : {};

    const finalWhere = { ...baseWhere, ...categoryWhere };

    // 데이터 조회
    const [totalStats, expenses, departmentAgg, categoryAgg] = await Promise.all([
      prisma.expense.aggregate({
        where: finalWhere,
        _count: { id: true },
        _sum: { requestAmount: true },
      }),
      prisma.expense.findMany({
        where: finalWhere,
        select: { requestDate: true, requestAmount: true },
      }),
      prisma.expense.groupBy({
        by: ['committee', 'department'],
        where: finalWhere,
        _count: { id: true },
        _sum: { requestAmount: true },
        orderBy: [{ committee: 'asc' }, { department: 'asc' }],
      }),
      prisma.expenseItem.groupBy({
        by: ['budgetCategory', 'budgetSubcategory', 'budgetDetail'],
        where: { expense: finalWhere },
        _count: { id: true },
        _sum: { amount: true },
        orderBy: [{ budgetCategory: 'asc' }, { budgetSubcategory: 'asc' }, { budgetDetail: 'asc' }],
      }),
    ]);

    // 월별 그룹핑
    const monthlyMap = new Map<number, { count: number; amount: number }>();
    for (let m = 1; m <= 3; m++) {
      monthlyMap.set(m, { count: 0, amount: 0 });
    }
    expenses.forEach((exp) => {
      const month = exp.requestDate.getMonth() - (quarter - 1) * 3 + 1;
      if (month >= 1 && month <= 3) {
        const current = monthlyMap.get(month)!;
        current.count += 1;
        current.amount += exp.requestAmount;
      }
    });

    // 예산 데이터 조회
    const budgetCategories = await prisma.budgetCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            details: {
              where: { isActive: true },
              include: {
                yearSettings: {
                  where: { year, isActive: true },
                },
              },
            },
          },
        },
      },
    });

    // 예산항별/예산목별 예산액 집계
    const budgetByCategory = new Map<string, number>();
    const budgetBySubcategory = new Map<string, number>();
    let totalBudgetAmount = 0;

    budgetCategories.forEach((cat) => {
      let catTotal = 0;
      cat.subcategories.forEach((sub) => {
        let subTotal = 0;
        sub.details.forEach((detail) => {
          const budgetAmount = detail.yearSettings[0]?.budgetAmount || 0;
          subTotal += budgetAmount;
        });
        budgetBySubcategory.set(`${cat.name}|${sub.name}`, subTotal);
        catTotal += subTotal;
      });
      budgetByCategory.set(cat.name, catTotal);
      totalBudgetAmount += catTotal;
    });

    // 연간 총지출 조회
    const yearlySpentStats = await prisma.expense.aggregate({
      where: {
        status: 'APPROVED_FINAL',
        requestDate: { gte: yearStartDate, lte: yearEndDate },
      },
      _sum: { requestAmount: true },
    });
    const yearlySpent = yearlySpentStats._sum.requestAmount || 0;

    // Excel 워크북 생성
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '지출결의서 시스템';
    workbook.created = new Date();

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

    const cellBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // 1. 요약 시트
    const summarySheet = workbook.addWorksheet('요약');
    summarySheet.columns = [
      { header: '항목', key: 'item', width: 20 },
      { header: '값', key: 'value', width: 20 },
    ];
    summarySheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });

    const quarterlySpent = totalStats._sum.requestAmount || 0;

    // 연간 집행률 계산
    const yearlyRemaining = totalBudgetAmount - yearlySpent;
    const yearlyExecutionRate = totalBudgetAmount > 0
      ? Math.round((yearlySpent / totalBudgetAmount) * 1000) / 10
      : 0;

    // 분기별 집행률 계산 (분기 예산 = 연간 예산 / 4)
    const quarterlyBudget = Math.round(totalBudgetAmount / 4);
    const quarterlyRemaining = quarterlyBudget - quarterlySpent;
    const quarterlyExecutionRate = quarterlyBudget > 0
      ? Math.round((quarterlySpent / quarterlyBudget) * 1000) / 10
      : 0;

    const summaryData = [
      { item: '조회 연도', value: `${year}년` },
      { item: '조회 분기', value: `${quarter}분기` },
      { item: '조회 기간', value: `${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}` },
      { item: '총 건수', value: totalStats._count.id },
      { item: '', value: '' },
      { item: '[ 연간 예산 현황 ]', value: '' },
      { item: '연간 예산액', value: totalBudgetAmount },
      { item: '연간 지출액', value: yearlySpent },
      { item: '연간 잔액', value: yearlyRemaining },
      { item: '연간 집행률', value: `${yearlyExecutionRate}%` },
      { item: '', value: '' },
      { item: `[ ${quarter}분기 예산 현황 ]`, value: '' },
      { item: '분기 예산액', value: quarterlyBudget },
      { item: '분기 지출액', value: quarterlySpent },
      { item: '분기 잔액', value: quarterlyRemaining },
      { item: '분기 집행률', value: `${quarterlyExecutionRate}%` },
    ];
    summaryData.forEach((row) => {
      const newRow = summarySheet.addRow(row);
      newRow.eachCell((cell) => { cell.border = cellBorder; });
    });
    summarySheet.getColumn('value').numFmt = '#,##0';

    // 2. 월별 시트
    const monthlySheet = workbook.addWorksheet('월별 지출');
    monthlySheet.columns = [
      { header: '월', key: 'month', width: 10 },
      { header: '건수', key: 'count', width: 10 },
      { header: '금액', key: 'amount', width: 20 },
      { header: '비율(%)', key: 'ratio', width: 12 },
    ];
    monthlySheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });

    const totalAmount = totalStats._sum.requestAmount || 0;
    Array.from(monthlyMap.entries()).forEach(([month, data]) => {
      const actualMonth = (quarter - 1) * 3 + month;
      const ratio = totalAmount > 0 ? Math.round((data.amount / totalAmount) * 1000) / 10 : 0;
      const newRow = monthlySheet.addRow({
        month: `${actualMonth}월`,
        count: data.count,
        amount: data.amount,
        ratio,
      });
      newRow.eachCell((cell) => { cell.border = cellBorder; });
    });
    monthlySheet.getColumn('amount').numFmt = '#,##0';

    // 3. 부서별 시트
    const deptSheet = workbook.addWorksheet('부서별 지출');
    deptSheet.columns = [
      { header: '위원회', key: 'committee', width: 15 },
      { header: '사역팀(부)', key: 'department', width: 15 },
      { header: '건수', key: 'count', width: 10 },
      { header: '금액', key: 'amount', width: 20 },
      { header: '비율(%)', key: 'ratio', width: 12 },
    ];
    deptSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });

    departmentAgg.forEach((item) => {
      const amount = item._sum.requestAmount || 0;
      const ratio = totalAmount > 0 ? Math.round((amount / totalAmount) * 1000) / 10 : 0;
      const newRow = deptSheet.addRow({
        committee: item.committee,
        department: item.department,
        count: item._count.id,
        amount,
        ratio,
      });
      newRow.eachCell((cell) => { cell.border = cellBorder; });
    });
    deptSheet.getColumn('amount').numFmt = '#,##0';

    // 4. 분기별 예산 대비 지출 시트 (계정과목별)
    const catSheet = workbook.addWorksheet('분기별예산대비지출');
    catSheet.columns = [
      { header: '예산(항)', key: 'category', width: 20 },
      { header: '예산(목)', key: 'subcategory', width: 20 },
      { header: '분기예산', key: 'quarterlyBudget', width: 15 },
      { header: '분기지출', key: 'spentAmount', width: 15 },
      { header: '분기잔액', key: 'quarterlyRemaining', width: 15 },
      { header: '분기집행률(%)', key: 'quarterlyExecutionRate', width: 14 },
      { header: '건수', key: 'count', width: 10 },
      { header: '(연간예산)', key: 'budgetAmount', width: 15 },
      { header: '(연간지출)', key: 'yearlySpent', width: 15 },
      { header: '(연간잔액)', key: 'yearlyRemaining', width: 15 },
      { header: '(연간집행률%)', key: 'yearlyExecRate', width: 14 },
    ];
    catSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });

    // 지출 데이터를 예산목별/세목별로 집계 (분기)
    const spentBySubcategory = new Map<string, { count: number; amount: number }>();
    const spentByDetail = new Map<string, { count: number; amount: number }>();

    categoryAgg.forEach((item) => {
      const subKey = `${item.budgetCategory}|${item.budgetSubcategory}`;
      const detailKey = `${item.budgetCategory}|${item.budgetSubcategory}|${item.budgetDetail}`;
      const amount = item._sum.amount || 0;
      const count = item._count.id;

      // 목별 집계
      const existing = spentBySubcategory.get(subKey);
      if (existing) {
        existing.count += count;
        existing.amount += amount;
      } else {
        spentBySubcategory.set(subKey, { count, amount });
      }

      // 세목별 집계
      spentByDetail.set(detailKey, { count, amount });
    });

    // 연간 지출 집계 (세목까지 포함)
    const yearlyCategoryAgg = await prisma.expenseItem.groupBy({
      by: ['budgetCategory', 'budgetSubcategory', 'budgetDetail'],
      where: {
        expense: {
          status: 'APPROVED_FINAL',
          requestDate: { gte: yearStartDate, lte: yearEndDate },
        },
      },
      _sum: { amount: true },
    });

    const yearlySpentBySubcategory = new Map<string, number>();
    const yearlySpentByDetail = new Map<string, number>();
    yearlyCategoryAgg.forEach((item) => {
      const subKey = `${item.budgetCategory}|${item.budgetSubcategory}`;
      const detailKey = `${item.budgetCategory}|${item.budgetSubcategory}|${item.budgetDetail}`;
      const amount = item._sum.amount || 0;

      // 목별 연간 집계
      yearlySpentBySubcategory.set(subKey, (yearlySpentBySubcategory.get(subKey) || 0) + amount);
      // 세목별 연간 집계
      yearlySpentByDetail.set(detailKey, amount);
    });

    // 모든 예산 카테고리에 대해 행 생성
    budgetCategories.forEach((cat) => {
      cat.subcategories.forEach((sub) => {
        const key = `${cat.name}|${sub.name}`;
        const budget = budgetBySubcategory.get(key) || 0;
        const spent = spentBySubcategory.get(key);
        const spentAmount = spent?.amount || 0;
        const count = spent?.count || 0;
        // 분기 기준 계산
        const qBudget = Math.round(budget / 4);
        const qRemaining = qBudget - spentAmount;
        const qExecRate = qBudget > 0 ? Math.round((spentAmount / qBudget) * 1000) / 10 : 0;
        // 연간 기준 계산
        const yearlySpent = yearlySpentBySubcategory.get(key) || 0;
        const yRemaining = budget - yearlySpent;
        const yExecRate = budget > 0 ? Math.round((yearlySpent / budget) * 1000) / 10 : 0;

        if (budget > 0 || spentAmount > 0) {
          const newRow = catSheet.addRow({
            category: cat.name,
            subcategory: sub.name,
            quarterlyBudget: qBudget,
            spentAmount: spentAmount,
            quarterlyRemaining: qRemaining,
            quarterlyExecutionRate: qExecRate,
            count: count,
            budgetAmount: budget,
            yearlySpent: yearlySpent,
            yearlyRemaining: yRemaining,
            yearlyExecRate: yExecRate,
          });
          newRow.eachCell((cell) => { cell.border = cellBorder; });
        }
      });
    });

    catSheet.getColumn('quarterlyBudget').numFmt = '#,##0';
    catSheet.getColumn('spentAmount').numFmt = '#,##0';
    catSheet.getColumn('quarterlyRemaining').numFmt = '#,##0';
    catSheet.getColumn('budgetAmount').numFmt = '#,##0';
    catSheet.getColumn('yearlySpent').numFmt = '#,##0';
    catSheet.getColumn('yearlyRemaining').numFmt = '#,##0';

    // 5. 세목별 상세 시트
    const detailSheet = workbook.addWorksheet('세목별상세');
    detailSheet.columns = [
      { header: '예산(항)', key: 'category', width: 20 },
      { header: '예산(목)', key: 'subcategory', width: 20 },
      { header: '예산(세목)', key: 'detail', width: 25 },
      { header: '분기지출', key: 'spentAmount', width: 15 },
      { header: '건수', key: 'count', width: 10 },
      { header: '연간지출', key: 'yearlySpent', width: 15 },
      { header: '비율(%)', key: 'ratio', width: 12 },
    ];
    detailSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, { style: headerStyle });
    });

    // 세목별 데이터를 정렬하여 추가
    const detailEntries = Array.from(spentByDetail.entries())
      .map(([key, data]) => {
        const [category, subcategory, detail] = key.split('|');
        const yearlySpent = yearlySpentByDetail.get(key) || 0;
        const ratio = totalAmount > 0 ? Math.round((data.amount / totalAmount) * 1000) / 10 : 0;
        return {
          category,
          subcategory,
          detail,
          spentAmount: data.amount,
          count: data.count,
          yearlySpent,
          ratio,
        };
      })
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
        return a.detail.localeCompare(b.detail);
      });

    detailEntries.forEach((item) => {
      const newRow = detailSheet.addRow(item);
      newRow.eachCell((cell) => { cell.border = cellBorder; });
    });

    detailSheet.getColumn('spentAmount').numFmt = '#,##0';
    detailSheet.getColumn('yearlySpent').numFmt = '#,##0';

    // Buffer로 변환
    const buffer = await workbook.xlsx.writeBuffer();

    // Response 반환
    const filename = encodeURIComponent(`분기별회계보고_${year}년_${quarter}분기.xlsx`);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
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
