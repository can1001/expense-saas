import { describe, it, expect } from 'vitest';
import { ADMIN_SIDEBAR_MENU, getAdminSidebarMenu } from '../admin-menu';
import type { TenantFeatures } from '@/lib/tenant/settings';

describe('admin-menu', () => {
  describe('ADMIN_SIDEBAR_MENU structure', () => {
    it('should have correct number of groups', () => {
      expect(ADMIN_SIDEBAR_MENU).toHaveLength(9);
    });

    it('should have dashboard group', () => {
      const dashboardGroup = ADMIN_SIDEBAR_MENU[0];
      expect(dashboardGroup.title).toBe('대시보드');
      expect(dashboardGroup.items).toHaveLength(1);
      expect(dashboardGroup.items[0].href).toBe('/admin');
      expect(dashboardGroup.items[0].label).toBe('홈');
    });

    it('should have organization management group', () => {
      const orgGroup = ADMIN_SIDEBAR_MENU[1];
      expect(orgGroup.title).toBe('조직 관리');
      expect(orgGroup.items).toHaveLength(2);
    });

    it('should have user/role management group', () => {
      const userRoleGroup = ADMIN_SIDEBAR_MENU[2];
      expect(userRoleGroup.title).toBe('사용자/역할');
      expect(userRoleGroup.items).toHaveLength(6);
    });

    it('should have budget planning group', () => {
      const budgetGroup = ADMIN_SIDEBAR_MENU[3];
      expect(budgetGroup.title).toBe('예산 편성');
      expect(budgetGroup.items).toHaveLength(6);
    });

    it('should have settlement/performance group', () => {
      const settlementGroup = ADMIN_SIDEBAR_MENU[4];
      expect(settlementGroup.title).toBe('결산/실적');
      expect(settlementGroup.items).toHaveLength(6);
    });

    it('should have approval management group', () => {
      const approvalGroup = ADMIN_SIDEBAR_MENU[5];
      expect(approvalGroup.title).toBe('결재 관리');
      expect(approvalGroup.items).toHaveLength(2);
    });

    it('should have expense management group', () => {
      const expenseGroup = ADMIN_SIDEBAR_MENU[6];
      expect(expenseGroup.title).toBe('지출 관리');
      expect(expenseGroup.items).toHaveLength(1);
      expect(expenseGroup.items[0].href).toBe('/admin/expense-upload');
      expect(expenseGroup.items[0].label).toBe('지출결의서 일괄 업로드');
    });

    it('should have income management group', () => {
      const incomeGroup = ADMIN_SIDEBAR_MENU[7];
      expect(incomeGroup.title).toBe('수입 관리');
      expect(incomeGroup.items).toHaveLength(1);
    });

    it('should have system group', () => {
      const systemGroup = ADMIN_SIDEBAR_MENU[8];
      expect(systemGroup.title).toBe('시스템');
      expect(systemGroup.items).toHaveLength(2);
    });
  });

  describe('Menu items validation', () => {
    it('should have valid href paths for all items', () => {
      ADMIN_SIDEBAR_MENU.forEach((group) => {
        group.items.forEach((item) => {
          // 관리 사이드바 항목은 /admin 하위이거나, 제직용 재정보고서(/reports/financial)
          expect(item.href).toMatch(/^\/(admin|reports)/);
          expect(item.href).toBeTruthy();
        });
      });
    });

    it('should have labels for all items', () => {
      ADMIN_SIDEBAR_MENU.forEach((group) => {
        group.items.forEach((item) => {
          expect(item.label).toBeTruthy();
          expect(typeof item.label).toBe('string');
        });
      });
    });

    it('should have icons for all items', () => {
      ADMIN_SIDEBAR_MENU.forEach((group) => {
        group.items.forEach((item) => {
          expect(item.icon).toBeTruthy();
          // Icons are objects (React components) in the test environment
          expect(item.icon).toBeDefined();
        });
      });
    });
  });

  describe('Specific menu items', () => {
    it('should include budget wizard', () => {
      const budgetPlanningGroup = ADMIN_SIDEBAR_MENU[3];
      const wizardItem = budgetPlanningGroup.items.find(
        (item) => item.href === '/admin/budget-wizard'
      );
      expect(wizardItem).toBeDefined();
      expect(wizardItem?.label).toBe('설정 마법사');
    });

    it('should include user management', () => {
      const userRoleGroup = ADMIN_SIDEBAR_MENU[2];
      const userItem = userRoleGroup.items.find(
        (item) => item.href === '/admin/users'
      );
      expect(userItem).toBeDefined();
      expect(userItem?.label).toBe('사용자 관리');
    });

    it('should include budget upload', () => {
      const budgetPlanningGroup = ADMIN_SIDEBAR_MENU[3];
      const uploadItem = budgetPlanningGroup.items.find(
        (item) => item.href === '/admin/budget-upload'
      );
      expect(uploadItem).toBeDefined();
      expect(uploadItem?.label).toBe('예산 마스터 업로드');
    });

    it('should include notification sending', () => {
      const systemGroup = ADMIN_SIDEBAR_MENU[8];
      const notifItem = systemGroup.items.find(
        (item) => item.href === '/admin/notifications'
      );
      expect(notifItem).toBeDefined();
      expect(notifItem?.label).toBe('알림 발송');
    });
  });

  describe('Group titles', () => {
    it('should have Korean titles', () => {
      const titles = ADMIN_SIDEBAR_MENU.map((group) => group.title);
      expect(titles).toEqual([
        '대시보드',
        '조직 관리',
        '사용자/역할',
        '예산 편성',
        '결산/실적',
        '결재 관리',
        '지출 관리',
        '수입 관리',
        '시스템',
      ]);
    });

    it('should have unique group titles', () => {
      const titles = ADMIN_SIDEBAR_MENU.map((group) => group.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    });
  });

  describe('URL uniqueness', () => {
    it('should have unique URLs across all items', () => {
      const allHrefs: string[] = [];
      ADMIN_SIDEBAR_MENU.forEach((group) => {
        group.items.forEach((item) => {
          allHrefs.push(item.href);
        });
      });
      const uniqueHrefs = new Set(allHrefs);
      expect(uniqueHrefs.size).toBe(allHrefs.length);
    });
  });

  // 서버 주도 features 기반 수입 메뉴 노출 제어 (ARC-002 §4.2, B5)
  describe('getAdminSidebarMenu features 분기', () => {
    const hasIncomeGroup = (menu: ReturnType<typeof getAdminSidebarMenu>) =>
      menu.some((group) => group.title === '수입 관리');

    const makeFeatures = (incomeModule: boolean): TenantFeatures => ({
      incomeModule,
      budgetModule: true,
      vat: false,
      taxInvoice: false,
      offeringLink: false,
    });

    it('features 미지정 시 기존 orgType 분기 유지 (회귀 없음)', () => {
      expect(hasIncomeGroup(getAdminSidebarMenu('CHURCH'))).toBe(true);
      expect(hasIncomeGroup(getAdminSidebarMenu('COMPANY'))).toBe(false);
      // orgType 미확정(로딩 중)도 기존 동작(노출) 유지
      expect(hasIncomeGroup(getAdminSidebarMenu(null))).toBe(true);
    });

    it('incomeModule=false면 CHURCH여도 수입 관리 미노출', () => {
      expect(
        hasIncomeGroup(getAdminSidebarMenu('CHURCH', makeFeatures(false)))
      ).toBe(false);
    });

    it('incomeModule=true면 COMPANY여도 수입 관리 노출', () => {
      expect(
        hasIncomeGroup(getAdminSidebarMenu('COMPANY', makeFeatures(true)))
      ).toBe(true);
    });
  });
});
