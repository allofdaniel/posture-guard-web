/**
 * MediaPipe mock utilities for E2E testing
 * Provides realistic pose landmark data for different posture scenarios
 */

/**
 * Generate mock pose landmarks for good posture
 */
export function getGoodPostureLandmarks() {
  return {
    landmarks: [
      [
        // Nose (0)
        { x: 0.5, y: 0.15, z: 0, visibility: 0.95 },

        // Left eye inner (1)
        { x: 0.48, y: 0.14, z: 0, visibility: 0.95 },

        // Left eye (2)
        { x: 0.47, y: 0.14, z: 0, visibility: 0.95 },

        // Left eye outer (3)
        { x: 0.46, y: 0.14, z: 0, visibility: 0.95 },

        // Right eye inner (4)
        { x: 0.52, y: 0.14, z: 0, visibility: 0.95 },

        // Right eye (5)
        { x: 0.53, y: 0.14, z: 0, visibility: 0.95 },

        // Right eye outer (6)
        { x: 0.54, y: 0.14, z: 0, visibility: 0.95 },

        // Left ear (7)
        { x: 0.44, y: 0.15, z: 0, visibility: 0.90 },

        // Right ear (8)
        { x: 0.56, y: 0.15, z: 0, visibility: 0.90 },

        // Mouth left (9)
        { x: 0.48, y: 0.18, z: 0, visibility: 0.90 },

        // Mouth right (10)
        { x: 0.52, y: 0.18, z: 0, visibility: 0.90 },

        // Left shoulder (11)
        { x: 0.42, y: 0.35, z: 0, visibility: 0.95 },

        // Right shoulder (12)
        { x: 0.58, y: 0.35, z: 0, visibility: 0.95 },

        // Additional landmarks for complete skeleton
        ...Array(21).fill(null).map((_, i) => ({
          x: 0.5,
          y: 0.5 + (i * 0.02),
          z: 0,
          visibility: 0.8
        }))
      ]
    ],
    worldLandmarks: [],
    segmentationMasks: []
  };
}

/**
 * Generate mock pose landmarks for poor posture (forward head)
 */
export function getPoorPostureLandmarks() {
  return {
    landmarks: [
      [
        // Nose (0) - moved forward
        { x: 0.5, y: 0.12, z: -0.15, visibility: 0.95 },

        // Eyes
        { x: 0.48, y: 0.11, z: -0.15, visibility: 0.95 },
        { x: 0.47, y: 0.11, z: -0.15, visibility: 0.95 },
        { x: 0.46, y: 0.11, z: -0.15, visibility: 0.95 },
        { x: 0.52, y: 0.11, z: -0.15, visibility: 0.95 },
        { x: 0.53, y: 0.11, z: -0.15, visibility: 0.95 },
        { x: 0.54, y: 0.11, z: -0.15, visibility: 0.95 },

        // Ears - forward
        { x: 0.44, y: 0.12, z: -0.12, visibility: 0.90 },
        { x: 0.56, y: 0.12, z: -0.12, visibility: 0.90 },

        // Mouth
        { x: 0.48, y: 0.15, z: -0.15, visibility: 0.90 },
        { x: 0.52, y: 0.15, z: -0.15, visibility: 0.90 },

        // Shoulders - relatively back compared to head
        { x: 0.42, y: 0.35, z: 0, visibility: 0.95 },
        { x: 0.58, y: 0.35, z: 0, visibility: 0.95 },

        // Additional landmarks
        ...Array(21).fill(null).map((_, i) => ({
          x: 0.5,
          y: 0.5 + (i * 0.02),
          z: 0,
          visibility: 0.8
        }))
      ]
    ],
    worldLandmarks: [],
    segmentationMasks: []
  };
}

/**
 * Generate mock pose landmarks for no person detected
 */
export function getNoPersonLandmarks() {
  return {
    landmarks: [],
    worldLandmarks: [],
    segmentationMasks: []
  };
}

/**
 * Inject custom pose landmarks into the page
 * @param {import('@playwright/test').Page} page
 * @param {object} landmarks
 */
export async function injectPoseLandmarks(page, landmarks) {
  await page.evaluate((landmarksData) => {
    window.__mockPoseLandmarks = landmarksData;

    // Override the detectForVideo method if mock exists
    if (window.mockMediaPipe?.PoseLandmarker) {
      const originalPrototype = window.mockMediaPipe.PoseLandmarker.prototype;
      originalPrototype.detectForVideo = function() {
        return window.__mockPoseLandmarks || { landmarks: [], worldLandmarks: [], segmentationMasks: [] };
      };
    }
  }, landmarks);
}

/**
 * Wait for pose detection to be initialized
 * @param {import('@playwright/test').Page} page
 */
export async function waitForPoseDetection(page) {
  await page.waitForFunction(() => {
    return window.poseLandmarker !== undefined || window.__poseDetectorReady === true;
  }, { timeout: 10000 });
}

/**
 * Simulate good posture session
 * @param {import('@playwright/test').Page} page
 * @param {number} durationSeconds
 */
export async function simulateGoodPostureSession(page, durationSeconds = 5) {
  await injectPoseLandmarks(page, getGoodPostureLandmarks());
  await page.waitForTimeout(durationSeconds * 1000);
}

/**
 * Simulate poor posture session
 * @param {import('@playwright/test').Page} page
 * @param {number} durationSeconds
 */
export async function simulatePoorPostureSession(page, durationSeconds = 5) {
  await injectPoseLandmarks(page, getPoorPostureLandmarks());
  await page.waitForTimeout(durationSeconds * 1000);
}
