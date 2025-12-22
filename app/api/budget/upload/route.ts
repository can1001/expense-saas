/**
 * 예산 마스터 데이터 업로드 API
 *
 * POST /api/budget/upload
 * - Excel 파일 업로드 및 BudgetMaster 테이블 업데이트
 *
 * GET /api/budget/upload
 * - 현재 예산 데이터를 Excel 템플릿으로 다운로드
 */

import { NextResponse } from 'next/server';
import {
  parseExcelFile,
  uploadBudgetData,
  exportBudgetTemplate,
  type UploadMode,
} from '@/lib/budget-upload';
import {
  apiSuccess,
  apiError,
  apiValidationError,
} from '@/lib/api/response-handler';

/**
 * POST: 예산 데이터 업로드
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as UploadMode) || 'merge';
    const dryRun = formData.get('dryRun') === 'true';

    // 파일 검증
    if (!file) {
      return apiValidationError('파일이 필요합니다.', [
        { fieldName: 'file', message: '업로드할 Excel 파일을 선택해주세요.' },
      ]);
    }

    // 파일 타입 검증
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return apiValidationError('지원하지 않는 파일 형식입니다.', [
        { fieldName: 'file', message: 'Excel 파일(.xlsx, .xls)만 업로드 가능합니다.' },
      ]);
    }

    // 모드 검증
    if (!['replace', 'merge', 'append'].includes(mode)) {
      return apiValidationError('잘못된 업로드 모드입니다.', [
        { fieldName: 'mode', message: 'mode는 replace, merge, append 중 하나여야 합니다.' },
      ]);
    }

    // Excel 파일 파싱
    const buffer = await file.arrayBuffer();
    const { rows, validationErrors: parseErrors } = await parseExcelFile(buffer);

    if (parseErrors.length > 0) {
      return apiValidationError(
        `파싱 오류: ${parseErrors.length}개의 행에서 문제가 발견되었습니다.`,
        parseErrors.map((e) => ({
          fieldName: `row_${e.row}_${e.field}`,
          message: `행 ${e.row}: ${e.message}`,
        }))
      );
    }

    if (rows.length === 0) {
      return apiValidationError('업로드할 데이터가 없습니다.', [
        { fieldName: 'file', message: 'Excel 파일에 데이터가 없습니다.' },
      ]);
    }

    // 데이터 업로드
    const result = await uploadBudgetData(rows, mode, { dryRun });

    if (!result.success) {
      return apiError('업로드 중 오류가 발생했습니다.', {
        type: 'SERVER_ERROR',
        code: 'UPLOAD_ERROR',
        status: 500,
        details: result.validationErrors,
      });
    }

    return apiSuccess(
      {
        summary: result.summary,
        dryRun,
        mode,
      },
      {
        message: dryRun
          ? '검증이 완료되었습니다. dryRun=false로 실제 업로드를 수행하세요.'
          : `${result.summary.created}개 생성, ${result.summary.updated}개 업데이트, ${result.summary.skipped}개 건너뜀`,
        code: 'UPLOAD_SUCCESS',
      }
    );
  } catch (error) {
    console.error('Budget upload error:', error);
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

/**
 * GET: 예산 데이터 템플릿 다운로드
 */
export async function GET() {
  try {
    const buffer = await exportBudgetTemplate();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="budget_template_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Budget template export error:', error);
    return apiError(
      error instanceof Error ? error.message : '템플릿 생성 중 오류가 발생했습니다.',
      {
        type: 'SERVER_ERROR',
        code: 'EXPORT_ERROR',
        status: 500,
      }
    );
  }
}
