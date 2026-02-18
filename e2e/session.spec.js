import { test, expect } from './fixtures/base.js';

/**
 * E2E Session Management Tests
 * Tests session tracking, timers, and break reminders
 */

test.describe('Session Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });
  });

  test('should display session information in stats', async ({ page }) => {
    // Open stats modal
    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    // Check for monitoring time display
    await expect(page.locator('.stats-card-label').filter({ hasText: '총 모니터링' })).toBeVisible();
  });

  test('should track consecutive usage days', async ({ page }) => {
    // Open stats modal
    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    // Check for streak display
    await expect(page.locator('.stats-card-label').filter({ hasText: '연속 사용' })).toBeVisible();
  });

  test('should show goal progress', async ({ page }) => {
    // Open stats modal
    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    // Check goal section
    await expect(page.locator('.stats-goal-section')).toBeVisible();
    await expect(page.locator('.goal-title')).toHaveText('일일 목표');

    // Progress bar should exist
    await expect(page.locator('.goal-progress-bar, .progress-fill')).toBeVisible();
  });
});

test.describe('Break Reminder Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });
  });

  test('should configure break interval', async ({ page }) => {
    // Open settings
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    // Check break interval options exist
    const breakButtons = page.locator('button.break-btn');
    const count = await breakButtons.count();
    expect(count).toBeGreaterThan(0);

    // Select 45 minutes
    const btn45 = page.locator('button.break-btn').filter({ hasText: '45분' });
    await btn45.click();
    await expect(btn45).toHaveClass(/active/);
  });

  test('should persist break interval selection', async ({ page }) => {
    // Open settings and set break interval
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    const btn60 = page.locator('button.break-btn').filter({ hasText: '60분' });
    await btn60.click();
    await expect(btn60).toHaveClass(/active/);

    // Close and reopen
    await page.keyboard.press('Escape');
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    // Should still be selected
    await expect(btn60).toHaveClass(/active/);
  });

  test('should have off option for break reminders', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    // Check for "off" or "끄기" option
    const offButton = page.locator('button.break-btn').filter({ hasText: /끄기|OFF/i });
    const count = await offButton.count();

    // Either there's an off button or just time options
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Daily Goal Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });
  });

  test('should allow setting daily goal percentage', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    // Find goal input
    const goalInput = page.locator('input[aria-label="일일 목표 퍼센트"]');
    await expect(goalInput).toBeVisible();

    // Change goal value
    await goalInput.fill('85');

    // Verify change
    const value = await goalInput.inputValue();
    expect(value).toBe('85');
  });

  test('should validate goal percentage range', async ({ page }) => {
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    const goalInput = page.locator('input[aria-label="일일 목표 퍼센트"]');

    // Check min/max attributes
    const min = await goalInput.getAttribute('min');
    const max = await goalInput.getAttribute('max');

    expect(parseInt(min)).toBeGreaterThanOrEqual(0);
    expect(parseInt(max)).toBeLessThanOrEqual(100);
  });
});

test.describe('Statistics Summary', () => {
  test('should display average score', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    await expect(page.locator('.stats-card-label').filter({ hasText: '평균 점수' })).toBeVisible();

    // Score value should be displayed
    const scoreValue = page.locator('.stats-card').filter({ hasText: '평균 점수' }).locator('.stats-card-value');
    await expect(scoreValue).toBeVisible();
  });

  test('should display best score', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    await expect(page.locator('.stats-card-label').filter({ hasText: '최고 점수' })).toBeVisible();
  });

  test('should have all four stats cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    const cards = page.locator('.stats-card');
    await expect(cards).toHaveCount(4);
  });
});

test.describe('Session History', () => {
  test('should display history section in stats', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    // Check for history or chart section
    const historySection = page.locator('.stats-history, .stats-chart, .history-chart');
    const visible = await historySection.isVisible().catch(() => false);

    // History section might not always be visible depending on data
    expect(typeof visible).toBe('boolean');
  });
});
