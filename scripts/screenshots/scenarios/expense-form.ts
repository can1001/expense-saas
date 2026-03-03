/**
 * Expense form screenshot scenarios
 *
 * Captures screenshots for the expense form user guide
 */

import { Page } from '@playwright/test';
import { config, selectors } from '../config';
import {
  captureFullPage,
  captureSection,
  captureModal,
  scrollAndCapture,
} from '../utils/capture';

/**
 * Capture all expense form screenshots
 */
export async function captureExpenseFormScreenshots(page: Page): Promise<void> {
  console.log('\n--- Expense Form Screenshots ---\n');

  // Navigate to new expense form
  console.log('  Navigating to /expenses/new...');
  await page.goto(`${config.baseUrl}/expenses/new`);
  await page.waitForLoadState('networkidle');

  // Wait for form to be fully loaded
  await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

  // 1. expense-new.png - Full page screenshot of new expense form
  console.log('\n[1/8] Capturing expense-new...');
  await captureFullPage(page, 'expense-new');

  // 2. budget-section.png - Budget information section
  console.log('\n[2/8] Capturing budget-section...');

  // Try to select some budget options to show active state
  try {
    // Select committee if dropdown exists
    const committeeSelect = page.locator('select').first();
    if (await committeeSelect.isVisible()) {
      const options = await committeeSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await committeeSelect.selectOption({ index: 1 });
        await page.waitForTimeout(300);
      }
    }
  } catch {
    console.log('    Could not select committee, continuing...');
  }

  await scrollAndCapture(page, 'budget-section', selectors.sections.budget);

  // 3. items-section.png - Detail items section with sample data
  console.log('\n[3/8] Capturing items-section...');

  // Try to fill in some sample data
  try {
    // Find description/memo input and fill
    const descriptionInput = page.locator('input[placeholder*="설명"], input[placeholder*="적요"], textarea').first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('회의 다과 구입');
    }

    // Find unit price input and fill
    const unitPriceInputs = page.locator('input[type="number"], input[inputmode="numeric"]');
    const count = await unitPriceInputs.count();
    if (count >= 2) {
      await unitPriceInputs.nth(0).fill('50000');
      await unitPriceInputs.nth(1).fill('10');
      await page.waitForTimeout(300);
    }
  } catch {
    console.log('    Could not fill sample data, continuing...');
  }

  await scrollAndCapture(page, 'items-section', selectors.sections.items);

  // 4. applicant-section.png - Applicant information section
  console.log('\n[4/8] Capturing applicant-section...');
  await scrollAndCapture(page, 'applicant-section', selectors.sections.applicant);

  // 5. bank-section.png - Bank information section
  console.log('\n[5/8] Capturing bank-section...');
  await scrollAndCapture(page, 'bank-section', selectors.sections.bank);

  // 6. file-upload.png - File upload section
  console.log('\n[6/8] Capturing file-upload...');
  await scrollAndCapture(page, 'file-upload', selectors.sections.fileUpload);

  // 7. approval-preview.png - Approval line preview
  console.log('\n[7/8] Capturing approval-preview...');

  // Wait for approval line to load (may require API response)
  try {
    await page.waitForSelector('text=결재선, text=결재, text=1차', { timeout: 5000 });
  } catch {
    console.log('    Approval line not loaded, capturing anyway...');
  }

  await scrollAndCapture(page, 'approval-preview', selectors.sections.approvalPreview);

  // 8. signature-modal.png - Signature selection modal
  console.log('\n[8/8] Capturing signature-modal...');

  try {
    // Find and click submit button to open signature modal
    const submitButton = page.locator('button:has-text("제출"), button[type="submit"]:has-text("제출")').first();

    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Wait for modal to appear
      await page.waitForTimeout(500);

      // Try different modal selectors
      const modalSelectors = [
        '[role="dialog"]',
        '.fixed.inset-0 .bg-white',
        '.modal',
        'div[class*="modal"]',
      ];

      let modalCaptured = false;
      for (const selector of modalSelectors) {
        const modal = page.locator(selector).first();
        if (await modal.isVisible()) {
          await captureModal(page, 'signature-modal', { selector: modal });
          modalCaptured = true;
          break;
        }
      }

      if (!modalCaptured) {
        // Capture viewport as fallback
        console.log('    Modal not found, capturing viewport...');
        await captureFullPage(page, 'signature-modal');
      }

      // Close modal
      const closeButton = page.locator('button:has-text("취소"), button:has-text("닫기"), [aria-label="Close"]').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(300);
      } else {
        // Press Escape to close modal
        await page.keyboard.press('Escape');
      }
    } else {
      console.log('    Submit button not found, skipping signature modal...');
    }
  } catch (error) {
    console.log('    Could not capture signature modal:', error);
  }

  console.log('\n--- Expense Form Screenshots Complete ---\n');
}

/**
 * Capture expense list page screenshot
 */
export async function captureExpenseListScreenshots(page: Page): Promise<void> {
  console.log('\n--- Expense List Screenshots ---\n');

  // Navigate to expense list
  console.log('  Navigating to /expenses...');
  await page.goto(`${config.baseUrl}/expenses`);
  await page.waitForLoadState('networkidle');

  // Wait for list to load
  await page.waitForTimeout(1000);

  // Capture list view
  await captureFullPage(page, 'expense-list');

  console.log('\n--- Expense List Screenshots Complete ---\n');
}
