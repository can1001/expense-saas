import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';
import { logPlatformActivity } from '@/lib/platform/activity-log';

// CSV 이스케이프 함수
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// CSV 생성 함수
function toCSV(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// 날짜 포맷
function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

// 금액 포맷
function formatAmount(amount: number | null): string {
  if (amount === null) return '';
  return amount.toLocaleString('ko-KR');
}

// GET /api/platform/export - 데이터 내보내기
export const GET = withSuperAdmin(async (request: NextRequest, { superAdmin }) => {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'tenants';
    const format = url.searchParams.get('format') || 'csv';
    const tenantId = url.searchParams.get('tenantId');

    let data: unknown;
    let filename: string;
    let headers: string[];
    let rows: unknown[][] = [];

    switch (type) {
      case 'tenants': {
        const tenants = await prismaBase.tenant.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                users: true,
                expenses: true,
              },
            },
          },
        });

        headers = [
          'ID', '이름', '서브도메인', '커스텀도메인', '조직유형', '요금제',
          '최대사용자', '현재사용자', '최대스토리지(MB)', '현재스토리지(MB)',
          '활성상태', '정지사유', '지출결의서수', '생성일', '수정일'
        ];

        rows = tenants.map(t => [
          t.id,
          t.name,
          t.subdomain,
          t.customDomain || '',
          t.orgType,
          t.plan,
          t.maxUsers,
          t.currentUsers,
          t.maxStorageMB,
          t.currentStorage,
          t.isActive ? '활성' : '비활성',
          t.suspendReason || '',
          t._count.expenses,
          formatDate(t.createdAt),
          formatDate(t.updatedAt),
        ]);

        data = tenants;
        filename = `tenants_${formatDate(new Date())}`;
        break;
      }

      case 'users': {
        const whereClause = tenantId ? { tenantId } : {};
        const users = await prismaBase.user.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          include: {
            tenant: {
              select: { name: true, subdomain: true },
            },
          },
        });

        headers = [
          'ID', '테넌트', '사용자ID', '이름', '역할', '부서',
          '전화번호', '활성상태', '생성일', '수정일'
        ];

        rows = users.map(u => [
          u.id,
          u.tenant?.name || '',
          u.userid,
          u.username,
          u.role,
          u.department || '',
          u.phoneNumber || '',
          u.isActive ? '활성' : '비활성',
          formatDate(u.createdAt),
          formatDate(u.updatedAt),
        ]);

        data = users;
        filename = tenantId ? `users_${tenantId}_${formatDate(new Date())}` : `users_all_${formatDate(new Date())}`;
        break;
      }

      case 'expenses': {
        const whereClause = tenantId ? { tenantId } : {};
        const expenses = await prismaBase.expense.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: 10000, // 최대 10000건
          include: {
            tenant: {
              select: { name: true },
            },
            user: {
              select: { username: true },
            },
          },
        });

        headers = [
          'ID', '테넌트', '작성자', '위원회', '부서', '청구금액',
          '상태', '지출일', '생성일', '승인일'
        ];

        rows = expenses.map(e => [
          e.id,
          e.tenant?.name || '',
          e.user?.username || '',
          e.committee,
          e.department,
          formatAmount(e.requestAmount),
          e.status,
          formatDate(e.expenseDate),
          formatDate(e.createdAt),
          formatDate(e.approvedAt),
        ]);

        data = expenses;
        filename = tenantId ? `expenses_${tenantId}_${formatDate(new Date())}` : `expenses_all_${formatDate(new Date())}`;
        break;
      }

      case 'activity-logs': {
        const logs = await prismaBase.platformActivityLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });

        headers = [
          'ID', '관리자이메일', '테넌트', '액션', '엔티티유형',
          '엔티티ID', 'IP주소', '생성일시'
        ];

        rows = logs.map(l => [
          l.id,
          l.superAdminEmail,
          l.tenantName || '',
          l.action,
          l.entityType,
          l.entityId || '',
          l.ipAddress || '',
          l.createdAt.toISOString(),
        ]);

        data = logs;
        filename = `activity_logs_${formatDate(new Date())}`;
        break;
      }

      case 'admins': {
        const admins = await prismaBase.superAdmin.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        headers = ['ID', '이메일', '이름', '활성상태', '생성일', '수정일'];

        rows = admins.map(a => [
          a.id,
          a.email,
          a.name,
          a.isActive ? '활성' : '비활성',
          formatDate(a.createdAt),
          formatDate(a.updatedAt),
        ]);

        data = admins;
        filename = `admins_${formatDate(new Date())}`;
        break;
      }

      default:
        return NextResponse.json(
          { error: '지원하지 않는 내보내기 유형입니다.' },
          { status: 400 }
        );
    }

    // 활동 로그 기록
    await logPlatformActivity({
      superAdminId: superAdmin.id,
      superAdminEmail: superAdmin.email,
      action: 'EXPORT_DATA',
      entityType: 'export',
      tenantId: tenantId || undefined,
      details: {
        exportType: type,
        format,
        rowCount: rows.length,
      },
    });

    // 포맷에 따른 응답
    if (format === 'json') {
      return NextResponse.json({
        type,
        exportedAt: new Date().toISOString(),
        count: rows.length,
        data,
      });
    }

    // CSV 응답
    const csv = toCSV(headers, rows);
    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});
