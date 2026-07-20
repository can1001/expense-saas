/**
 * @jest-environment node
 */

/**
 * global-menu 테스트 (Phase 5 R5)
 *
 * "영수증 관리"(/receipts) 메뉴 노출은 RECEIPT_READ permission 파생
 * (canAccessAdminMenuPathWithRoles) 결과만 사용한다 — 역할 하드코딩 여부를 대조한다.
 */

import { describe, it, expect } from 'vitest';
import { getGlobalSidebarMenu } from '../global-menu';

function findItem(config: ReturnType<typeof getGlobalSidebarMenu>, href: string) {
  return config.groups.flatMap((group) => group.items).find((item) => item.href === href);
}

describe('getGlobalSidebarMenu', () => {
  it.each(['accountant', 'finance_head', 'admin'])(
    '%s 역할은 영수증 관리(/receipts) 메뉴가 노출된다',
    (role) => {
      const config = getGlobalSidebarMenu({ roles: [role] });
      expect(findItem(config, '/receipts')).toBeDefined();
    }
  );

  it.each(['user', 'team_leader'])('%s 역할은 영수증 관리(/receipts) 메뉴가 노출되지 않는다', (role) => {
    const config = getGlobalSidebarMenu({ roles: [role] });
    expect(findItem(config, '/receipts')).toBeUndefined();
  });

  it('영수증 관리 메뉴는 정기 지출과 보고서 사이에 위치한다', () => {
    const config = getGlobalSidebarMenu({ roles: ['admin'] });
    const hrefs = config.groups.flatMap((group) => group.items).map((item) => item.href);
    const recurringIdx = hrefs.indexOf('/recurring-expenses');
    const receiptsIdx = hrefs.indexOf('/receipts');
    const reportsIdx = hrefs.indexOf('/reports/financial');

    expect(recurringIdx).toBeGreaterThanOrEqual(0);
    expect(receiptsIdx).toBeGreaterThan(recurringIdx);
    expect(reportsIdx).toBeGreaterThan(receiptsIdx);
  });
});
