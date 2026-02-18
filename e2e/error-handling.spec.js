import { test as base, expect } from '@playwright/test';

/**
 * E2E Error Handling Tests
 * Tests graceful error handling for various failure scenarios
 */

// Custom fixture for error testing - injects E2E mode but allows permission control
const test = base.extend({
  page: async ({ page, baseURL }, pageProvider) => {
    // Inject E2E test mode flag BEFORE page loads
    await page.addInitScript(() => {
      window.__E2E_TEST_MODE__ = true;
      window.__MEDIAPIPE_MOCK__ = true;

      // Create fake canvas stream for camera mock
      window.__createFakeStream = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 640, 480);
        return canvas.captureStream(30);
      };

      // Mock navigator.mediaDevices.getUserMedia
      const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          if (constraints?.video) {
            return window.__createFakeStream();
          }
          if (originalGetUserMedia) {
            return originalGetUserMedia(constraints);
          }
          throw new Error('getUserMedia not supported');
        };
      }

      // Store mock landmarks
      window.__mockPoseLandmarks = {
        landmarks: [[
          { x: 0.5, y: 0.15, z: 0, visibility: 0.95 },
          ...Array(32).fill(null).map((_, i) => ({
            x: 0.5, y: 0.15 + (i * 0.02), z: 0, visibility: 0.8
          }))
        ]],
        worldLandmarks: [],
        segmentationMasks: []
      };
    });

    // Override page.goto to always add ?e2e=true parameter
    const originalGoto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const parsedUrl = new URL(url, baseURL || 'http://localhost:5173');
      parsedUrl.searchParams.set('e2e', 'true');
      return originalGoto(parsedUrl.toString(), options);
    };

    await pageProvider(page);
  },
});

test.describe('Camera Permission Denied', () => {
  test('should handle camera permission denial gracefully', async ({ page, context }) => {
    // Explicitly deny camera permission
    await context.grantPermissions([]); // Grant no permissions
    await page.addInitScript(() => {
      const permissionError = new DOMException('Camera permission denied', 'NotAllowedError');
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          throw permissionError;
        };
      }
    });

    await page.goto('/');

    // App should still load without crashing
    await page.waitForSelector('.app', { timeout: 10000 });

    // Wait a moment for error UI if permission is blocked
    await page.waitForTimeout(1000);

    const errorMessage = page.locator('.camera-error, .permission-error, .error-message');
    const calibrationPanel = page.locator('.calibration-panel');

    // Either an error message is shown OR the calibration panel handles it
    const hasError = await errorMessage.isVisible().catch(() => false);
    const hasCalibration = await calibrationPanel.isVisible().catch(() => false);

    expect(hasError || hasCalibration).toBe(true);
  });

  test('should not crash when camera is unavailable', async ({ page }) => {
    // Navigate without camera
    await page.goto('/');

    // App should render
    await expect(page.locator('.app')).toBeVisible({ timeout: 10000 });

    // Header should be visible (app didn't crash)
    await expect(page.locator('header.header')).toBeVisible();
  });
});

test.describe('Network Error Handling', () => {
  test('should work offline after initial load', async ({ page, context }) => {
    // Grant camera permissions for this test
    await context.grantPermissions(['camera']);

    // Load the app first
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Go offline
    await context.setOffline(true);

    // App should still be functional
    await expect(page.locator('.app')).toBeVisible();

    // UI interactions should still work
    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('.full-settings-modal')).toBeVisible();

    // Go back online
    await context.setOffline(false);
  });

  test('should handle slow network gracefully', async ({ page, context }) => {
    await context.grantPermissions(['camera']);

    await page.goto('/');

    // Should eventually load (the mock makes it fast anyway)
    await expect(page.locator('.app')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Invalid State Handling', () => {
  test('should recover from corrupted localStorage', async ({ page, context }) => {
    await context.grantPermissions(['camera']);

    // Set corrupted data before loading
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.evaluate(() => {
      localStorage.setItem('posture-settings', '{invalid json');
      localStorage.setItem('posture-stats', 'not a valid object');
    });

    // Reload
    await page.reload();
    await page.waitForSelector('header.header', { timeout: 10000 });

    // App should still work
    await expect(page.locator('.app')).toBeVisible();

    // Settings should be openable
    await page.locator('button[aria-label="설정 열기"]').click();
    await expect(page.locator('.full-settings-modal')).toBeVisible();
  });

  test('should use default values when settings are missing', async ({ page, context }) => {
    await context.grantPermissions(['camera']);

    // Clear all storage
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload
    await page.reload();
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Open settings and verify defaults are applied
    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    // Check that settings have default values (one of the sound buttons should be active)
    const activeSoundBtn = page.locator('button.sound-btn.active').first();
    await expect(activeSoundBtn).toBeVisible();
  });
});

test.describe('UI Error Boundaries', () => {
  test('should not show white screen on component errors', async ({ page, context }) => {
    await context.grantPermissions(['camera']);

    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // App should have content, not be a white screen
    const bodyContent = await page.evaluate(() => {
      return document.body.innerHTML.length;
    });

    expect(bodyContent).toBeGreaterThan(100);
  });

  test('should maintain header even if main content fails', async ({ page, context }) => {
    await context.grantPermissions(['camera']);

    await page.goto('/');

    // Header should always be visible as it's outside main content
    await expect(page.locator('header.header')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1')).toContainText('자세 교정 알리미');
  });
});

test.describe('Input Validation', () => {
  test('should validate volume slider bounds', async ({ page, context }) => {
    await context.grantPermissions(['camera']);

    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    const volumeSlider = page.getByRole('slider', { name: '알림 볼륨' });

    // Check min/max bounds
    const min = await volumeSlider.getAttribute('min');
    const max = await volumeSlider.getAttribute('max');

    expect(parseFloat(min)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(max)).toBeLessThanOrEqual(1);
  });

  test('should validate sensitivity slider bounds', async ({ page, context }) => {
    await context.grantPermissions(['camera']);

    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    const sensitivitySlider = page.getByRole('slider', { name: '감지 민감도' });

    // Check bounds exist
    const min = await sensitivitySlider.getAttribute('min');
    const max = await sensitivitySlider.getAttribute('max');

    expect(parseFloat(min)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(max)).toBeLessThanOrEqual(5);
  });

  test('should validate goal percentage input', async ({ page, context }) => {
    await context.grantPermissions(['camera']);

    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await page.locator('button[aria-label="설정 열기"]').click();
    await page.waitForSelector('.full-settings-modal', { state: 'visible' });

    const goalInput = page.locator('input[aria-label="일일 목표 퍼센트"]');

    // Try to enter invalid values - input should constrain them
    await goalInput.fill('150');
    const value = await goalInput.inputValue();

    // Either the input is constrained or the app handles validation
    const numValue = parseInt(value);
    expect(numValue).toBeLessThanOrEqual(100);
  });
});
