/**
 * 기본 계정과목 데이터 검증 테스트
 */

import { describe, it, expect } from 'vitest';
import { OrgType } from '@prisma/client';
import {
  getDefaultDataForOrgType,
  orgTypeDefaults,
  OrgTypeDefaultData,
} from '../default-chart-of-accounts';

describe('default-chart-of-accounts', () => {
  const allOrgTypes: OrgType[] = [
    OrgType.CHURCH,
    OrgType.NONPROFIT,
    OrgType.SCHOOL,
    OrgType.COMPANY,
    OrgType.OTHER,
  ];

  describe('getDefaultDataForOrgType', () => {
    it.each(allOrgTypes)('%s: 유효한 데이터를 반환해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      expect(data).toBeDefined();
      expect(data.committees).toBeInstanceOf(Array);
      expect(data.budgetCategories).toBeInstanceOf(Array);
    });

    it.each(allOrgTypes)('%s: 최소 1개 이상의 위원회를 포함해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);
      expect(data.committees.length).toBeGreaterThan(0);
    });

    it.each(allOrgTypes)('%s: 최소 1개 이상의 예산 항목을 포함해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);
      expect(data.budgetCategories.length).toBeGreaterThan(0);
    });
  });

  describe('orgTypeDefaults 매핑', () => {
    it('모든 OrgType enum 값에 대한 기본 데이터가 존재해야 함', () => {
      for (const orgType of allOrgTypes) {
        expect(orgTypeDefaults[orgType]).toBeDefined();
      }
    });
  });

  describe('위원회 데이터 구조', () => {
    it.each(allOrgTypes)('%s: 모든 위원회가 name과 sortOrder를 가져야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      data.committees.forEach((committee, index) => {
        expect(committee.name).toBeDefined();
        expect(typeof committee.name).toBe('string');
        expect(committee.name.length).toBeGreaterThan(0);
        expect(committee.sortOrder).toBeDefined();
        expect(typeof committee.sortOrder).toBe('number');
      });
    });

    it.each(allOrgTypes)('%s: 모든 위원회가 최소 1개의 부서를 포함해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      data.committees.forEach((committee) => {
        expect(committee.departments).toBeInstanceOf(Array);
        expect(committee.departments.length).toBeGreaterThan(0);
      });
    });

    it.each(allOrgTypes)('%s: 모든 부서가 name과 sortOrder를 가져야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      data.committees.forEach((committee) => {
        committee.departments.forEach((dept) => {
          expect(dept.name).toBeDefined();
          expect(typeof dept.name).toBe('string');
          expect(dept.name.length).toBeGreaterThan(0);
          expect(dept.sortOrder).toBeDefined();
          expect(typeof dept.sortOrder).toBe('number');
        });
      });
    });

    it.each(allOrgTypes)('%s: 위원회 sortOrder가 고유해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);
      const sortOrders = data.committees.map((c) => c.sortOrder);
      const uniqueSortOrders = new Set(sortOrders);
      expect(uniqueSortOrders.size).toBe(sortOrders.length);
    });
  });

  describe('예산 항목 데이터 구조', () => {
    it.each(allOrgTypes)('%s: 모든 예산 항목(항)이 name과 sortOrder를 가져야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      data.budgetCategories.forEach((category) => {
        expect(category.name).toBeDefined();
        expect(typeof category.name).toBe('string');
        expect(category.name.length).toBeGreaterThan(0);
        expect(category.sortOrder).toBeDefined();
        expect(typeof category.sortOrder).toBe('number');
      });
    });

    it.each(allOrgTypes)('%s: 모든 예산 항목(항)이 최소 1개의 목을 포함해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      data.budgetCategories.forEach((category) => {
        expect(category.subcategories).toBeInstanceOf(Array);
        expect(category.subcategories.length).toBeGreaterThan(0);
      });
    });

    it.each(allOrgTypes)('%s: 모든 예산 목이 최소 1개의 세목을 포함해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      data.budgetCategories.forEach((category) => {
        category.subcategories.forEach((subcategory) => {
          expect(subcategory.details).toBeInstanceOf(Array);
          expect(subcategory.details.length).toBeGreaterThan(0);
        });
      });
    });

    it.each(allOrgTypes)('%s: 예산 항목(항) sortOrder가 고유해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);
      const sortOrders = data.budgetCategories.map((c) => c.sortOrder);
      const uniqueSortOrders = new Set(sortOrders);
      expect(uniqueSortOrders.size).toBe(sortOrders.length);
    });

    it.each(allOrgTypes)('%s: 각 항 내 목의 sortOrder가 고유해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      data.budgetCategories.forEach((category) => {
        const sortOrders = category.subcategories.map((s) => s.sortOrder);
        const uniqueSortOrders = new Set(sortOrders);
        expect(uniqueSortOrders.size).toBe(sortOrders.length);
      });
    });

    it.each(allOrgTypes)('%s: 각 목 내 세목의 sortOrder가 고유해야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      data.budgetCategories.forEach((category) => {
        category.subcategories.forEach((subcategory) => {
          const sortOrders = subcategory.details.map((d) => d.sortOrder);
          const uniqueSortOrders = new Set(sortOrders);
          expect(uniqueSortOrders.size).toBe(sortOrders.length);
        });
      });
    });
  });

  describe('데이터 제한', () => {
    it.each(allOrgTypes)('%s: 이름이 100자를 초과하지 않아야 함', (orgType) => {
      const data = getDefaultDataForOrgType(orgType);

      // 위원회/부서 이름 확인
      data.committees.forEach((committee) => {
        expect(committee.name.length).toBeLessThanOrEqual(100);
        committee.departments.forEach((dept) => {
          expect(dept.name.length).toBeLessThanOrEqual(100);
        });
      });

      // 예산 항목 이름 확인
      data.budgetCategories.forEach((category) => {
        expect(category.name.length).toBeLessThanOrEqual(100);
        category.subcategories.forEach((subcategory) => {
          expect(subcategory.name.length).toBeLessThanOrEqual(100);
          subcategory.details.forEach((detail) => {
            expect(detail.name.length).toBeLessThanOrEqual(100);
          });
        });
      });
    });
  });

  describe('특정 조직 유형 데이터', () => {
    it('CHURCH: 당회, 교육위원회 등 교회 관련 위원회가 있어야 함', () => {
      const data = getDefaultDataForOrgType(OrgType.CHURCH);
      const committeeNames = data.committees.map((c) => c.name);

      expect(committeeNames).toContain('당회');
      expect(committeeNames).toContain('교육위원회');
    });

    it('COMPANY: 경영, 영업 등 기업 관련 부서가 있어야 함', () => {
      const data = getDefaultDataForOrgType(OrgType.COMPANY);
      const allDepartmentNames = data.committees.flatMap((c) =>
        c.departments.map((d) => d.name)
      );

      expect(allDepartmentNames.some((name) => name.includes('경영') || name.includes('재무'))).toBe(true);
    });

    it('SCHOOL: 교무, 학생 관련 부서가 있어야 함', () => {
      const data = getDefaultDataForOrgType(OrgType.SCHOOL);
      const allDepartmentNames = data.committees.flatMap((c) =>
        c.departments.map((d) => d.name)
      );

      expect(allDepartmentNames.some((name) => name.includes('교무') || name.includes('학생'))).toBe(true);
    });
  });
});
