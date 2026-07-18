/**
 * FCM 토픽 명명 단일 유틸 (ARC-002 §6, B6)
 *
 * 모든 FCM 토픽 문자열은 반드시 이 모듈을 통해 생성한다.
 * 토픽은 `tenant_{tenantId}_{channel}` 형태로 테넌트 스코프를 강제하여
 * 결재 알림이 타 조직 구독자에게 새는 것을 방지한다.
 *
 * 조직 전환(switch-tenant) 시에는 이전 테넌트 토픽 구독 해제 → 새 테넌트
 * 토픽 구독 순으로 재구독한다 (FcmProvider.resubscribeTenantTopics).
 */

// FCM 토픽 허용 문자 집합: [a-zA-Z0-9-_.~%]+
// https://firebase.google.com/docs/cloud-messaging/android/topic-messaging
const TOPIC_SEGMENT_PATTERN = /^[A-Za-z0-9\-_.~%]+$/;

export const TENANT_TOPIC_PREFIX = 'tenant_';

// 테넌트별 표준 채널 목록 — 채널 추가 시 이 배열만 확장한다.
// 'all': 테넌트 전체 공지 채널
export const TENANT_TOPIC_CHANNELS = ['all'] as const;
export type TenantTopicChannel = (typeof TENANT_TOPIC_CHANNELS)[number];

/**
 * 테넌트 스코프 토픽 문자열 생성: `tenant_{tenantId}_{channel}`
 */
export function buildTenantTopic(tenantId: string, channel: string): string {
  if (!TOPIC_SEGMENT_PATTERN.test(tenantId)) {
    throw new Error('FCM 토픽에 사용할 수 없는 테넌트 ID입니다.');
  }
  if (!TOPIC_SEGMENT_PATTERN.test(channel)) {
    throw new Error('FCM 토픽에 사용할 수 없는 채널명입니다.');
  }
  return `${TENANT_TOPIC_PREFIX}${tenantId}_${channel}`;
}

/**
 * 특정 테넌트가 구독해야 하는 표준 토픽 전체 목록
 */
export function tenantTopics(tenantId: string): string[] {
  return TENANT_TOPIC_CHANNELS.map((channel) =>
    buildTenantTopic(tenantId, channel)
  );
}

/**
 * 토픽 문자열이 특정 테넌트 스코프에 속하는지 확인
 */
export function isTopicOfTenant(topic: string, tenantId: string): boolean {
  return topic.startsWith(`${TENANT_TOPIC_PREFIX}${tenantId}_`);
}
