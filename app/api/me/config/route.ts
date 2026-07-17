import { NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { resolveTenantSettings } from '@/lib/tenant/settings';

// branding 기본색 — 플랫폼 테넌트 설정(theme.primaryColor)의 기본값과 동일
// (app/api/platform/tenants/[id]/settings/route.ts DEFAULT_SETTINGS)
const DEFAULT_PRIMARY_COLOR = '#4f46e5';

/**
 * GET /api/me/config — 서버 주도 설정 조회 (ARC-002 §4.1, B4)
 *
 * 로그인/조직 전환 시 앱이 호출해 레이블·기능 플래그·브랜딩을 받아 렌더링한다.
 * 응답 계약: { tenant: {id, name, orgType}, labels, features, branding: {logoUrl, primaryColor} }
 */
const handleGet: UserApiHandler = async (_request, { user }) => {
  try {
    const tenant = await prismaBase.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        name: true,
        orgType: true,
        logoUrl: true,
        settings: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: '조직 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // labels/features — orgType 기본값 위에 저장값 딥머지 (A6)
    const { labels, features } = resolveTenantSettings(tenant);

    // primaryColor — 플랫폼 어드민 설정 관례(settings.theme.primaryColor)를 따른다
    const theme = (tenant.settings as { theme?: { primaryColor?: string } } | null)
      ?.theme;
    const primaryColor =
      typeof theme?.primaryColor === 'string'
        ? theme.primaryColor
        : DEFAULT_PRIMARY_COLOR;

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        orgType: tenant.orgType,
      },
      labels,
      features,
      branding: {
        logoUrl: tenant.logoUrl,
        primaryColor,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
