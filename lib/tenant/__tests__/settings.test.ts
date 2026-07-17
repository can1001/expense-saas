/**
 * Tenant.settings labels/features 표준화 테스트 (A6, ARC-001 §3.3)
 */

import { describe, it, expect } from 'vitest';
import {
  defaultSettingsForOrgType,
  resolveTenantSettings,
  tenantSettingsSchema,
} from '../settings';
import { getOrgTerms } from '@/lib/org-terms';

describe('defaultSettingsForOrgType', () => {
  it('CHURCH: §3.3 표와 일치 — incomeModule/offeringLink true, vat/taxInvoice false', () => {
    const settings = defaultSettingsForOrgType('CHURCH');

    expect(settings.features).toEqual({
      incomeModule: true,
      budgetModule: true,
      vat: false,
      taxInvoice: false,
      offeringLink: true,
    });
    expect(settings.labels).toEqual({
      department: '사역팀',
      position: '직분',
      budget: '예산(회계연도)',
    });
  });

  it('COMPANY: §3.3 표와 일치 — vat/taxInvoice true, incomeModule/offeringLink false', () => {
    const settings = defaultSettingsForOrgType('COMPANY');

    expect(settings.features).toEqual({
      incomeModule: false,
      budgetModule: true,
      vat: true,
      taxInvoice: true,
      offeringLink: false,
    });
    expect(settings.labels).toEqual({
      department: '팀',
      position: '직급',
      budget: '예산(회계연도)',
    });
  });

  it('그 외 유형(NONPROFIT): 보수적으로 부가세·세금계산서 비활성', () => {
    const settings = defaultSettingsForOrgType('NONPROFIT');

    expect(settings.features).toEqual({
      incomeModule: false,
      budgetModule: true,
      vat: false,
      taxInvoice: false,
      offeringLink: false,
    });
    expect(settings.labels.department).toBe('부서');
  });

  it('기본값은 표준 스키마(tenantSettingsSchema)를 통과한다', () => {
    for (const orgType of ['CHURCH', 'NONPROFIT', 'SCHOOL', 'COMPANY', 'OTHER']) {
      expect(() => tenantSettingsSchema.parse(defaultSettingsForOrgType(orgType))).not.toThrow();
    }
  });
});

describe('resolveTenantSettings', () => {
  it('저장값이 없으면 orgType 기본값을 그대로 반환한다', () => {
    const resolved = resolveTenantSettings({ orgType: 'CHURCH', settings: null });
    expect(resolved).toEqual(defaultSettingsForOrgType('CHURCH'));
  });

  it('저장된 features가 기본값을 부분 override한다 (딥머지)', () => {
    const resolved = resolveTenantSettings({
      orgType: 'CHURCH',
      settings: { features: { incomeModule: false } },
    });

    expect(resolved.features.incomeModule).toBe(false); // 저장값 우선
    expect(resolved.features.offeringLink).toBe(true); // 나머지는 기본값 유지
    expect(resolved.features.budgetModule).toBe(true);
    expect(resolved.labels).toEqual(defaultSettingsForOrgType('CHURCH').labels);
  });

  it('저장된 labels가 기본값을 부분 override한다 (딥머지)', () => {
    const resolved = resolveTenantSettings({
      orgType: 'COMPANY',
      settings: { labels: { department: '파트' } },
    });

    expect(resolved.labels.department).toBe('파트'); // 저장값 우선
    expect(resolved.labels.position).toBe('직급'); // 나머지는 기본값 유지
    expect(resolved.labels.budget).toBe('예산(회계연도)');
  });

  it('approvalLines 등 표준 외 키가 있어도 labels/features 해석에 영향이 없다', () => {
    const resolved = resolveTenantSettings({
      orgType: 'CHURCH',
      settings: {
        approvalLines: [{ name: '일반 지출 결재선', steps: [] }],
        features: { vat: true },
      },
    });

    expect(resolved.features.vat).toBe(true);
    expect(resolved.features.incomeModule).toBe(true);
  });

  it('저장값 구조가 유효하지 않으면 기본값으로 폴백한다 (fail-safe)', () => {
    const invalidCases: unknown[] = [
      'not-an-object',
      { features: { vat: 'yes' } }, // boolean 아님
      { labels: { department: 123 } }, // string 아님
    ];

    for (const settings of invalidCases) {
      const resolved = resolveTenantSettings({ orgType: 'COMPANY', settings });
      expect(resolved).toEqual(defaultSettingsForOrgType('COMPANY'));
    }
  });
});

describe('getOrgTerms — settings.labels 통합', () => {
  it('overrides 없이 호출하면 기존 하드코딩 사전을 그대로 반환한다 (회귀 없음)', () => {
    expect(getOrgTerms('CHURCH').department).toBe('사역팀');
    expect(getOrgTerms('COMPANY').department).toBe('팀');
    expect(getOrgTerms(undefined).department).toBe('사역팀'); // 미확정 시 교회 기본
  });

  it('settings.labels의 department가 하드코딩 사전보다 우선한다', () => {
    const labels = resolveTenantSettings({
      orgType: 'COMPANY',
      settings: { labels: { department: '파트' } },
    }).labels;

    const terms = getOrgTerms('COMPANY', labels);
    expect(terms.department).toBe('파트');
    // 파생 표기도 재정의된 department를 따라간다
    expect(terms.departmentFull).toBe('파트');
    expect(terms.departmentSlash).toBe('파트');
    // 재정의되지 않은 용어는 기본 사전 유지
    expect(terms.committee).toBe('본부');
  });

  it('명시적으로 재정의한 파생 표기는 department 파생값보다 우선한다', () => {
    const terms = getOrgTerms('CHURCH', {
      department: '구역',
      departmentSlash: '구역/팀',
    });

    expect(terms.department).toBe('구역');
    expect(terms.departmentFull).toBe('구역');
    expect(terms.departmentSlash).toBe('구역/팀');
  });

  it('undefined 값 키는 무시된다 (기본 용어 유지)', () => {
    const terms = getOrgTerms('CHURCH', { department: undefined });
    expect(terms.department).toBe('사역팀');
  });
});
