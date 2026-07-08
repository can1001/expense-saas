import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';
import { invalidateTenantCache } from '@/lib/tenant';
import { z } from 'zod';

// 테넌트 설정 스키마
const tenantSettingsSchema = z.object({
  theme: z
    .object({
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      logoPosition: z.enum(['left', 'center']).optional(),
      darkModeEnabled: z.boolean().optional(),
    })
    .optional(),
  notifications: z
    .object({
      emailEnabled: z.boolean().optional(),
      emailOnNewExpense: z.boolean().optional(),
      emailOnApproval: z.boolean().optional(),
      emailOnRejection: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
      pushOnNewExpense: z.boolean().optional(),
      pushOnApproval: z.boolean().optional(),
    })
    .optional(),
  expense: z
    .object({
      requireAttachment: z.boolean().optional(),
      requireDescription: z.boolean().optional(),
      allowDraftSave: z.boolean().optional(),
      maxItemsPerExpense: z.number().int().min(1).max(50).optional(),
      defaultCurrency: z.string().length(3).optional(),
    })
    .optional(),
  approval: z
    .object({
      autoApproveUnderAmount: z.number().min(0).optional(),
      requireAllApprovers: z.boolean().optional(),
      allowSelfApproval: z.boolean().optional(),
    })
    .optional(),
  security: z
    .object({
      sessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
      requirePasswordChange: z.boolean().optional(),
      passwordChangeIntervalDays: z.number().int().min(0).max(365).optional(),
      twoFactorEnabled: z.boolean().optional(),
    })
    .optional(),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

// 기본 설정값
const DEFAULT_SETTINGS: TenantSettings = {
  theme: {
    primaryColor: '#4f46e5',
    accentColor: '#6366f1',
    logoPosition: 'left',
    darkModeEnabled: false,
  },
  notifications: {
    emailEnabled: true,
    emailOnNewExpense: true,
    emailOnApproval: true,
    emailOnRejection: true,
    pushEnabled: true,
    pushOnNewExpense: true,
    pushOnApproval: true,
  },
  expense: {
    requireAttachment: false,
    requireDescription: true,
    allowDraftSave: true,
    maxItemsPerExpense: 20,
    defaultCurrency: 'KRW',
  },
  approval: {
    autoApproveUnderAmount: 0,
    requireAllApprovers: true,
    allowSelfApproval: false,
  },
  security: {
    sessionTimeoutMinutes: 60,
    requirePasswordChange: false,
    passwordChangeIntervalDays: 90,
    twoFactorEnabled: false,
  },
};

// GET /api/platform/tenants/[id]/settings - 테넌트 설정 조회
export const GET = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const { id } = await params!;

    const tenant = await prismaBase.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        settings: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 저장된 설정과 기본값 병합
    const currentSettings = (tenant.settings as TenantSettings) || {};
    const mergedSettings = mergeDeep(DEFAULT_SETTINGS, currentSettings);

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      settings: mergedSettings,
      defaults: DEFAULT_SETTINGS,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

// PUT /api/platform/tenants/[id]/settings - 테넌트 설정 업데이트
export const PUT = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const { id } = await params!;
    const body = await request.json();

    // 유효성 검사
    const validatedSettings = tenantSettingsSchema.parse(body);

    // 테넌트 존재 확인
    const existingTenant = await prismaBase.tenant.findUnique({
      where: { id },
      select: { id: true, subdomain: true, settings: true },
    });

    if (!existingTenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 기존 설정과 병합
    const currentSettings = (existingTenant.settings as TenantSettings) || {};
    const mergedSettings = mergeDeep(currentSettings, validatedSettings);

    // 설정 업데이트
    const tenant = await prismaBase.tenant.update({
      where: { id },
      data: { settings: mergedSettings },
      select: {
        id: true,
        name: true,
        subdomain: true,
        settings: true,
      },
    });

    // 캐시 무효화
    invalidateTenantCache(id, existingTenant.subdomain);

    return NextResponse.json({
      message: '설정이 저장되었습니다.',
      settings: tenant.settings,
    });
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

// PATCH도 PUT과 동일하게 처리
export const PATCH = PUT;

// 깊은 병합 헬퍼 함수
function mergeDeep<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const output = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (output as Record<string, unknown>)[key] = mergeDeep(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (sourceValue !== undefined) {
        (output as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }

  return output;
}
