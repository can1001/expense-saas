/**
 * FCM 토픽 명명 유틸 테스트 (ARC-002 §6, B6)
 *
 * 테스트 대상:
 * - 토픽 문자열이 `tenant_{tenantId}_{channel}` 스코프로 생성됨
 * - FCM 허용 문자 밖의 입력은 한국어 에러로 거부
 * - 테넌트 소속 토픽 판별
 */

import { describe, it, expect } from 'vitest';
import {
  buildTenantTopic,
  tenantTopics,
  isTopicOfTenant,
  TENANT_TOPIC_CHANNELS,
} from '../fcm-topic';

describe('buildTenantTopic', () => {
  it('tenant_{tenantId}_{channel} 형태로 생성한다', () => {
    expect(buildTenantTopic('cltenant123', 'all')).toBe(
      'tenant_cltenant123_all'
    );
  });

  it('허용 문자(-_.~%)를 포함한 세그먼트를 지원한다', () => {
    expect(buildTenantTopic('org-1.test~a', 'approval_line')).toBe(
      'tenant_org-1.test~a_approval_line'
    );
  });

  it('허용되지 않는 문자가 tenantId에 있으면 한국어 에러', () => {
    expect(() => buildTenantTopic('tenant 1', 'all')).toThrow(
      'FCM 토픽에 사용할 수 없는 테넌트 ID입니다.'
    );
    expect(() => buildTenantTopic('', 'all')).toThrow(
      'FCM 토픽에 사용할 수 없는 테넌트 ID입니다.'
    );
  });

  it('허용되지 않는 문자가 channel에 있으면 한국어 에러', () => {
    expect(() => buildTenantTopic('tenant-1', '전체')).toThrow(
      'FCM 토픽에 사용할 수 없는 채널명입니다.'
    );
  });
});

describe('tenantTopics', () => {
  it('표준 채널 전체에 대해 테넌트 스코프 토픽을 반환한다', () => {
    const topics = tenantTopics('tenant-1');
    expect(topics).toHaveLength(TENANT_TOPIC_CHANNELS.length);
    expect(topics).toContain('tenant_tenant-1_all');
    // 모든 토픽이 테넌트 스코프 접두사를 가진다
    for (const topic of topics) {
      expect(topic.startsWith('tenant_tenant-1_')).toBe(true);
    }
  });
});

describe('isTopicOfTenant', () => {
  it('해당 테넌트 스코프 토픽이면 true', () => {
    expect(isTopicOfTenant('tenant_tenant-1_all', 'tenant-1')).toBe(true);
  });

  it('다른 테넌트 토픽이면 false — 스코프 누수 방지', () => {
    expect(isTopicOfTenant('tenant_tenant-2_all', 'tenant-1')).toBe(false);
    // 접두사가 부분 일치하는 경우도 구분자(_)로 거른다
    expect(isTopicOfTenant('tenant_tenant-12_all', 'tenant-1')).toBe(false);
  });

  it('테넌트 스코프가 아닌 토픽이면 false', () => {
    expect(isTopicOfTenant('global_announcements', 'tenant-1')).toBe(false);
  });
});
