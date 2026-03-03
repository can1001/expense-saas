/**
 * PWA screenshot scenarios
 *
 * Captures screenshots for the PWA usage guide
 */

import { Page, BrowserContext } from '@playwright/test';
import { config, selectors } from '../config';
import { captureFullPage, captureElement, captureViewport } from '../utils/capture';

/**
 * Capture PWA-related screenshots
 */
export async function capturePwaScreenshots(
  page: Page,
  context: BrowserContext
): Promise<void> {
  console.log('\n--- PWA Screenshots ---\n');

  // Navigate to expenses page first (a page that uses offline features)
  console.log('  Navigating to /expenses/new...');
  await page.goto(`${config.baseUrl}/expenses/new`);
  await page.waitForLoadState('networkidle');

  // 1. offline-banner.png - Offline status banner
  console.log('\n[1/3] Capturing offline-banner...');

  try {
    // Simulate offline mode
    console.log('  Enabling offline mode...');
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // Try to navigate or refresh to trigger offline banner
    await page.reload().catch(() => {
      console.log('    Page reload failed (expected in offline mode)');
    });

    await page.waitForTimeout(1000);

    // Look for offline banner
    const offlineBannerSelectors = [
      '.fixed.top-0[class*="amber"]',
      '.fixed.top-0[class*="yellow"]',
      '[class*="offline"]',
      'div:has-text("오프라인")',
    ];

    let bannerCaptured = false;
    for (const selector of offlineBannerSelectors) {
      const banner = page.locator(selector).first();
      if (await banner.isVisible().catch(() => false)) {
        await captureElement(page, 'offline-banner', banner);
        bannerCaptured = true;
        break;
      }
    }

    if (!bannerCaptured) {
      // Capture viewport showing offline state
      console.log('    Offline banner not found, capturing viewport...');
      await captureViewport(page, 'offline-banner');
    }

    // Restore online mode
    console.log('  Restoring online mode...');
    await context.setOffline(false);
    await page.waitForTimeout(500);
  } catch (error) {
    console.log('    Error capturing offline banner:', error);
    await context.setOffline(false);
  }

  // 2. sync-status.png - Sync status indicator
  console.log('\n[2/3] Capturing sync-status...');

  try {
    // Navigate to a page that might show sync status
    await page.goto(`${config.baseUrl}/expenses`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Look for sync status indicator
    const syncSelectors = [
      '[class*="sync"]',
      'button:has-text("동기화")',
      'div:has-text("동기화")',
      '[class*="SyncStatus"]',
    ];

    let syncCaptured = false;
    for (const selector of syncSelectors) {
      const syncElement = page.locator(selector).first();
      if (await syncElement.isVisible().catch(() => false)) {
        await captureElement(page, 'sync-status', syncElement);
        syncCaptured = true;
        break;
      }
    }

    if (!syncCaptured) {
      console.log('    Sync status indicator not visible, skipping...');
    }
  } catch (error) {
    console.log('    Error capturing sync status:', error);
  }

  // 3. pwa-install-desktop.png - PWA install prompt (if available in-app)
  console.log('\n[3/3] Capturing pwa-install-desktop...');

  try {
    // Navigate to home page which might have install prompt
    await page.goto(`${config.baseUrl}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Look for install prompt/banner
    const installSelectors = [
      '[class*="install"]',
      'button:has-text("설치")',
      'div:has-text("앱 설치")',
      '[class*="pwa"]',
      'div:has-text("홈 화면")',
    ];

    let installCaptured = false;
    for (const selector of installSelectors) {
      const installElement = page.locator(selector).first();
      if (await installElement.isVisible().catch(() => false)) {
        await captureElement(page, 'pwa-install-desktop', installElement);
        installCaptured = true;
        break;
      }
    }

    if (!installCaptured) {
      // Note: Browser's native install prompt cannot be captured
      console.log('    PWA install prompt not found in-app (browser UI cannot be captured)');
    }
  } catch (error) {
    console.log('    Error capturing PWA install:', error);
  }

  console.log('\n--- PWA Screenshots Complete ---\n');
}

/**
 * Capture offline page screenshot
 */
export async function captureOfflinePageScreenshot(page: Page): Promise<void> {
  console.log('\n--- Offline Page Screenshot ---\n');

  await page.goto(`${config.baseUrl}/offline`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  await captureFullPage(page, 'offline-page');

  console.log('\n--- Offline Page Screenshot Complete ---\n');
}
