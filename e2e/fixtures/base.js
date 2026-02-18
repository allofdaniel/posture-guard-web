import { test as base } from '@playwright/test';

/**
 * Custom test fixture that provides camera mocking and MediaPipe stubbing
 * for E2E tests of the posture monitoring PWA
 */
export const test = base.extend({
  /**
   * Set up page with camera permissions and MediaPipe mocks
   */
  page: async ({ page, baseURL }, pageProvider) => {
  page.on('console', (message) => {
    const text = message.text();
    console.log(`[E2E console ${message.type()}] ${text}`);
  });

  page.on('pageerror', (error) => {
    console.log('[E2E pageerror]', error.message);
    if (error.stack) {
      console.log('[E2E pageerror stack]', error.stack);
    }
  });

    // Grant camera permissions
    await page.context().grantPermissions(['camera']);

    // Inject E2E test mode flag BEFORE page loads
    await page.addInitScript(() => {
      // Set E2E test mode flag - this will be checked by useMediaPipe hook
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
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(200, 150, 240, 180);
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

      // Store mock landmarks - good posture by default
      window.__mockPoseLandmarks = {
        landmarks: [[
          { x: 0.5, y: 0.15, z: 0, visibility: 0.95 }, // Nose
          { x: 0.48, y: 0.14, z: 0, visibility: 0.95 }, // Left eye inner
          { x: 0.47, y: 0.14, z: 0, visibility: 0.95 }, // Left eye
          { x: 0.46, y: 0.14, z: 0, visibility: 0.95 }, // Left eye outer
          { x: 0.52, y: 0.14, z: 0, visibility: 0.95 }, // Right eye inner
          { x: 0.53, y: 0.14, z: 0, visibility: 0.95 }, // Right eye
          { x: 0.54, y: 0.14, z: 0, visibility: 0.95 }, // Right eye outer
          { x: 0.44, y: 0.15, z: 0, visibility: 0.90 }, // Left ear
          { x: 0.56, y: 0.15, z: 0, visibility: 0.90 }, // Right ear
          { x: 0.48, y: 0.18, z: 0, visibility: 0.90 }, // Mouth left
          { x: 0.52, y: 0.18, z: 0, visibility: 0.90 }, // Mouth right
          { x: 0.42, y: 0.35, z: 0, visibility: 0.95 }, // Left shoulder
          { x: 0.58, y: 0.35, z: 0, visibility: 0.95 }, // Right shoulder
          ...Array(20).fill(null).map((_, i) => ({
            x: 0.5, y: 0.5 + (i * 0.02), z: 0, visibility: 0.8
          }))
        ]],
        worldLandmarks: [],
        segmentationMasks: []
      };
    });

    // Override page.goto to always add ?e2e=true parameter
    const originalGoto = page.goto.bind(page);
    page.goto = async (url, options) => {
      // Parse the URL and add e2e=true parameter
      const parsedUrl = new URL(url, baseURL || 'http://localhost:5173');
      parsedUrl.searchParams.set('e2e', 'true');
      return originalGoto(parsedUrl.toString(), options);
    };

    await pageProvider(page);
  },

  /**
   * Context with camera permissions pre-granted
   */
  context: async ({ context }, contextProvider) => {
    await context.grantPermissions(['camera']);
    await contextProvider(context);
  }
});

export { expect } from '@playwright/test';

/**
 * Helper to set mock pose landmarks during test
 * @param {import('@playwright/test').Page} page
 * @param {object} landmarks
 */
export async function setMockLandmarks(page, landmarks) {
  await page.evaluate((landmarksData) => {
    window.__mockPoseLandmarks = landmarksData;
  }, landmarks);
}

/**
 * Generate good posture landmarks
 */
export function getGoodPostureLandmarks() {
  return {
    landmarks: [[
      { x: 0.5, y: 0.15, z: 0, visibility: 0.95 },
      { x: 0.48, y: 0.14, z: 0, visibility: 0.95 },
      { x: 0.47, y: 0.14, z: 0, visibility: 0.95 },
      { x: 0.46, y: 0.14, z: 0, visibility: 0.95 },
      { x: 0.52, y: 0.14, z: 0, visibility: 0.95 },
      { x: 0.53, y: 0.14, z: 0, visibility: 0.95 },
      { x: 0.54, y: 0.14, z: 0, visibility: 0.95 },
      { x: 0.44, y: 0.15, z: 0, visibility: 0.90 },
      { x: 0.56, y: 0.15, z: 0, visibility: 0.90 },
      { x: 0.48, y: 0.18, z: 0, visibility: 0.90 },
      { x: 0.52, y: 0.18, z: 0, visibility: 0.90 },
      { x: 0.42, y: 0.35, z: 0, visibility: 0.95 },
      { x: 0.58, y: 0.35, z: 0, visibility: 0.95 },
      ...Array(20).fill(null).map((_, i) => ({
        x: 0.5, y: 0.5 + (i * 0.02), z: 0, visibility: 0.8
      }))
    ]],
    worldLandmarks: [],
    segmentationMasks: []
  };
}

/**
 * Generate poor posture landmarks (forward head)
 */
export function getPoorPostureLandmarks() {
  return {
    landmarks: [[
      { x: 0.5, y: 0.12, z: -0.15, visibility: 0.95 },
      { x: 0.48, y: 0.11, z: -0.15, visibility: 0.95 },
      { x: 0.47, y: 0.11, z: -0.15, visibility: 0.95 },
      { x: 0.46, y: 0.11, z: -0.15, visibility: 0.95 },
      { x: 0.52, y: 0.11, z: -0.15, visibility: 0.95 },
      { x: 0.53, y: 0.11, z: -0.15, visibility: 0.95 },
      { x: 0.54, y: 0.11, z: -0.15, visibility: 0.95 },
      { x: 0.44, y: 0.12, z: -0.12, visibility: 0.90 },
      { x: 0.56, y: 0.12, z: -0.12, visibility: 0.90 },
      { x: 0.48, y: 0.15, z: -0.15, visibility: 0.90 },
      { x: 0.52, y: 0.15, z: -0.15, visibility: 0.90 },
      { x: 0.42, y: 0.35, z: 0, visibility: 0.95 },
      { x: 0.58, y: 0.35, z: 0, visibility: 0.95 },
      ...Array(20).fill(null).map((_, i) => ({
        x: 0.5, y: 0.5 + (i * 0.02), z: 0, visibility: 0.8
      }))
    ]],
    worldLandmarks: [],
    segmentationMasks: []
  };
}

/**
 * Generate tilted head posture landmarks
 */
export function getTiltedPostureLandmarks() {
  return {
    landmarks: [[
      { x: 0.55, y: 0.15, z: 0, visibility: 0.95 }, // Nose shifted right
      { x: 0.53, y: 0.13, z: 0, visibility: 0.95 },
      { x: 0.52, y: 0.12, z: 0, visibility: 0.95 },
      { x: 0.51, y: 0.12, z: 0, visibility: 0.95 },
      { x: 0.57, y: 0.16, z: 0, visibility: 0.95 },
      { x: 0.58, y: 0.17, z: 0, visibility: 0.95 },
      { x: 0.59, y: 0.17, z: 0, visibility: 0.95 },
      { x: 0.48, y: 0.14, z: 0, visibility: 0.90 },
      { x: 0.62, y: 0.18, z: 0, visibility: 0.90 },
      { x: 0.53, y: 0.18, z: 0, visibility: 0.90 },
      { x: 0.57, y: 0.19, z: 0, visibility: 0.90 },
      { x: 0.42, y: 0.35, z: 0, visibility: 0.95 },
      { x: 0.58, y: 0.35, z: 0, visibility: 0.95 },
      ...Array(20).fill(null).map((_, i) => ({
        x: 0.5, y: 0.5 + (i * 0.02), z: 0, visibility: 0.8
      }))
    ]],
    worldLandmarks: [],
    segmentationMasks: []
  };
}

/**
 * Generate no detection landmarks (empty/low visibility)
 */
export function getNoDetectionLandmarks() {
  return {
    landmarks: [[
      ...Array(33).fill(null).map(() => ({
        x: 0, y: 0, z: 0, visibility: 0.1
      }))
    ]],
    worldLandmarks: [],
    segmentationMasks: []
  };
}

// ============================================
// Page Helper Functions
// ============================================

/**
 * Open settings modal
 * @param {import('@playwright/test').Page} page
 */
export async function openSettings(page) {
  await page.locator('button[aria-label="설정 열기"]').click();
  await page.waitForSelector('.full-settings-modal', { state: 'visible' });
}

/**
 * Open stats modal
 * @param {import('@playwright/test').Page} page
 */
export async function openStats(page) {
  await page.locator('button[aria-label="통계 보기"]').click();
  await page.waitForSelector('.stats-dashboard', { state: 'visible' });
}

/**
 * Close any open modal
 * @param {import('@playwright/test').Page} page
 */
export async function closeModal(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

/**
 * Set theme
 * @param {import('@playwright/test').Page} page
 * @param {'light' | 'dark'} theme
 */
export async function setTheme(page, theme) {
  await openSettings(page);
  await page.locator(`button.theme-btn.${theme}`).click();
  await closeModal(page);
}

/**
 * Set volume
 * @param {import('@playwright/test').Page} page
 * @param {number} value - 0 to 1
 */
export async function setVolume(page, value) {
  await openSettings(page);
  const slider = page.getByRole('slider', { name: '알림 볼륨' });
  await slider.fill(value.toString());
  await closeModal(page);
}

/**
 * Set sensitivity
 * @param {import('@playwright/test').Page} page
 * @param {number} value - 0.5 to 3
 */
export async function setSensitivity(page, value) {
  await openSettings(page);
  const slider = page.getByRole('slider', { name: '감지 민감도' });
  await slider.fill(value.toString());
  await closeModal(page);
}

/**
 * Clear all app data
 * @param {import('@playwright/test').Page} page
 */
export async function clearAppData(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Get current theme
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<'light' | 'dark'>}
 */
export async function getCurrentTheme(page) {
  const bodyClass = await page.evaluate(() => document.body.className);
  return bodyClass.includes('light-theme') ? 'light' : 'dark';
}

/**
 * Wait for app to fully load
 * @param {import('@playwright/test').Page} page
 */
export async function waitForAppLoad(page) {
  await page.waitForSelector('header.header', { timeout: 10000 });
  await page.waitForSelector('.app', { timeout: 10000 });
}

/**
 * Check if modal is open
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isModalOpen(page) {
  const settingsModal = await page.locator('.full-settings-modal').isVisible().catch(() => false);
  const statsModal = await page.locator('.stats-dashboard').isVisible().catch(() => false);
  return settingsModal || statsModal;
}
