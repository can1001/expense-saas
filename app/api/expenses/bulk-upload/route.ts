/**
 * POST /api/expenses/bulk-upload
 *
 * 엑셀 파일로 지출결의서 일괄 등록 (행정간사/관리자 전용).
 *
 * Form fields:
 *  - file: .xlsx (필수)
 *  - dryRun: 'true' | 'false' (선택, 기본 false)
 *
 * 응답: BulkUploadResult
 *  - dryRun=true: { errors, preview, ... }  (DB 변경 없음)
 *  - dryRun=false + errors=[]: { createdIds, ... }
 *  - dryRun=false + errors!=[]: 저장 없이 errors 반환
 *
 * 권한: admin, admin_assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  parseExpenseExcelBuffer,
  executeBulkUpload,
  MAX_ROWS,
} from '@/lib/services/bulk-expense-upload-service';

// exceljs는 Node 전용 + 트랜잭션 wall-clock 여유 확보
export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_ROLES = ['admin', 'admin_assistant'] as const;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 500행 분량은 보통 200KB 이하

export async function POST(request: NextRequest) {
  // 권한 체크
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  // 파일 크기 사전 검사 — Content-Length 누락 요청도 거부 (formData가 무제한 메모리 로드 방지)
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? NaN : Number(contentLengthHeader);
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `파일 크기를 확인할 수 없거나 너무 큽니다 (최대 ${MAX_FILE_BYTES / 1024 / 1024}MB, Content-Length 헤더 필수).`,
      },
      { status: 413 }
    );
  }

  // multipart 파싱
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const file = formData.get('file');
  const dryRun = formData.get('dryRun') === 'true';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
  }

  const isXlsx =
    file.name.toLowerCase().endsWith('.xlsx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (!isXlsx) {
    return NextResponse.json(
      { error: 'Excel(.xlsx) 파일만 업로드할 수 있습니다.' },
      { status: 400 }
    );
  }

  // 파일 → 버퍼 (Content-Length 헤더 우회 방지 — 한 번 더 검사)
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `파일이 너무 큽니다 (최대 ${MAX_FILE_BYTES / 1024 / 1024}MB).` },
      { status: 413 }
    );
  }
  const buffer = Buffer.from(arrayBuffer);

  // 파싱
  let rows;
  try {
    rows = await parseExpenseExcelBuffer(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: `Excel 파싱 실패: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Excel 파일에 데이터가 없습니다.' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `한 번에 업로드 가능한 최대 행 수(${MAX_ROWS})를 초과했습니다. 현재 ${rows.length}행.` },
      { status: 400 }
    );
  }

  // 실행 — 청구인 정보는 모두 로그인 사용자(업로더)에서 자동 채움
  try {
    const result = await executeBulkUpload(rows, { dryRun }, {
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(result);
  } catch (err) {
    // 트랜잭션 내 DB 에러 등 — 전체 롤백된 상태
    return NextResponse.json(
      {
        error: '일괄 업로드 처리 중 오류가 발생했습니다. 모든 변경사항은 롤백되었습니다.',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
