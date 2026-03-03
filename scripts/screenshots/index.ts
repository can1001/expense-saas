/**
 * Screenshot capture script for user guide documentation
 *
 * Usage:
 *   npm run screenshots           # Capture all screenshots
 *   npm run screenshots:expense   # Capture expense form only
 *   npm run screenshots:pwa       # Capture PWA only
 *   npm run screenshots:push      # Capture push notification only
 *   npm run screenshots:headed    # Run with visible browser
 */

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { config } from './config';
import { login } from './utils/auth';
import { captureExpenseFormScreenshots, captureExpenseListScreenshots } from './scenarios/expense-form';
import { capturePwaScreenshots, captureOfflinePageScreenshot } from './scenarios/pwa';
import { capturePushScreenshots } from './scenarios/push';

type Scenario = 'expense' | 'pwa' | 'push' | 'all';

interface ScriptOptions {
  scenarios: Scenario[];
  viewport: 'desktop' | 'mobile' | 'both';
  headless: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);

  // Determine scenarios
  const scenarios: Scenario[] = [];
  if (args.includes('expense')) scenarios.push('expense');
  if (args.includes('pwa')) scenarios.push('pwa');
  if (args.includes('push')) scenarios.push('push');
  if (args.includes('--all') || scenarios.length === 0) {
    return {
      scenarios: ['expense', 'pwa', 'push'],
      viewport: args.includes('--mobile') ? 'mobile' : args.includes('--both') ? 'both' : 'desktop',
      headless: !args.includes('--headed'),
    };
  }

  return {
    scenarios,
    viewport: args.includes('--mobile') ? 'mobile' : args.includes('--both') ? 'both' : 'desktop',
    headless: !args.includes('--headed'),
  };
}

async function runScenarios(
  page: Page,
  context: BrowserContext,
  scenarios: Scenario[]
): Promise<void> {
  if (scenarios.includes('expense') || scenarios.includes('all')) {
    await captureExpenseFormScreenshots(page);
    await captureExpenseListScreenshots(page);
  }

  if (scenarios.includes('pwa') || scenarios.includes('all')) {
    await capturePwaScreenshots(page, context);
    await captureOfflinePageScreenshot(page);
  }

  if (scenarios.includes('push') || scenarios.includes('all')) {
    await capturePushScreenshots(page, context);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('='.repeat(60));
  console.log('Screenshot Capture Script');
  console.log('='.repeat(60));
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Output: ${config.outputDir}`);
  console.log(`Scenarios: ${options.scenarios.join(', ')}`);
  console.log(`Viewport: ${options.viewport}`);
  console.log(`Headless: ${options.headless}`);
  console.log('='.repeat(60));

  const browser: Browser = await chromium.launch({
    headless: options.headless,
  });

  let exitCode = 0;

  try {
    // Desktop viewport
    if (options.viewport === 'desktop' || options.viewport === 'both') {
      console.log('\n[Desktop Viewport]');
      console.log('-'.repeat(40));

      const context = await browser.newContext({
        viewport: config.viewports.desktop,
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
      });
      const page = await context.newPage();

      // Login
      console.log('\nLogging in...');
      await login(page);

      // Run scenarios
      await runScenarios(page, context, options.scenarios);

      await context.close();
    }

    // Mobile viewport
    if (options.viewport === 'mobile' || options.viewport === 'both') {
      console.log('\n[Mobile Viewport]');
      console.log('-'.repeat(40));

      const context = await browser.newContext({
        viewport: config.viewports.mobile,
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      // Login
      console.log('\nLogging in...');
      await login(page);

      // Run scenarios with mobile suffix
      // Note: For now, we use the same scenarios
      // Could add mobile-specific captures later
      await runScenarios(page, context, options.scenarios);

      await context.close();
    }

    console.log('\n' + '='.repeat(60));
    console.log('[DONE] Screenshots captured successfully!');
    console.log(`Output directory: ${config.outputDir}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n[ERROR] Screenshot capture failed:');
    console.error(error);
    exitCode = 1;
  } finally {
    await browser.close();
  }

  process.exit(exitCode);
}

// Run main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
