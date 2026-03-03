/**
 * Push notification screenshot scenarios
 *
 * Captures screenshots for the push notification guide
 */

import { Page, BrowserContext } from '@playwright/test';
import { config } from '../config';
import { captureFullPage, captureElement, captureViewport } from '../utils/capture';

/**
 * Capture push notification related screenshots
 */
export async function capturePushScreenshots(
  page: Page,
  context: BrowserContext
): Promise<void> {
  console.log('\n--- Push Notification Screenshots ---\n');

  // 1. push-permission.png - Permission request UI
  console.log('\n[1/3] Capturing push-permission...');

  try {
    // Navigate to a page that might have push permission UI
    // Check for settings page or notification settings
    const settingsUrls = [
      '/mypage/settings',
      '/mypage/notifications',
      '/settings',
      '/mypage',
    ];

    let permissionCaptured = false;

    for (const url of settingsUrls) {
      try {
        await page.goto(`${config.baseUrl}${url}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Look for permission request UI
        const permissionSelectors = [
          'button:has-text("알림 받기")',
          'button:has-text("알림 허용")',
          'button:has-text("푸시")',
          '[class*="notification"]',
          'div:has-text("알림 권한")',
        ];

        for (const selector of permissionSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible().catch(() => false)) {
            await captureElement(page, 'push-permission', element);
            permissionCaptured = true;
            break;
          }
        }

        if (permissionCaptured) break;
      } catch {
        continue;
      }
    }

    if (!permissionCaptured) {
      console.log('    Push permission UI not found in-app');
    }
  } catch (error) {
    console.log('    Error capturing push permission:', error);
  }

  // 2. push-notification.png - Notification example
  console.log('\n[2/3] Capturing push-notification...');

  try {
    // Navigate to notification list if exists
    const notificationUrls = [
      '/notifications',
      '/mypage/notifications',
    ];

    let notificationCaptured = false;

    for (const url of notificationUrls) {
      try {
        await page.goto(`${config.baseUrl}${url}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Check if page has notification content
        const notificationSelectors = [
          '[class*="notification"]',
          'div[class*="card"]:has-text("결재")',
          'div[class*="card"]:has-text("승인")',
          'ul:has(li)',
        ];

        for (const selector of notificationSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible().catch(() => false)) {
            await captureFullPage(page, 'push-notification');
            notificationCaptured = true;
            break;
          }
        }

        if (notificationCaptured) break;
      } catch {
        continue;
      }
    }

    if (!notificationCaptured) {
      // Note: Actual browser/OS notifications cannot be captured
      console.log('    Notification list not found (OS notifications cannot be captured)');
    }
  } catch (error) {
    console.log('    Error capturing notification:', error);
  }

  // 3. push-settings.png - Notification settings page
  console.log('\n[3/3] Capturing push-settings...');

  try {
    // Try to find notification settings
    const settingsUrls = [
      '/mypage/settings',
      '/mypage/notifications',
      '/settings/notifications',
      '/mypage',
    ];

    let settingsCaptured = false;

    for (const url of settingsUrls) {
      try {
        await page.goto(`${config.baseUrl}${url}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Look for settings content
        const settingsSelectors = [
          'div:has-text("알림 설정")',
          'section:has-text("알림")',
          '[class*="settings"]',
          'form:has(input[type="checkbox"])',
          'div:has(label:has-text("알림"))',
        ];

        for (const selector of settingsSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible().catch(() => false)) {
            await captureFullPage(page, 'push-settings');
            settingsCaptured = true;
            break;
          }
        }

        if (settingsCaptured) break;
      } catch {
        continue;
      }
    }

    if (!settingsCaptured) {
      // Capture mypage as fallback
      await page.goto(`${config.baseUrl}/mypage`);
      await page.waitForLoadState('networkidle');
      await captureFullPage(page, 'push-settings');
    }
  } catch (error) {
    console.log('    Error capturing push settings:', error);
  }

  console.log('\n--- Push Notification Screenshots Complete ---\n');
}
