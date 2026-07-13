/**
 * @jest-environment node
 *
 * AC2: 인가는 hasPermission 단일 경로로만.
 *   app/ 및 components/ 소스에 인가용 하드코딩 역할 배열(지역 역할 리터럴)이 남아있지 않아야 한다.
 *   (데이터 조회 편의용 role === 'xxx' 단건 비교는 예외; 여기서는 역할 배열 리터럴을 금지)
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SCAN_DIRS = [join(ROOT, 'app'), join(ROOT, 'components')];

// 단일 출처 파일(권한 레지스트리/메뉴 파생)은 예외 — 여기서만 역할 코드를 열거한다.
const ALLOWLIST_SUFFIXES = [
  'lib/auth/permissions.ts',
  'lib/constants/menu-permissions.ts',
];

/** 2개 이상 연속된 역할 문자열 배열 리터럴 (예: ['admin', 'finance_head', ...]) */
const ROLE_ARRAY_LITERAL =
  /\[\s*'(admin|finance_head|accountant|finance_member|team_leader|admin_assistant|user)'\s*,\s*'(admin|finance_head|accountant|finance_member|team_leader|admin_assistant|user)'/;

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('AC2: 인가 단일 출처 (하드코딩 역할 배열 금지)', () => {
  const files = SCAN_DIRS.flatMap(collectSourceFiles);

  it('스캔 대상 소스가 다수 존재한다', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('app/ · components/ 에 인가용 역할 배열 리터럴이 없다', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.slice(ROOT.length + 1);
      if (ALLOWLIST_SUFFIXES.some((s) => rel.endsWith(s))) continue;
      const content = readFileSync(file, 'utf8');
      if (ROLE_ARRAY_LITERAL.test(content)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `인가용 역할 배열이 남아있는 파일(permission 으로 교체 필요):\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('권한 레지스트리(permissions.ts)가 인가 단일 진입점 함수를 제공한다', async () => {
    const mod = await import('../permissions');
    expect(typeof mod.hasPermission).toBe('function');
    expect(typeof mod.roleHasPermission).toBe('function');
    expect(typeof mod.resolvePermissions).toBe('function');
  });
});
