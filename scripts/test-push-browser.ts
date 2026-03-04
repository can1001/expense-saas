/**
 * 브라우저 기반 푸시 알림 테스트 (Playwright)
 *
 * 사용법:
 *   npx playwright test scripts/test-push-browser.ts --headed
 *
 * 환경 변수:
 *   TEST_BASE_URL - 테스트 대상 URL (기본: http://localhost:4001)
 *   TEST_USER_ID - 테스트 계정 ID
 *   TEST_USER_PASSWORD - 테스트 계정 비밀번호
 */

import { test, expect, chromium } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4001';
const TEST_USER_ID = process.env.TEST_USER_ID || 'testuser';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test1234';

test.describe('푸시 알림 테스트', () => {
  test('1. VAPID 공개키 조회', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/push/vapid-public-key`);

    if (response.status() === 503) {
      console.log('⚠️ VAPID 키 미설정 - 테스트 스킵');
      test.skip();
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.publicKey).toBeTruthy();
    expect(data.publicKey.length).toBeGreaterThan(50);
    console.log(`✅ VAPID 공개키: ${data.publicKey.substring(0, 20)}...`);
  });

  test('2. 미인증 구독 요청 거부', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/push/subscribe`, {
      data: {
        subscription: {
          endpoint: 'https://test.example.com',
          keys: { p256dh: 'test', auth: 'test' },
        },
      },
    });

    expect(response.status()).toBe(401);
    console.log('✅ 미인증 요청 401 응답 확인');
  });

  test('3. 로그인 후 테스트 푸시 발송', async ({ page }) => {
    // 알림 권한 자동 허용
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      permissions: ['notifications'],
    });
    const testPage = await context.newPage();

    try {
      // 로그인 페이지로 이동
      await testPage.goto(`${BASE_URL}/login`);
      await testPage.waitForLoadState('networkidle');

      // 로그인 폼 채우기
      await testPage.fill('#userid', TEST_USER_ID);
      await testPage.fill('#password', TEST_USER_PASSWORD);
      await testPage.click('button[type="submit"]');

      // 로그인 성공 대기
      await testPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
      console.log('✅ 로그인 성공');

      // VAPID 키 확인
      const keyResponse = await testPage.request.get(`${BASE_URL}/api/push/vapid-public-key`);
      if (keyResponse.status() === 503) {
        console.log('⚠️ VAPID 키 미설정 - 테스트 스킵');
        return;
      }
      const { publicKey } = await keyResponse.json();

      // 서비스 워커 및 푸시 구독
      const subscriptionResult = await testPage.evaluate(async (vapidKey) => {
        try {
          // 서비스 워커 등록 대기
          const registration = await navigator.serviceWorker.ready;

          // 기존 구독 확인
          let subscription = await registration.pushManager.getSubscription();

          // 구독이 없으면 새로 생성
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: vapidKey,
            });
          }

          // 서버에 구독 등록
          const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: subscription.toJSON(),
              deviceName: 'Playwright Test',
            }),
          });

          const data = await response.json();
          return { success: response.ok, data };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      }, publicKey);

      if (subscriptionResult.success) {
        console.log('✅ 푸시 구독 등록 성공:', subscriptionResult.data);
      } else {
        console.log('⚠️ 푸시 구독 실패:', subscriptionResult);
      }

      // 테스트 푸시 발송
      const testResponse = await testPage.request.post(`${BASE_URL}/api/push/test`);
      const testData = await testResponse.json();

      if (testResponse.ok() && testData.success) {
        console.log('✅ 테스트 푸시 발송 성공:', testData.message);
        // 알림이 표시될 시간 대기
        await testPage.waitForTimeout(3000);
      } else {
        console.log('⚠️ 테스트 푸시 발송:', testData);
      }

      // 구독 해제
      const unsubResponse = await testPage.request.post(`${BASE_URL}/api/push/unsubscribe`, {
        data: { all: true },
      });
      if (unsubResponse.ok()) {
        console.log('✅ 구독 해제 완료');
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('결재 프로세스 알림 테스트', () => {
  test.skip('4. 지출결의서 제출 → 결재자 알림', async () => {
    // 이 테스트는 2개의 계정이 필요합니다.
    // 수동 테스트 시나리오:
    // 1. 계정 A (신청자): 지출결의서 작성 및 제출
    // 2. 계정 B (결재자): SUBMIT 알림 수신 확인
    console.log('⚠️ 이 테스트는 수동으로 진행해야 합니다.');
  });

  test.skip('5. 결재 승인 → 신청자 알림', async () => {
    // 수동 테스트 시나리오:
    // 1. 계정 B (결재자): 지출결의서 승인
    // 2. 계정 A (신청자): APPROVE 알림 수신 확인
    console.log('⚠️ 이 테스트는 수동으로 진행해야 합니다.');
  });
});
