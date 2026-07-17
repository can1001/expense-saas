/**
 * Tenant.settings labels/features 표준화 (ARC-001 §3.3)
 *
 * - `TenantSettings`: settings JSON의 labels/features 표준 구조 (zod)
 * - `defaultSettingsForOrgType()`: orgType별 기본값 (§3.3 표)
 * - `resolveTenantSettings()`: 저장값과 기본값의 딥머지 — 저장값이 기본값을 부분 override
 *
 * 운영 원칙: features 플래그는 "노출 제어"이지 "데이터 제어"가 아니다 —
 * 플래그를 true→false로 끄더라도 기존 데이터는 삭제하지 않고 화면만 숨긴다 (§3.3).
 *
 * 클라이언트 컴포넌트에서 안전하게 사용 가능 (Prisma 미의존).
 */

import { z } from 'zod';
import { getOrgTerms } from '@/lib/org-terms';

// 화면 표시 레이블 (§3.3 예시: department/position/budget)
export const tenantLabelsSchema = z.object({
  department: z.string(),
  position: z.string(),
  budget: z.string(),
});

// 기능 노출 플래그 (§3.3 표)
export const tenantFeaturesSchema = z.object({
  incomeModule: z.boolean(),
  budgetModule: z.boolean(),
  vat: z.boolean(),
  taxInvoice: z.boolean(),
  offeringLink: z.boolean(),
});

export const tenantSettingsSchema = z.object({
  labels: tenantLabelsSchema,
  features: tenantFeaturesSchema,
});

export type TenantLabels = z.infer<typeof tenantLabelsSchema>;
export type TenantFeatures = z.infer<typeof tenantFeaturesSchema>;
export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

// 저장된 settings JSON 파싱용 — labels/features 각각 부분 저장을 허용하고,
// approvalLines 등 그 외 키는 무시한다 (이 모듈은 labels/features만 담당)
const storedTenantSettingsSchema = z.object({
  labels: tenantLabelsSchema.partial().optional(),
  features: tenantFeaturesSchema.partial().optional(),
});

/**
 * orgType별 기본 settings (ARC-001 §3.3 표 기준).
 *
 * | 플래그        | CHURCH | COMPANY |
 * |--------------|--------|---------|
 * | incomeModule | true   | false   |
 * | budgetModule | true   | true    |
 * | vat          | false  | true    |
 * | taxInvoice   | false  | true    |
 * | offeringLink | true   | false   |
 *
 * §3.3 표는 CHURCH/COMPANY만 정의 — 그 외 유형은 보수적으로 부가세·세금계산서 비활성.
 */
export function defaultSettingsForOrgType(orgType: string): TenantSettings {
  const terms = getOrgTerms(orgType);
  const isChurch = orgType === 'CHURCH';
  const isCompany = orgType === 'COMPANY';

  return {
    labels: {
      department: terms.department,
      position: isChurch ? '직분' : '직급',
      budget: '예산(회계연도)',
    },
    features: {
      incomeModule: isChurch,
      budgetModule: true,
      vat: isCompany,
      taxInvoice: isCompany,
      offeringLink: isChurch,
    },
  };
}

/**
 * 테넌트의 실효 settings 계산 — orgType 기본값 위에 저장값을 딥머지한다.
 *
 * - 저장값이 없거나 구조가 유효하지 않으면 기본값을 그대로 반환 (fail-safe)
 * - labels/features 각각 저장된 키만 기본값을 override
 */
export function resolveTenantSettings(tenant: {
  orgType: string;
  settings?: unknown;
}): TenantSettings {
  const defaults = defaultSettingsForOrgType(tenant.orgType);
  const parsed = storedTenantSettingsSchema.safeParse(tenant.settings ?? {});
  if (!parsed.success) {
    return defaults;
  }

  return {
    labels: { ...defaults.labels, ...parsed.data.labels },
    features: { ...defaults.features, ...parsed.data.features },
  };
}
