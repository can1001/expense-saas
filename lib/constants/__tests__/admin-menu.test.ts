import { describe, it, expect } from 'vitest';
import { ADMIN_SIDEBAR_MENU } from '../admin-menu';

describe('admin-menu', () => {
  describe('ADMIN_SIDEBAR_MENU structure', () => {
    it('should have correct number of groups', () => {
      expect(ADMIN_SIDEBAR_MENU).toHaveLength(6);
    });

    it('should have dashboard group', () => {
      const dashboardGroup = ADMIN_SIDEBAR_MENU[0];
      expect(dashboardGroup.title).toBe('대시보드');
      expect(dashboardGroup.items).toHaveLength(1);
      expect(dashboardGroup.items[0].href).toBe('/admin');
      expect(dashboardGroup.items[0].label).toBe('홈');
    });

    it('should have year setup group', () => {
      const yearSetupGroup = ADMIN_SIDEBAR_MENU[1];
      expect(yearSetupGroup.title).toBe('연도 설정');
      expect(yearSetupGroup.items).toHaveLength(4);
    });

    it('should have personnel management group', () => {
      const personnelGroup = ADMIN_SIDEBAR_MENU[2];
      expect(personnelGroup.title).toBe('인원 관리');
      expect(personnelGroup.items).toHaveLength(4);
    });

    it('should have budget management group', () => {
      const budgetGroup = ADMIN_SIDEBAR_MENU[3];
      expect(budgetGroup.title).toBe('예산 관리');
      expect(budgetGroup.items).toHaveLength(3);
    });

    it('should have status/report group', () => {
      const statusGroup = ADMIN_SIDEBAR_MENU[4];
      expect(statusGroup.title).toBe('현황/리포트');
      expect(statusGroup.items).toHaveLength(5);
    });

    it('should have notification group', () => {
      const notificationGroup = ADMIN_SIDEBAR_MENU[5];
      expect(notificationGroup.title).toBe('알림');
      expect(notificationGroup.items).toHaveLength(1);
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
      const yearSetupGroup = ADMIN_SIDEBAR_MENU[1];
      const wizardItem = yearSetupGroup.items.find(
        (item) => item.href === '/admin/budget-wizard'
      );
      expect(wizardItem).toBeDefined();
      expect(wizardItem?.label).toBe('설정 마법사');
    });

    it('should include user management', () => {
      const personnelGroup = ADMIN_SIDEBAR_MENU[2];
      const userItem = personnelGroup.items.find(
        (item) => item.href === '/admin/users'
      );
      expect(userItem).toBeDefined();
      expect(userItem?.label).toBe('사용자 관리');
    });

    it('should include budget upload', () => {
      const yearSetupGroup = ADMIN_SIDEBAR_MENU[1];
      const uploadItem = yearSetupGroup.items.find(
        (item) => item.href === '/admin/budget-upload'
      );
      expect(uploadItem).toBeDefined();
      expect(uploadItem?.label).toBe('예산 마스터 업로드');
    });

    it('should include notification sending', () => {
      const notificationGroup = ADMIN_SIDEBAR_MENU[5];
      const notifItem = notificationGroup.items.find(
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
        '연도 설정',
        '인원 관리',
        '예산 관리',
        '현황/리포트',
        '알림',
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
