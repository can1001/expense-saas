/**
 * GET /api/expenses/bulk-upload-template
 *
 * 지출결의서 일괄 업로드용 엑셀 템플릿 다운로드.
 * 권한: admin, admin_assistant
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { buildExpenseTemplateWorkbook } from '@/lib/services/bulk-expense-template';

const ALLOWED_ROLES = ['admin', 'admin_assistant'] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const buffer = await buildExpenseTemplateWorkbook();

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="expense-bulk-upload-template.xlsx"',
      'Content-Length': String(buffer.length),
    },
  });
}
