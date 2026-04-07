import { describe, it, expect } from 'vitest';
import { ADMIN_SIDEBAR_MENU } from '../admin-menu';

describe('admin-menu', () => {
  describe('ADMIN_SIDEBAR_MENU structure', () => {
    it('should have correct number of groups', () => {
      expect(ADMIN_SIDEBAR_MENU).toHaveLength(8);
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
      expect(budgetGroup.items).toHaveLength(5);
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

    it('should have income management group', () => {
      const incomeGroup = ADMIN_SIDEBAR_MENU[6];
      expect(incomeGroup.title).toBe('수입 관리');
      expect(incomeGroup.items).toHaveLength(1);
    });

    it('should have system group', () => {
      const systemGroup = ADMIN_SIDEBAR_MENU[7];
      expect(systemGroup.title).toBe('시스템');
      expect(systemGroup.items).toHaveLength(2);
    });
  });

  describe('Menu items validation', () => {
    it('should have valid href paths for all items', () => {
      ADMIN_SIDEBAR_MENU.forEach((group) => {
        group.items.forEach((item) => {
          expect(item.href).toMatch(/^\/admin/);
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
      const systemGroup = ADMIN_SIDEBAR_MENU[7];
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
});
