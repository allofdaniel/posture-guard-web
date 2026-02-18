import { test, expect } from './fixtures/base.js';

/**
 * E2E Modal Tests for Posture Guard Web App
 */

test.describe('Settings Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });
  });

  test('should open and close settings modal correctly', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('.modal.full-settings-modal')).toBeVisible();

    await page.locator('button[aria-label="닫기"]').first().click();
    await expect(page.locator('.modal.full-settings-modal')).not.toBeVisible();
  });

  test('should close settings modal with Escape key', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('.modal.full-settings-modal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.modal.full-settings-modal')).not.toBeVisible();
  });

  test('should close settings modal by clicking backdrop', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('.modal.full-settings-modal')).toBeVisible();

    await page.locator('.modal-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.modal.full-settings-modal')).not.toBeVisible();
  });

  test('should toggle theme from dark to light', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();

    const lightThemeButton = page.locator('button.theme-btn.light');
    await lightThemeButton.click();
    await expect(lightThemeButton).toHaveClass(/active/);

    const bodyClass = await page.evaluate(() => document.body.className);
    expect(bodyClass).toContain('light-theme');
  });

  test('should toggle theme from light to dark', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();

    // First switch to light
    await page.locator('button.theme-btn.light').click();

    // Then switch to dark
    const darkThemeButton = page.locator('button.theme-btn.dark');
    await darkThemeButton.click();
    await expect(darkThemeButton).toHaveClass(/active/);

    const bodyClass = await page.evaluate(() => document.body.className);
    expect(bodyClass).not.toContain('light-theme');
  });

  test('should change alert sound setting', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();

    const chimeButton = page.locator('button.sound-btn').filter({ hasText: '차임' });
    await chimeButton.click();
    await expect(chimeButton).toHaveClass(/active/);
  });

  test('should adjust volume slider', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();

    const volumeSlider = page.getByRole('slider', { name: '알림 볼륨' });
    await volumeSlider.fill('0.7');

    const volumeValue = page.locator('.volume-value').first();
    await expect(volumeValue).toHaveText('70%');
  });

  test('should adjust sensitivity slider', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();

    const sensitivitySlider = page.getByRole('slider', { name: '감지 민감도' });
    await sensitivitySlider.fill('1.5');

    const sensitivityValue = page.locator('.settings-section').filter({ hasText: '감지' }).locator('.volume-value');
    await expect(sensitivityValue).toHaveText('1.5');
  });

  test('should change break interval setting', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();

    const breakButton = page.locator('button.break-btn').filter({ hasText: '45분' });
    await breakButton.click();
    await expect(breakButton).toHaveClass(/active/);
  });
});

test.describe('Stats Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });
  });

  test('should open and close stats modal correctly', async ({ page }) => {
    await page.locator('button[aria-label="통계 보기"]').click();
    await expect(page.locator('.modal.stats-dashboard')).toBeVisible();

    await page.locator('button[aria-label="닫기"]').first().click();
    await expect(page.locator('.modal.stats-dashboard')).not.toBeVisible();
  });

  test('should close stats modal with Escape key', async ({ page }) => {
    await page.locator('button[aria-label="통계 보기"]').click();
    await expect(page.locator('.modal.stats-dashboard')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.modal.stats-dashboard')).not.toBeVisible();
  });

  test('should display stats summary cards', async ({ page }) => {
    await page.locator('button[aria-label="통계 보기"]').click();

    await expect(page.locator('.stats-card-label').filter({ hasText: '평균 점수' })).toBeVisible();
    await expect(page.locator('.stats-card-label').filter({ hasText: '최고 점수' })).toBeVisible();
    await expect(page.locator('.stats-card-label').filter({ hasText: '총 모니터링' })).toBeVisible();
    await expect(page.locator('.stats-card-label').filter({ hasText: '연속 사용' })).toBeVisible();
  });

  test('should display goal progress section', async ({ page }) => {
    await page.locator('button[aria-label="통계 보기"]').click();

    await expect(page.locator('.stats-goal-section')).toBeVisible();
    await expect(page.locator('.goal-title')).toHaveText('일일 목표');
  });
});

test.describe('Modal Keyboard Navigation', () => {
  test('should close any modal with Escape key', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Test settings modal
    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('.modal.full-settings-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal.full-settings-modal')).not.toBeVisible();

    // Test stats modal
    await page.locator('button[aria-label="통계 보기"]').click();
    await expect(page.locator('.modal.stats-dashboard')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal.stats-dashboard')).not.toBeVisible();
  });
});

test.describe('Modal Accessibility', () => {
  test('should have proper ARIA attributes on settings modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    const modal = page.locator('.modal.full-settings-modal');

    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  test('should have proper ARIA attributes on stats modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="통계 보기"]').click();
    const modal = page.locator('.modal.stats-dashboard');

    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  test('should have accessible close button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('button[aria-label="닫기"]').first()).toBeVisible();
  });

  test('should have accessible sliders', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();

    await expect(page.getByRole('slider', { name: '알림 볼륨' })).toBeVisible();
    await expect(page.getByRole('slider', { name: '감지 민감도' })).toBeVisible();
  });
});
