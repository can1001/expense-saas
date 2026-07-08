import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';

/**
 * GET /api/tenant/info - 현재 요청의 테넌트 정보 조회 (공개 API)
 * 서브도메인 기반으로 테넌트 정보를 반환합니다.
 * 로그인 페이지 등에서 조직명을 표시할 때 사용합니다.
 */
export async function GET(request: NextRequest) {
  // 미들웨어에서 설정한 서브도메인 헤더 확인
  const subdomain = request.headers.get('x-tenant-subdomain');
  const tenantParam = request.headers.get('x-tenant-param');
  const tenantIdentifier = subdomain || tenantParam;

  if (!tenantIdentifier) {
    // 테넌트 식별자가 없으면 기본 응답
    return NextResponse.json({
      tenant: null,
      message: '테넌트 정보가 없습니다. 서브도메인을 통해 접속해주세요.',
    });
  }

  try {
    // 테넌트 조회 (공개 정보만)
    const tenant = await prismaBase.tenant.findUnique({
      where: { subdomain: tenantIdentifier },
      select: {
        id: true,
        name: true,
        subdomain: true,
        orgType: true,
        logoUrl: true,
        isActive: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: '존재하지 않는 조직입니다.', tenant: null },
        { status: 404 }
      );
    }

    if (!tenant.isActive) {
      return NextResponse.json(
        { error: '이 조직은 현재 이용할 수 없습니다.', tenant: null },
        { status: 403 }
      );
    }

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        orgType: tenant.orgType,
        logoUrl: tenant.logoUrl,
      },
    });
  } catch (error) {
    console.error('테넌트 정보 조회 오류:', error);
    return NextResponse.json(
      { error: '테넌트 정보를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
