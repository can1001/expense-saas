import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { updateTenantSchema, planLimits } from '@/lib/validators/tenant';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { invalidateTenantCache } from '@/lib/tenant';

// GET /api/platform/tenants/[id] - 테넌트 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: SuperAdmin 인증 확인

    const { id } = await params;

    const tenant = await prismaBase.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            expenses: true,
            simpleExpenses: true,
            recurringExpenses: true,
            committees: true,
            budgetCategories: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/platform/tenants/[id] - 테넌트 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: SuperAdmin 인증 확인

    const { id } = await params;
    const body = await request.json();

    // 유효성 검사
    const data = updateTenantSchema.parse(body);

    // 기존 테넌트 확인
    const existingTenant = await prismaBase.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // customDomain 중복 확인
    if (data.customDomain && data.customDomain !== existingTenant.customDomain) {
      const existingDomain = await prismaBase.tenant.findUnique({
        where: { customDomain: data.customDomain },
      });

      if (existingDomain) {
        throw new ApiError('이미 사용 중인 커스텀 도메인입니다.', 409);
      }
    }

    // 요금제 변경 시 제한 업데이트
    const updateData: Record<string, unknown> = { ...data };

    if (data.plan && data.plan !== existingTenant.plan) {
      const limits = planLimits[data.plan];
      updateData.maxUsers = data.maxUsers ?? limits.maxUsers;
      updateData.maxStorageMB = data.maxStorageMB ?? limits.maxStorageMB;
      updateData.planStartAt = new Date();
    }

    // 정지 처리
    if (data.isActive === false && existingTenant.isActive === true) {
      updateData.suspendedAt = new Date();
    } else if (data.isActive === true && existingTenant.isActive === false) {
      updateData.suspendedAt = null;
      updateData.suspendReason = null;
    }

    // 업데이트 실행
    const tenant = await prismaBase.tenant.update({
      where: { id },
      data: updateData,
    });

    // 캐시 무효화
    invalidateTenantCache(id, existingTenant.subdomain);

    return NextResponse.json(tenant);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { errors?: Array<{ path: string[]; message: string }> };
      const errorMessages = zodError.errors?.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return NextResponse.json(
        { error: '입력 데이터가 유효하지 않습니다.', details: errorMessages },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}

// DELETE /api/platform/tenants/[id] - 테넌트 삭제 (소프트 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: SuperAdmin 인증 확인

    const { id } = await params;
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    // 기존 테넌트 확인
    const existingTenant = await prismaBase.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            expenses: true,
          },
        },
      },
    });

    if (!existingTenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (hardDelete) {
      // 하드 삭제 (데이터 완전 삭제) - 주의 필요
      // 연관된 모든 데이터도 함께 삭제됨
      if (existingTenant._count.expenses > 0 || existingTenant._count.users > 0) {
        throw new ApiError(
          '데이터가 있는 테넌트는 완전 삭제할 수 없습니다. 먼저 데이터를 삭제하거나 소프트 삭제를 사용하세요.',
          400
        );
      }

      await prismaBase.tenant.delete({
        where: { id },
      });

      // 캐시 무효화
      invalidateTenantCache(id, existingTenant.subdomain);

      return NextResponse.json({ message: '테넌트가 완전히 삭제되었습니다.' });
    } else {
      // 소프트 삭제 (비활성화)
      const tenant = await prismaBase.tenant.update({
        where: { id },
        data: {
          isActive: false,
          suspendedAt: new Date(),
          suspendReason: '관리자에 의해 삭제됨',
        },
      });

      // 캐시 무효화
      invalidateTenantCache(id, existingTenant.subdomain);

      return NextResponse.json({
        message: '테넌트가 비활성화되었습니다.',
        tenant,
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
