/**
 * Authentication helper for screenshot automation
 */

import { Page } from '@playwright/test';
import { config, selectors } from '../config';

/**
 * Login to the application
 */
export async function login(page: Page): Promise<void> {
  console.log('  Navigating to login page...');
  await page.goto(`${config.baseUrl}/login`);

  // Wait for page to be fully loaded
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');

  // Wait for login form to be visible (React Suspense may cause delay)
  console.log('  Waiting for login form...');
  await page.waitForSelector(selectors.login.useridInput, { state: 'visible', timeout: 15000 });

  // Additional wait for React hydration
  await page.waitForTimeout(500);

  // Fill login form
  console.log(`  Filling login credentials (userid: ${config.testAccount.userid})...`);
  await page.fill(selectors.login.useridInput, config.testAccount.userid);
  await page.fill(selectors.login.passwordInput, config.testAccount.password);

  // Small delay before submit
  await page.waitForTimeout(200);

  // Submit form
  console.log('  Submitting login form...');
  await page.click(selectors.login.submitButton);

  // Wait for redirect (successful login)
  try {
    await page.waitForURL(
      (url) => !url.pathname.includes('/login'),
      { timeout: 10000 }
    );
    console.log('  Login successful!');
  } catch {
    // Check for error message
    const errorElement = await page.$('.text-red-600, .bg-red-50');
    if (errorElement) {
      const errorText = await errorElement.textContent();
      throw new Error(`Login failed: ${errorText}`);
    }
    throw new Error('Login failed: Timeout waiting for redirect');
  }
}

/**
 * Check if user is logged in, login if not
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  try {
    // Try to access a protected endpoint
    const response = await page.request.get(`${config.baseUrl}/api/auth/me`);

    if (!response.ok()) {
      console.log('  Not logged in, proceeding to login...');
      await login(page);
    } else {
      console.log('  Already logged in');
    }
  } catch {
    console.log('  Auth check failed, proceeding to login...');
    await login(page);
  }
}
