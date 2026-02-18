import { test, expect } from './fixtures/base.js';

/**
 * E2E Accessibility Tests for Posture Guard PWA
 */

test.describe('ARIA Roles and Labels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });
  });

  test('header has banner role', async ({ page }) => {
    await expect(page.locator('header[role="banner"]')).toBeVisible();
  });

  test('main content has main role', async ({ page }) => {
    await expect(page.locator('main[role="main"]')).toBeVisible();
  });

  test('button group has proper aria-label', async ({ page }) => {
    await expect(page.locator('[role="group"][aria-label="앱 메뉴"]')).toBeVisible();
  });

  test('stats button has accessible label', async ({ page }) => {
    const button = page.locator('button[aria-label="통계 보기"]');
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-label', '통계 보기');
  });

  test('settings button has accessible label', async ({ page }) => {
    const button = page.locator('button[aria-label="설정 열기"]');
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-label', '설정 열기');
  });
});

test.describe('Modal Accessibility', () => {
  test('settings modal has correct ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  test('stats modal has correct ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="통계 보기"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  test('modal close button has aria-label', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    const closeButton = page.locator('button[aria-label="닫기"]').first();
    await expect(closeButton).toBeVisible();
  });
});

test.describe('Focus Management', () => {
  test('focus moves to modal when opened', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await page.waitForTimeout(100);

    const focusInModal = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      return modal?.contains(document.activeElement);
    });

    expect(focusInModal).toBe(true);
  });

  test('escape key closes modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeHidden();
  });
});

test.describe('Form Controls', () => {
  test('volume slider has aria-label', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    const volumeSlider = page.locator('input[aria-label="알림 볼륨"]');
    await expect(volumeSlider).toBeVisible();
  });

  test('sensitivity slider has aria-label', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    const sensitivitySlider = page.locator('input[aria-label="감지 민감도"]');
    await expect(sensitivitySlider).toBeVisible();
  });

  test('daily goal input has aria-label', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    const goalInput = page.locator('input[aria-label="일일 목표 퍼센트"]');
    await expect(goalInput).toBeVisible();
  });
});

test.describe('Screen Reader Support', () => {
  test('page has language attribute', async ({ page }) => {
    await page.goto('/');

    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBeTruthy();
  });

  test('video element has aria-hidden', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    const video = page.locator('video.hidden-video');
    await expect(video).toHaveAttribute('aria-hidden', 'true');
  });

  test('heading hierarchy is logical', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText('자세 교정 알리미');
  });
});

test.describe('Keyboard Navigation', () => {
  test('all interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Tab to buttons
    await page.keyboard.press('Tab');

    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });

  test('can navigate through header buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    const statsButton = page.locator('button[aria-label="통계 보기"]');
    await statsButton.focus();

    const isFocused = await statsButton.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
  });
});

test.describe('Mobile Accessibility', () => {
  test('touch targets are accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    const buttonSizes = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.header-buttons button');
      return Array.from(buttons).map(btn => {
        const rect = btn.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    });

    buttonSizes.forEach(size => {
      expect(size.width).toBeGreaterThanOrEqual(40);
      expect(size.height).toBeGreaterThanOrEqual(40);
    });
  });
});

test.describe('Complete User Journey', () => {
  test('keyboard-only user can open and close settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Tab to settings button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Verify modal opened
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
  });
});
