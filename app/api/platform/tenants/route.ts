import { NextRequest, NextResponse } from 'next/server';
import { prismaBase, Prisma } from '@/lib/prisma';
import {
  createTenantSchema,
  listTenantsQuerySchema,
  planLimits,
} from '@/lib/validators/tenant';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';
import { logPlatformActivity } from '@/lib/platform/activity-log';
import bcrypt from 'bcryptjs';

// GET /api/platform/tenants - 테넌트 목록 조회
export const GET = withSuperAdmin(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // 쿼리 파라미터 유효성 검사
    const query = listTenantsQuerySchema.parse(queryParams);

    const { page, limit, search, plan, orgType, isActive, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // where 조건 구성
    const where: Prisma.TenantWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
        { customDomain: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (plan) {
      where.plan = plan;
    }

    if (orgType) {
      where.orgType = orgType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // 정렬 조건
    const orderBy: Prisma.TenantOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // 쿼리 실행
    const [tenants, total] = await Promise.all([
      prismaBase.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          subdomain: true,
          customDomain: true,
          orgType: true,
          plan: true,
          maxUsers: true,
          maxStorageMB: true,
          currentUsers: true,
          currentStorage: true,
          isActive: true,
          suspendedAt: true,
          suspendReason: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              expenses: true,
            },
          },
        },
      }),
      prismaBase.tenant.count({ where }),
    ]);

    return NextResponse.json({
      tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});

// POST /api/platform/tenants - 테넌트 생성
export const POST = withSuperAdmin(async (request: NextRequest, { superAdmin }) => {
  try {
    const body = await request.json();

    // 유효성 검사
    const data = createTenantSchema.parse(body);

    // subdomain 중복 확인
    const existingSubdomain = await prismaBase.tenant.findUnique({
      where: { subdomain: data.subdomain },
    });

    if (existingSubdomain) {
      throw new ApiError('이미 사용 중인 서브도메인입니다.', 409);
    }

    // customDomain 중복 확인
    if (data.customDomain) {
      const existingDomain = await prismaBase.tenant.findUnique({
        where: { customDomain: data.customDomain },
      });

      if (existingDomain) {
        throw new ApiError('이미 사용 중인 커스텀 도메인입니다.', 409);
      }
    }

    // 요금제에 따른 기본 제한 설정
    const limits = planLimits[data.plan];

    // 트랜잭션으로 테넌트 및 초기 관리자 생성
    const tenant = await prismaBase.$transaction(async (tx) => {
      // 1. 테넌트 생성
      const newTenant = await tx.tenant.create({
        data: {
          name: data.name,
          subdomain: data.subdomain,
          customDomain: data.customDomain,
          orgType: data.orgType,
          description: data.description,
          logoUrl: data.logoUrl,
          plan: data.plan,
          maxUsers: limits.maxUsers,
          maxStorageMB: limits.maxStorageMB,
          planStartAt: new Date(),
        },
      });

      // 2. 기본 역할 생성
      const roles = [
        {
          tenantId: newTenant.id,
          code: 'admin',
          name: '관리자',
          description: '시스템 전체 관리 권한',
          sortOrder: 0,
          canApprove: true,
          canManageExpense: true,
          canAccessAdmin: true,
          canExportData: true,
          canRegisterUsers: true,
        },
        {
          tenantId: newTenant.id,
          code: 'finance_head',
          name: '재정팀장',
          description: '재정 관리 및 최종 결재 권한',
          stepNumber: 3,
          sortOrder: 1,
          canApprove: true,
          canManageExpense: true,
          canAccessAdmin: true,
          canExportData: true,
        },
        {
          tenantId: newTenant.id,
          code: 'accountant',
          name: '회계',
          description: '회계 처리 및 2차 결재 권한',
          stepNumber: 2,
          sortOrder: 2,
          canApprove: true,
          canManageExpense: true,
        },
        {
          tenantId: newTenant.id,
          code: 'team_leader',
          name: '팀장',
          description: '팀 관리 및 1차 결재 권한',
          stepNumber: 1,
          sortOrder: 3,
          canApprove: true,
        },
        {
          tenantId: newTenant.id,
          code: 'user',
          name: '사용자',
          description: '일반 사용자 (지출결의서 작성)',
          sortOrder: 4,
        },
      ];

      await tx.role.createMany({ data: roles });

      // 3. 초기 관리자 계정 생성 (제공된 경우)
      if (data.adminEmail && data.adminName && data.adminPassword) {
        const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

        await tx.user.create({
          data: {
            tenantId: newTenant.id,
            userid: data.adminEmail,
            username: data.adminName,
            password: hashedPassword,
            role: 'admin',
            isActive: true,
          },
        });

        // 현재 사용자 수 업데이트
        await tx.tenant.update({
          where: { id: newTenant.id },
          data: { currentUsers: 1 },
        });
      }

      return newTenant;
    });

    // 활동 로그 기록
    await logPlatformActivity({
      superAdminId: superAdmin.id,
      superAdminEmail: superAdmin.email,
      action: 'CREATE_TENANT',
      entityType: 'tenant',
      entityId: tenant.id,
      tenantId: tenant.id,
      tenantName: tenant.name,
      details: {
        name: tenant.name,
        subdomain: tenant.subdomain,
        plan: tenant.plan,
        orgType: tenant.orgType,
        hasInitialAdmin: !!(data.adminEmail),
      },
    });

    return NextResponse.json(tenant, { status: 201 });
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
});
