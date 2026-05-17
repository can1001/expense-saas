#!/usr/bin/env node
/**
 * Render Cron Job 진입점
 *
 * 자동이체 일괄 처리 API를 호출하여 그 날짜에 생성되어야 하는
 * 정기 지출결의서를 DRAFT 상태로 자동 생성한다.
 *
 * 호출 대상: POST {APP_URL}/api/recurring-expenses/process
 * 인증: Authorization: Bearer {CRON_SECRET}
 *
 * 환경변수 (Render 대시보드에서 설정):
 * - APP_URL: 운영 웹 서비스 URL (예: https://expense-system.onrender.com)
 * - CRON_SECRET: 웹 서비스와 동일한 시크릿 토큰
 */

const appUrl = process.env.APP_URL;
const cronSecret = process.env.CRON_SECRET;

if (!appUrl) {
  console.error('[CRON] APP_URL 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

if (!cronSecret) {
  console.error('[CRON] CRON_SECRET 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const endpoint = `${appUrl.replace(/\/$/, '')}/api/recurring-expenses/process`;

console.log(`[CRON] 자동이체 일괄 처리 시작: ${endpoint}`);

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`[CRON] 호출 실패 (HTTP ${response.status}): ${body}`);
    process.exit(1);
  }

  console.log(`[CRON] 호출 성공: ${body}`);
} catch (error) {
  console.error('[CRON] 네트워크 오류:', error);
  process.exit(1);
}
