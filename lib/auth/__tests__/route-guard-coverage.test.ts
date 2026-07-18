/**
 * @jest-environment node
 *
 * AC5: 가드 없는 API 라우트가 0이어야 한다.
 * 모든 app/api/**\/route.ts 는 인증 가드를 쓰거나, 명시적 공개 허용목록에 있어야 한다.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const API_ROOT = join(process.cwd(), 'app', 'api');

/**
 * 인증이 필요 없는 공개 라우트 (의도적). 신규 공개 라우트는 여기에 명시적으로 추가.
 * 각 항목은 왜 공개인지 이유를 남긴다.
 */
const PUBLIC_ALLOWLIST: Record<string, string> = {
  'auth/kakao/route.ts': '카카오 로그인 (서버측 kapi 토큰 검증 자체 보호)',
  'auth/login/route.ts': '로그인 (rate-limit 자체 보호)',
  'auth/logout/route.ts': '로그아웃 (쿠키 만료)',
  'auth/signup/route.ts': '회원가입',
  'platform/auth/login/route.ts': '플랫폼 슈퍼관리자 로그인',
  'platform/auth/logout/route.ts': '플랫폼 슈퍼관리자 로그아웃',
  'push/vapid-public-key/route.ts': '공개 VAPID 키 제공 (공개 정보)',
  'tenant/info/route.ts': '로그인 페이지용 테넌트 브랜딩 정보 (공개)',
};

/** 가드로 인정되는 토큰들 */
const GUARD_MARKERS = [
  'withAuth',
  'withPermission',
  'withPermissions',
  'withAdmin',
  'withAdminMenu',
  'withSuperAdmin',
  'getUserFromRequest',
  'verifyUserToken', // 토큰 자체 검증 라우트 (예: switch-tenant — 정식/선택용 임시 토큰 겸용)
  'getSuperAdminFromRequest',
  'getCurrentUser',
  'CRON_SECRET', // 크론 라우트는 시크릿 기반 자체 인증
];

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...findRouteFiles(full));
    } else if (entry === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

describe('AC5: API 라우트 가드 커버리지', () => {
  const routeFiles = findRouteFiles(API_ROOT);

  it('app/api 하위에 route.ts 가 다수 존재한다 (스캐너 동작 확인)', () => {
    expect(routeFiles.length).toBeGreaterThan(50);
  });

  it('가드 없는 라우트는 공개 허용목록에 명시된 것뿐이다', () => {
    const unguarded: string[] = [];
    for (const file of routeFiles) {
      const rel = relative(API_ROOT, file).split('\\').join('/');
      const content = readFileSync(file, 'utf8');
      const hasGuard = GUARD_MARKERS.some((m) => content.includes(m));
      if (!hasGuard && !(rel in PUBLIC_ALLOWLIST)) {
        unguarded.push(rel);
      }
    }
    expect(unguarded, `가드 없는 비공개 라우트:\n${unguarded.join('\n')}`).toEqual([]);
  });

  it('공개 허용목록의 모든 항목이 실제로 존재한다 (죽은 항목 방지)', () => {
    const existing = new Set(
      routeFiles.map((f) => relative(API_ROOT, f).split('\\').join('/'))
    );
    const stale = Object.keys(PUBLIC_ALLOWLIST).filter((p) => !existing.has(p));
    expect(stale, `허용목록의 존재하지 않는 항목:\n${stale.join('\n')}`).toEqual([]);
  });
});
