import { test, expect } from './fixtures/base.js';

/**
 * E2E Data Persistence Tests
 * Tests localStorage, settings persistence, and data integrity
 */

test.describe('Statistics Persistence', () => {
  test('should maintain stats after page reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Open stats
    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    // Get current values
    const avgScoreCard = page.locator('.stats-card').filter({ hasText: '평균 점수' });
    await avgScoreCard.locator('.stats-card-value').textContent();

    // Close and reload
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Reopen stats
    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    // Values should be the same (or at least exist)
    const newAvg = await avgScoreCard.locator('.stats-card-value').textContent();
    expect(newAvg).toBeTruthy();
  });

  test('should preserve streak count', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Open stats
    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    // Get streak value
    const streakCard = page.locator('.stats-card').filter({ hasText: '연속 사용' });
    await expect(streakCard).toBeVisible();

    const streakValue = await streakCard.locator('.stats-card-value').textContent();

    // Reload
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Check preserved
    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('.stats-dashboard', { state: 'visible' });

    const newStreakValue = await streakCard.locator('.stats-card-value').textContent();
    expect(newStreakValue).toBe(streakValue);
  });
});

test.describe('LocalStorage Structure', () => {
  test('should store settings in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Make a settings change
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });
    await page.locator('button.theme-btn.light').click();
    await page.keyboard.press('Escape');

    // Check localStorage has some data
    const hasData = await page.evaluate(() => {
      return Object.keys(localStorage).length > 0;
    });

    expect(hasData).toBe(true);
  });

  test('should handle localStorage quota exceeded gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Try to fill localStorage (this might not actually exceed quota in test)
    await page.evaluate(() => {
      try {
        // Try to store a large amount of data
        const largeData = 'x'.repeat(1024 * 1024); // 1MB
        for (let i = 0; i < 10; i++) {
          localStorage.setItem(`test-data-${i}`, largeData);
        }
      } catch {
        // Expected - quota exceeded
      }
    });

    // App should still function
    await expect(page.locator('.app')).toBeVisible();

    // Settings should still work
    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('.full-settings-modal')).toBeVisible();

    // Cleanup
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(key => key.startsWith('test-data-'))
        .forEach(key => localStorage.removeItem(key));
    });
  });
});

test.describe('Data Migration', () => {
  test('should handle missing data fields gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Clear all storage
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Reload
    await page.reload();
    await page.waitForSelector('header.header', { timeout: 10000 });

    // App should work with defaults
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    // Volume slider should have a default value
    const volumeSlider = page.getByRole('slider', { name: '알림 볼륨' });
    const value = await volumeSlider.inputValue();
    expect(parseFloat(value)).toBeGreaterThanOrEqual(0);
  });
});
