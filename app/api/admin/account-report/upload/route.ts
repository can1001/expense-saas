/**
 * 재정보고서 업로드 API
 *
 * POST /api/admin/account-report/upload
 * - 당해/전년 재정보고서 엑셀 파일 업로드
 * - dry-run 모드 지원 (검증만 수행)
 */

import { prisma } from '@/lib/prisma';
import {
  parseAccountReportFile,
  validateParsedReport,
  type ParsedAccountReport,
} from '@/lib/account-report-parser';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response-handler';
import { AccountReportType } from '@prisma/client';

/**
 * POST: 재정보고서 업로드
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // 파일 추출
    const currentYearFile = formData.get('currentYearFile') as File | null;
    const previousYearFile = formData.get('previousYearFile') as File | null;

    // 메타데이터
    const year = parseInt(formData.get('year') as string) || new Date().getFullYear();
    const quarter = parseInt(formData.get('quarter') as string) || 1;
    const dryRun = formData.get('dryRun') === 'true';

    // 파일 검증
    if (!currentYearFile && !previousYearFile) {
      return apiValidationError('최소 하나의 파일이 필요합니다.', [
        { fieldName: 'file', message: '당해년도 또는 전년도 파일을 선택해주세요.' },
      ]);
    }

    // 파일 타입 검증
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/html',
    ];

    const validateFile = (file: File, name: string) => {
      const isValidType =
        validTypes.includes(file.type) ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls');

      if (!isValidType) {
        return {
          valid: false,
          error: `${name}: 지원하지 않는 파일 형식입니다. Excel 파일(.xlsx, .xls)만 업로드 가능합니다.`,
        };
      }
      return { valid: true };
    };

    if (currentYearFile) {
      const validation = validateFile(currentYearFile, '당해년도 파일');
      if (!validation.valid) {
        return apiValidationError(validation.error!, [
          { fieldName: 'currentYearFile', message: validation.error! },
        ]);
      }
    }

    if (previousYearFile) {
      const validation = validateFile(previousYearFile, '전년도 파일');
      if (!validation.valid) {
        return apiValidationError(validation.error!, [
          { fieldName: 'previousYearFile', message: validation.error! },
        ]);
      }
    }

    // 파싱 결과 저장
    const results: {
      currentYear?: {
        data: ParsedAccountReport;
        fileName: string;
        warnings: string[];
      };
      previousYear?: {
        data: ParsedAccountReport;
        fileName: string;
        warnings: string[];
      };
    } = {};

    // 당해년도 파일 파싱
    if (currentYearFile) {
      const buffer = await currentYearFile.arrayBuffer();
      const parseResult = await parseAccountReportFile(buffer);

      if (parseResult.error) {
        return apiError(`당해년도 파일 파싱 오류: ${parseResult.error.message}`, {
          type: 'VALIDATION',
          code: 'PARSE_ERROR',
          status: 400,
          details: parseResult.error.details,
        });
      }

      const validation = validateParsedReport(parseResult.data!);
      results.currentYear = {
        data: parseResult.data!,
        fileName: currentYearFile.name,
        warnings: validation.warnings,
      };
    }

    // 전년도 파일 파싱
    if (previousYearFile) {
      const buffer = await previousYearFile.arrayBuffer();
      const parseResult = await parseAccountReportFile(buffer);

      if (parseResult.error) {
        return apiError(`전년도 파일 파싱 오류: ${parseResult.error.message}`, {
          type: 'VALIDATION',
          code: 'PARSE_ERROR',
          status: 400,
          details: parseResult.error.details,
        });
      }

      const validation = validateParsedReport(parseResult.data!);
      results.previousYear = {
        data: parseResult.data!,
        fileName: previousYearFile.name,
        warnings: validation.warnings,
      };
    }

    // dry-run 모드면 여기서 반환
    if (dryRun) {
      return apiSuccess(
        {
          dryRun: true,
          year,
          quarter,
          currentYear: results.currentYear
            ? {
                fileName: results.currentYear.fileName,
                incomeItems: results.currentYear.data.incomeItems.length,
                expenseItems: results.currentYear.data.expenseItems.length,
                summary: results.currentYear.data.summary,
                warnings: results.currentYear.warnings,
              }
            : null,
          previousYear: results.previousYear
            ? {
                fileName: results.previousYear.fileName,
                incomeItems: results.previousYear.data.incomeItems.length,
                expenseItems: results.previousYear.data.expenseItems.length,
                summary: results.previousYear.data.summary,
                warnings: results.previousYear.warnings,
              }
            : null,
        },
        {
          message: '검증이 완료되었습니다. dryRun=false로 실제 업로드를 수행하세요.',
          code: 'VALIDATION_SUCCESS',
        }
      );
    }

    // 실제 저장
    await prisma.$transaction(async (tx) => {
      // 당해년도 저장
      if (results.currentYear) {
        // 기존 데이터 삭제
        await tx.accountReport.deleteMany({
          where: {
            year,
            quarter,
            reportType: AccountReportType.CURRENT_YEAR,
          },
        });

        // 새 보고서 생성
        const report = await tx.accountReport.create({
          data: {
            year,
            quarter,
            reportType: AccountReportType.CURRENT_YEAR,
            originalFileName: results.currentYear.fileName,
            summaryData: JSON.parse(JSON.stringify(results.currentYear.data.summary)),
          },
        });

        // 수입 항목 저장
        if (results.currentYear.data.incomeItems.length > 0) {
          await tx.accountReportIncome.createMany({
            data: results.currentYear.data.incomeItems.map((item) => ({
              reportId: report.id,
              itemName: item.itemName,
              parentItemName: item.parentItemName,
              level: item.level,
              budgetAmount: item.budgetAmount,
              cumulativeAmount: item.cumulativeAmount,
              currentAmount: item.currentAmount,
              executionRate: item.executionRate,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 지출 항목 저장
        if (results.currentYear.data.expenseItems.length > 0) {
          await tx.accountReportExpense.createMany({
            data: results.currentYear.data.expenseItems.map((item) => ({
              reportId: report.id,
              itemName: item.itemName,
              parentItemName: item.parentItemName,
              level: item.level,
              budgetAmount: item.budgetAmount,
              cumulativeAmount: item.cumulativeAmount,
              currentAmount: item.currentAmount,
              executionRate: item.executionRate,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 입출금 통장 저장
        if (results.currentYear.data.bankAccounts.length > 0) {
          await tx.accountReportBankAccount.createMany({
            data: results.currentYear.data.bankAccounts.map((item) => ({
              reportId: report.id,
              accountType: item.accountType,
              balance: item.balance,
              accountNumber: item.accountNumber,
              note: item.note,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 적립금 저장
        if (results.currentYear.data.reserves.length > 0) {
          await tx.accountReportReserve.createMany({
            data: results.currentYear.data.reserves.map((item) => ({
              reportId: report.id,
              itemName: item.itemName,
              previousBalance: item.previousBalance,
              increase: item.increase,
              decrease: item.decrease,
              currentBalance: item.currentBalance,
              note: item.note,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 기타 자산 저장
        if (results.currentYear.data.assets.length > 0) {
          await tx.accountReportAsset.createMany({
            data: results.currentYear.data.assets.map((item) => ({
              reportId: report.id,
              assetType: item.assetType,
              amount: item.amount,
              maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
              owner: item.owner,
              note: item.note,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 기타 부채 저장
        if (results.currentYear.data.liabilities.length > 0) {
          await tx.accountReportLiability.createMany({
            data: results.currentYear.data.liabilities.map((item) => ({
              reportId: report.id,
              itemName: item.itemName,
              previousBalance: item.previousBalance,
              increase: item.increase,
              decrease: item.decrease,
              currentBalance: item.currentBalance,
              maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
              debtor: item.debtor,
              loanStartDate: item.loanStartDate ? new Date(item.loanStartDate) : null,
              interestRate: item.interestRate,
              note: item.note,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 위원회별 지출 저장
        if (results.currentYear.data.committeeExpenses.length > 0) {
          await tx.accountReportCommitteeExpense.createMany({
            data: results.currentYear.data.committeeExpenses.map((item) => ({
              reportId: report.id,
              committee: item.committee,
              amount: item.amount,
              sortOrder: item.sortOrder,
            })),
          });
        }
      }

      // 전년도 저장
      if (results.previousYear) {
        // 기존 데이터 삭제
        await tx.accountReport.deleteMany({
          where: {
            year,
            quarter,
            reportType: AccountReportType.PREVIOUS_YEAR,
          },
        });

        // 새 보고서 생성
        const report = await tx.accountReport.create({
          data: {
            year,
            quarter,
            reportType: AccountReportType.PREVIOUS_YEAR,
            originalFileName: results.previousYear.fileName,
            summaryData: JSON.parse(JSON.stringify(results.previousYear.data.summary)),
          },
        });

        // 수입 항목 저장
        if (results.previousYear.data.incomeItems.length > 0) {
          await tx.accountReportIncome.createMany({
            data: results.previousYear.data.incomeItems.map((item) => ({
              reportId: report.id,
              itemName: item.itemName,
              parentItemName: item.parentItemName,
              level: item.level,
              budgetAmount: item.budgetAmount,
              cumulativeAmount: item.cumulativeAmount,
              currentAmount: item.currentAmount,
              executionRate: item.executionRate,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 지출 항목 저장
        if (results.previousYear.data.expenseItems.length > 0) {
          await tx.accountReportExpense.createMany({
            data: results.previousYear.data.expenseItems.map((item) => ({
              reportId: report.id,
              itemName: item.itemName,
              parentItemName: item.parentItemName,
              level: item.level,
              budgetAmount: item.budgetAmount,
              cumulativeAmount: item.cumulativeAmount,
              currentAmount: item.currentAmount,
              executionRate: item.executionRate,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 입출금 통장 저장
        if (results.previousYear.data.bankAccounts.length > 0) {
          await tx.accountReportBankAccount.createMany({
            data: results.previousYear.data.bankAccounts.map((item) => ({
              reportId: report.id,
              accountType: item.accountType,
              balance: item.balance,
              accountNumber: item.accountNumber,
              note: item.note,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 적립금 저장
        if (results.previousYear.data.reserves.length > 0) {
          await tx.accountReportReserve.createMany({
            data: results.previousYear.data.reserves.map((item) => ({
              reportId: report.id,
              itemName: item.itemName,
              previousBalance: item.previousBalance,
              increase: item.increase,
              decrease: item.decrease,
              currentBalance: item.currentBalance,
              note: item.note,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 기타 자산 저장
        if (results.previousYear.data.assets.length > 0) {
          await tx.accountReportAsset.createMany({
            data: results.previousYear.data.assets.map((item) => ({
              reportId: report.id,
              assetType: item.assetType,
              amount: item.amount,
              maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
              owner: item.owner,
              note: item.note,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 기타 부채 저장
        if (results.previousYear.data.liabilities.length > 0) {
          await tx.accountReportLiability.createMany({
            data: results.previousYear.data.liabilities.map((item) => ({
              reportId: report.id,
              itemName: item.itemName,
              previousBalance: item.previousBalance,
              increase: item.increase,
              decrease: item.decrease,
              currentBalance: item.currentBalance,
              maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
              debtor: item.debtor,
              loanStartDate: item.loanStartDate ? new Date(item.loanStartDate) : null,
              interestRate: item.interestRate,
              note: item.note,
              sortOrder: item.sortOrder,
            })),
          });
        }

        // 위원회별 지출 저장
        if (results.previousYear.data.committeeExpenses.length > 0) {
          await tx.accountReportCommitteeExpense.createMany({
            data: results.previousYear.data.committeeExpenses.map((item) => ({
              reportId: report.id,
              committee: item.committee,
              amount: item.amount,
              sortOrder: item.sortOrder,
            })),
          });
        }
      }
    });

    return apiSuccess(
      {
        dryRun: false,
        year,
        quarter,
        currentYear: results.currentYear
          ? {
              fileName: results.currentYear.fileName,
              incomeItems: results.currentYear.data.incomeItems.length,
              expenseItems: results.currentYear.data.expenseItems.length,
            }
          : null,
        previousYear: results.previousYear
          ? {
              fileName: results.previousYear.fileName,
              incomeItems: results.previousYear.data.incomeItems.length,
              expenseItems: results.previousYear.data.expenseItems.length,
            }
          : null,
      },
      {
        message: '재정보고서가 성공적으로 업로드되었습니다.',
        code: 'UPLOAD_SUCCESS',
      }
    );
  } catch (error) {
    console.error('Account report upload error:', error);
    return apiError(
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      {
        type: 'SERVER_ERROR',
        code: 'UPLOAD_ERROR',
        status: 500,
      }
    );
  }
}
