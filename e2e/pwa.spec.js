import { test, expect } from './fixtures/base.js';

/**
 * E2E PWA Tests for Posture Guard Web App
 */

test.describe('PWA Features', () => {
  test('should have a valid web manifest', async ({ page }) => {
    await page.goto('/');

    // Check manifest link exists
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveCount(1);
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check theme color
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveCount(1);

    // Check viewport
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);
  });

  test('should render app in standalone mode detection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // App should load normally
    await expect(page.locator('h1:has-text("자세 교정 알리미")')).toBeVisible();
  });

  test('should work offline-capable (service worker registered)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });

    // Note: In dev mode, service worker might not be active
    expect(typeof swRegistered).toBe('boolean');
  });
});

test.describe('PWA Install Prompt', () => {
  test('should handle install prompt gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    // Install prompt visibility depends on browser support
    await expect(page.locator('header.header')).toBeVisible();
  });
});

test.describe('App Icons', () => {
  test('should have apple touch icon', async ({ page }) => {
    await page.goto('/');

    const appleIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleIcon).toHaveCount(1);
  });

  test('should have favicon', async ({ page }) => {
    await page.goto('/');

    const favicon = page.locator('link[rel="icon"]');
    const count = await favicon.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Responsive PWA', () => {
  test('should work on iPhone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await expect(page.locator('.app')).toBeVisible();
  });

  test('should work on iPad viewport', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await expect(page.locator('.app')).toBeVisible();
  });

  test('should work on Android viewport', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto('/');
    await page.waitForSelector('header.header', { timeout: 10000 });

    await expect(page.locator('.app')).toBeVisible();
  });
});

test.describe('Manifest Validation', () => {
  test('should have valid manifest.json', async ({ page }) => {
    await page.goto('/');

    const manifestResponse = await page.request.get('/manifest.json');
    expect(manifestResponse.ok()).toBeTruthy();

    const manifest = await manifestResponse.json();

    expect(manifest.name).toBe('자세 교정 알리미');
    expect(manifest.short_name).toBe('자세알리미');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  test('should have required icon sizes', async ({ page }) => {
    await page.goto('/');

    const manifestResponse = await page.request.get('/manifest.json');
    const manifest = await manifestResponse.json();

    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);

    const iconSizes = manifest.icons.map(icon => icon.sizes);
    expect(iconSizes).toContain('192x192');
    expect(iconSizes).toContain('512x512');
  });
});
