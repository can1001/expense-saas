/**
 * GET /api/expenses/bulk-upload-template
 *
 * 지출결의서 일괄 업로드용 엑셀 템플릿 다운로드.
 * 권한: admin, admin_assistant — 다중 역할 지원 (UI 메뉴 권한과 동일 기준)
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserAllYearRoles } from '@/lib/services/user-service';
import { canAccessAdminMenuPathWithRoles } from '@/lib/constants/menu-permissions';
import { buildExpenseTemplateWorkbook } from '@/lib/services/bulk-expense-template';

const ROUTE_PATH = '/admin/expense-upload';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const roles = await getUserAllYearRoles(user.id);
  if (!canAccessAdminMenuPathWithRoles(roles, ROUTE_PATH)) {
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
