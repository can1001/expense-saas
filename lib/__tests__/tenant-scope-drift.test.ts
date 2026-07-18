/**
 * 테넌트 스코프 드리프트 가드 (ARC-001/002)
 *
 * prisma/schema.prisma에서 `tenantId` 필드를 가진 모든 모델을 동적으로 추출해,
 * 각 모델이 TENANT_SCOPED_MODELS(자동 tenantId 필터 강제)에 있거나
 * 명시적 CROSS_TENANT_ALLOWLIST(테넌트를 가로지르는 정당한 조회)에 있는지 검증한다.
 *
 * 목적: tenantId를 가진 신규 모델이 스코프 목록에서 누락되면(= 크로스테넌트 누출 위험)
 * CI가 자동으로 잡는다. (AccountCategory가 조용히 빠졌던 사례 재발 방지 — /ship 보안감사)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { isTenantScopedModel } from '../prisma-tenant-extension';

/**
 * 의도적으로 테넌트 스코프에서 제외된 모델 (테넌트 경계를 가로지르는 정당한 접근).
 * 새 항목 추가는 반드시 리뷰에서 근거를 남길 것.
 */
const CROSS_TENANT_ALLOWLIST = new Set([
  'membership', // 유저의 여러 테넌트 소속을 가로질러 조회 (로그인/조직전환)
  'invitation', // 로그인·테넌트 컨텍스트 확정 전 토큰으로 조회
  'platformactivitylog', // 슈퍼어드민(플랫폼) 스코프 — 테넌트 격리 대상 아님
]);

/** schema.prisma에서 tenantId 필드를 가진 모델명(PascalCase) 목록 추출 */
function modelsWithTenantId(): string[] {
  const schema = readFileSync(
    join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf-8'
  );
  const models: string[] = [];
  let current: string | null = null;

  for (const raw of schema.split('\n')) {
    const line = raw.trim();
    const modelMatch = /^model\s+(\w+)\s*\{/.exec(line);
    if (modelMatch) {
      current = modelMatch[1];
      continue;
    }
    if (line === '}') {
      current = null;
      continue;
    }
    // `tenantId String` 또는 `tenantId String?` 필드 선언
    if (current && /^tenantId\s+String/.test(line)) {
      models.push(current);
    }
  }
  return models;
}

describe('테넌트 스코프 드리프트 가드', () => {
  it('tenantId를 가진 모든 모델은 스코프 대상이거나 명시적 크로스테넌트 허용 목록에 있어야 한다', () => {
    const models = modelsWithTenantId();
    // 파서 sanity — 스키마에서 최소한의 모델은 잡혀야 한다
    expect(models.length).toBeGreaterThan(10);

    const violations = models.filter(
      (m) =>
        !isTenantScopedModel(m) && !CROSS_TENANT_ALLOWLIST.has(m.toLowerCase())
    );

    expect(
      violations,
      `tenantId를 가졌지만 TENANT_SCOPED_MODELS에도 CROSS_TENANT_ALLOWLIST에도 없는 모델: ${violations.join(', ')}. ` +
        `테넌트별 데이터면 TENANT_SCOPED_MODELS에 추가하고, 의도적 크로스테넌트면 허용 목록에 근거와 함께 추가하세요.`
    ).toEqual([]);
  });

  it('크로스테넌트 허용 목록은 실제로 스코프 목록에 없어야 한다 (이중 정의 방지)', () => {
    for (const allowed of CROSS_TENANT_ALLOWLIST) {
      expect(
        isTenantScopedModel(allowed),
        `${allowed}는 크로스테넌트 허용 목록과 TENANT_SCOPED_MODELS에 동시에 있으면 안 된다`
      ).toBe(false);
    }
  });
});
