import { NextRequest, NextResponse } from 'next/server';
import { prismaBase, Prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';
import { logPlatformActivity } from '@/lib/platform/activity-log';
import { z } from 'zod';

// 플랫폼 설정 스키마
const platformSettingsSchema = z.object({
  general: z
    .object({
      platformName: z.string().min(1).max(100).optional(),
      platformDomain: z.string().max(200).optional(),
      supportEmail: z.string().email().optional(),
      logoUrl: z.string().url().optional().or(z.literal('')),
      faviconUrl: z.string().url().optional().or(z.literal('')),
      footerText: z.string().max(500).optional(),
    })
    .optional(),
  security: z
    .object({
      defaultSessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
      defaultPasswordMinLength: z.number().int().min(6).max(32).optional(),
      requirePasswordUppercase: z.boolean().optional(),
      requirePasswordNumber: z.boolean().optional(),
      requirePasswordSpecial: z.boolean().optional(),
      maxLoginAttempts: z.number().int().min(3).max(10).optional(),
      lockoutDurationMinutes: z.number().int().min(1).max(60).optional(),
    })
    .optional(),
  defaults: z
    .object({
      defaultPlan: z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']).optional(),
      defaultOrgType: z.enum(['CHURCH', 'NONPROFIT', 'SCHOOL', 'COMPANY', 'OTHER']).optional(),
      trialDays: z.number().int().min(0).max(90).optional(),
      autoCreateAdminRole: z.boolean().optional(),
    })
    .optional(),
  maintenance: z
    .object({
      enabled: z.boolean().optional(),
      message: z.string().max(500).optional(),
      allowedIPs: z.array(z.string()).optional(),
      scheduledStart: z.string().datetime().optional().or(z.literal('')),
      scheduledEnd: z.string().datetime().optional().or(z.literal('')),
    })
    .optional(),
  email: z
    .object({
      smtpHost: z.string().max(200).optional(),
      smtpPort: z.number().int().min(1).max(65535).optional(),
      smtpUser: z.string().max(200).optional(),
      smtpFromEmail: z.string().email().optional().or(z.literal('')),
      smtpFromName: z.string().max(100).optional(),
    })
    .optional(),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

// 기본 설정값
const DEFAULT_SETTINGS: PlatformSettings = {
  general: {
    platformName: 'Expense SaaS',
    platformDomain: '',
    supportEmail: '',
    logoUrl: '',
    faviconUrl: '',
    footerText: '',
  },
  security: {
    defaultSessionTimeoutMinutes: 60,
    defaultPasswordMinLength: 8,
    requirePasswordUppercase: true,
    requirePasswordNumber: true,
    requirePasswordSpecial: false,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
  },
  defaults: {
    defaultPlan: 'FREE',
    defaultOrgType: 'CHURCH',
    trialDays: 14,
    autoCreateAdminRole: true,
  },
  maintenance: {
    enabled: false,
    message: '시스템 점검 중입니다. 잠시 후 다시 시도해 주세요.',
    allowedIPs: [],
    scheduledStart: '',
    scheduledEnd: '',
  },
  email: {
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpFromEmail: '',
    smtpFromName: 'Expense SaaS',
  },
};

// 설정 키 상수
const SETTINGS_KEY = 'platform_settings';

// GET /api/platform/settings - 플랫폼 설정 조회
export const GET = withSuperAdmin(async () => {
  try {
    // 플랫폼 설정 조회 (tenantId가 null인 것)
    const setting = await prismaBase.systemSetting.findFirst({
      where: {
        tenantId: null,
        key: SETTINGS_KEY,
      },
    });

    let currentSettings: PlatformSettings = {};
    if (setting?.value) {
      try {
        currentSettings = JSON.parse(setting.value);
      } catch {
        currentSettings = {};
      }
    }

    // 기본값과 병합
    const mergedSettings = mergeDeep(DEFAULT_SETTINGS, currentSettings);

    return NextResponse.json({
      settings: mergedSettings,
      defaults: DEFAULT_SETTINGS,
      updatedAt: setting?.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

// PUT /api/platform/settings - 플랫폼 설정 업데이트
export const PUT = withSuperAdmin(async (request: NextRequest, { superAdmin }) => {
  try {
    const body = await request.json();

    // 유효성 검사
    const validatedSettings = platformSettingsSchema.parse(body);

    // 기존 설정 조회
    const existingSetting = await prismaBase.systemSetting.findFirst({
      where: {
        tenantId: null,
        key: SETTINGS_KEY,
      },
    });

    let currentSettings: PlatformSettings = {};
    if (existingSetting?.value) {
      try {
        currentSettings = JSON.parse(existingSetting.value);
      } catch {
        currentSettings = {};
      }
    }

    // 설정 병합
    const mergedSettings = mergeDeep(currentSettings, validatedSettings);
    const settingsJson = JSON.stringify(mergedSettings);

    // 설정 저장
    if (existingSetting) {
      await prismaBase.systemSetting.update({
        where: { id: existingSetting.id },
        data: {
          value: settingsJson,
          description: '플랫폼 전역 설정',
        },
      });
    } else {
      await prismaBase.systemSetting.create({
        data: {
          tenantId: null,
          key: SETTINGS_KEY,
          value: settingsJson,
          description: '플랫폼 전역 설정',
        },
      });
    }

    // 활동 로그 기록
    await logPlatformActivity({
      superAdminId: superAdmin.id,
      superAdminEmail: superAdmin.email,
      action: 'UPDATE_TENANT_SETTINGS', // 플랫폼 설정도 같은 액션 사용
      entityType: 'settings',
      entityId: 'platform',
      details: {
        changedSections: Object.keys(validatedSettings),
        changes: validatedSettings as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      message: '설정이 저장되었습니다.',
      settings: mergedSettings,
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
