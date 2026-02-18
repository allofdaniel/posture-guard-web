import { test, expect } from './fixtures/base.js';

/**
 * E2E Navigation Tests for Posture Guard Web App
 */

test.describe('App Initialization', () => {
  test('should show app header after loading', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load (should be fast with mocked MediaPipe)
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Check header
    const title = page.locator('h1:has-text("자세 교정 알리미")');
    await expect(title).toBeVisible();
  });

  test('should show calibration view after loading', async ({ page }) => {
    await page.goto('/');

    // Wait for calibration view
    await page.waitForSelector('.calibration-panel', { timeout: 10000 });

    // Verify calibration elements
    await expect(page.locator('.calibration-panel')).toBeVisible();
  });
});

test.describe('Settings Modal', () => {
  test('should open and close settings modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Click settings button
    await page.locator('button[aria-label="설정 열기"]').click();

    // Verify modal is open
    await expect(page.locator('.full-settings-modal')).toBeVisible();

    // Close modal
    await page.locator('button[aria-label="닫기"]').first().click();
    await expect(page.locator('.full-settings-modal')).not.toBeVisible();
  });

  test('should close settings modal with Escape key', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('.full-settings-modal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.full-settings-modal')).not.toBeVisible();
  });

  test('should allow changing theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();

    // Click light theme
    const lightThemeBtn = page.locator('button.theme-btn.light');
    await lightThemeBtn.click();
    await expect(lightThemeBtn).toHaveClass(/active/);

    // Click dark theme
    const darkThemeBtn = page.locator('button.theme-btn.dark');
    await darkThemeBtn.click();
    await expect(darkThemeBtn).toHaveClass(/active/);
  });
});

test.describe('Stats Modal', () => {
  test('should open and close stats modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Click stats button
    await page.locator('button[aria-label="통계 보기"]').click();

    // Verify modal is open
    await expect(page.locator('.stats-dashboard')).toBeVisible();

    // Close modal
    await page.locator('button[aria-label="닫기"]').first().click();
    await expect(page.locator('.stats-dashboard')).not.toBeVisible();
  });

  test('should display stats summary cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="통계 보기"]').click();

    // Verify summary cards
    await expect(page.locator('.stats-card-label:has-text("평균 점수")')).toBeVisible();
    await expect(page.locator('.stats-card-label:has-text("최고 점수")')).toBeVisible();
  });
});

test.describe('UI Elements', () => {
  test('should show header buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await expect(page.locator('button[aria-label="통계 보기"]')).toBeVisible();
    await expect(page.locator('button[aria-label="설정 열기"]')).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await expect(page.locator('header[role="banner"]')).toBeVisible();
    await expect(page.locator('[role="group"][aria-label="앱 메뉴"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();
  });
});

test.describe('Calibration View', () => {
  test('should display calibration steps', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.calibration-panel', { timeout: 10000 });

    const steps = page.locator('.calibration-step');
    await expect(steps).toHaveCount(3);
  });

  test('should show calibration status message', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.calibration-status', { timeout: 10000 });

    await expect(page.locator('.calibration-status')).toBeVisible();
  });

  test('should show canvas element', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 10000 });

    await expect(page.locator('canvas.camera-canvas')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await expect(page.locator('header.header')).toBeVisible();
    await expect(page.locator('h1:has-text("자세 교정 알리미")')).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await expect(page.locator('header.header')).toBeVisible();
    await expect(page.locator('main.main')).toBeVisible();
  });
});
