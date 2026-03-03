/**
 * Screenshot capture utilities
 */

import { Page, Locator } from '@playwright/test';
import { config } from '../config';
import path from 'path';
import fs from 'fs';

interface CaptureOptions {
  selector?: string | Locator;
  padding?: number;
  fullWidth?: boolean;
  viewport?: 'desktop' | 'mobile' | 'tablet';
  mask?: string[];
  suffix?: string;
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir(): string {
  const outputPath = path.resolve(config.outputDir);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
    console.log(`  Created output directory: ${outputPath}`);
  }
  return outputPath;
}

/**
 * Get output file path
 */
function getOutputPath(name: string, suffix?: string): string {
  const outputDir = ensureOutputDir();
  const fileName = suffix ? `${name}-${suffix}.png` : `${name}.png`;
  return path.resolve(outputDir, fileName);
}

/**
 * Wait for animations to settle
 */
async function waitForStable(page: Page): Promise<void> {
  await page.waitForTimeout(config.captureDelay);
}

/**
 * Capture full page screenshot
 */
export async function captureFullPage(
  page: Page,
  name: string,
  options: CaptureOptions = {}
): Promise<string> {
  await waitForStable(page);

  const filePath = getOutputPath(name, options.suffix);

  await page.screenshot({
    path: filePath,
    fullPage: true,
    type: 'png',
  });

  console.log(`  [OK] Captured: ${path.basename(filePath)}`);
  return filePath;
}

/**
 * Capture current viewport only
 */
export async function captureViewport(
  page: Page,
  name: string,
  options: CaptureOptions = {}
): Promise<string> {
  await waitForStable(page);

  const filePath = getOutputPath(name, options.suffix);

  await page.screenshot({
    path: filePath,
    fullPage: false,
    type: 'png',
  });

  console.log(`  [OK] Captured viewport: ${path.basename(filePath)}`);
  return filePath;
}

/**
 * Capture a specific section/element
 */
export async function captureSection(
  page: Page,
  name: string,
  options: CaptureOptions
): Promise<string | null> {
  await waitForStable(page);

  if (!options.selector) {
    console.warn(`  [WARN] No selector provided for ${name}`);
    return null;
  }

  const element =
    typeof options.selector === 'string'
      ? page.locator(options.selector).first()
      : options.selector;

  try {
    // Wait for element to be visible
    await element.waitFor({ state: 'visible', timeout: 5000 });

    const filePath = getOutputPath(name, options.suffix);

    await element.screenshot({
      path: filePath,
      type: 'png',
    });

    console.log(`  [OK] Captured section: ${path.basename(filePath)}`);
    return filePath;
  } catch (error) {
    console.warn(`  [WARN] Element not visible: ${name}`);
    return null;
  }
}

/**
 * Capture a modal dialog
 */
export async function captureModal(
  page: Page,
  name: string,
  options: CaptureOptions
): Promise<string | null> {
  await waitForStable(page);

  if (!options.selector) {
    console.warn(`  [WARN] No selector provided for modal ${name}`);
    return null;
  }

  const modal =
    typeof options.selector === 'string'
      ? page.locator(options.selector).first()
      : options.selector;

  try {
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    const filePath = getOutputPath(name, options.suffix);

    await modal.screenshot({
      path: filePath,
      type: 'png',
    });

    console.log(`  [OK] Captured modal: ${path.basename(filePath)}`);
    return filePath;
  } catch (error) {
    console.warn(`  [WARN] Modal not visible: ${name}`);
    return null;
  }
}

/**
 * Capture element by locator
 */
export async function captureElement(
  page: Page,
  name: string,
  locator: Locator,
  options: CaptureOptions = {}
): Promise<string | null> {
  await waitForStable(page);

  try {
    await locator.waitFor({ state: 'visible', timeout: 5000 });

    const filePath = getOutputPath(name, options.suffix);

    await locator.screenshot({
      path: filePath,
      type: 'png',
    });

    console.log(`  [OK] Captured element: ${path.basename(filePath)}`);
    return filePath;
  } catch (error) {
    console.warn(`  [WARN] Element not visible: ${name}`);
    return null;
  }
}

/**
 * Scroll element into view and capture
 */
export async function scrollAndCapture(
  page: Page,
  name: string,
  selector: string,
  options: CaptureOptions = {}
): Promise<string | null> {
  const element = page.locator(selector).first();

  try {
    await element.scrollIntoViewIfNeeded();
    return await captureSection(page, name, { ...options, selector: element });
  } catch (error) {
    console.warn(`  [WARN] Could not scroll to element: ${name}`);
    return null;
  }
}
