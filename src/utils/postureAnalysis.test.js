import { describe, it, expect } from 'vitest';
import {
  isLandmarkValid,
  smoothLandmarks,
  detectCameraAngle,
  analyzeFrontPosture,
  analyzeSidePosture,
  analyzePosture,
} from './postureAnalysis';
import { LANDMARKS } from '../constants';

// Mock landmark factory
const createLandmark = (x, y, z = 0, visibility = 0.9) => ({
  x, y, z, visibility,
});

// Create full landmarks array with defaults
const createLandmarks = (overrides = {}) => {
  const landmarks = Array(33).fill(null).map(() => createLandmark(0.5, 0.5, 0, 0.1));

  // Set default visible landmarks
  landmarks[LANDMARKS.LEFT_SHOULDER] = createLandmark(0.6, 0.4);
  landmarks[LANDMARKS.RIGHT_SHOULDER] = createLandmark(0.4, 0.4);
  landmarks[LANDMARKS.NOSE] = createLandmark(0.5, 0.3);
  landmarks[LANDMARKS.LEFT_EYE] = createLandmark(0.48, 0.28);
  landmarks[LANDMARKS.RIGHT_EYE] = createLandmark(0.52, 0.28);
  landmarks[LANDMARKS.LEFT_EAR] = createLandmark(0.45, 0.3);
  landmarks[LANDMARKS.RIGHT_EAR] = createLandmark(0.55, 0.3);

  // Apply overrides
  Object.entries(overrides).forEach(([key, value]) => {
    landmarks[key] = value;
  });

  return landmarks;
};

describe('isLandmarkValid', () => {
  it('should return true for visible landmark', () => {
    const landmark = createLandmark(0.5, 0.5, 0, 0.9);
    expect(isLandmarkValid(landmark)).toBe(true);
  });

  it('should return false for low visibility landmark', () => {
    const landmark = createLandmark(0.5, 0.5, 0, 0.3);
    expect(isLandmarkValid(landmark)).toBe(false);
  });

  it('should return falsy for null landmark', () => {
    expect(isLandmarkValid(null)).toBeFalsy();
  });

  it('should return falsy for undefined landmark', () => {
    expect(isLandmarkValid(undefined)).toBeFalsy();
  });
});

describe('smoothLandmarks', () => {
  it('should return new landmarks on first call', () => {
    const landmarks = [createLandmark(0.5, 0.5)];
    const result = smoothLandmarks(landmarks, null);
    expect(result[0].x).toBe(0.5);
    expect(result[0].y).toBe(0.5);
  });

  it('should smooth landmarks with previous values', () => {
    const prev = [createLandmark(0.5, 0.5)];
    const curr = [createLandmark(0.6, 0.6)];
    const result = smoothLandmarks(curr, prev);

    // With 0.85 smoothing factor: prev * 0.85 + curr * 0.15
    expect(result[0].x).toBeCloseTo(0.5 * 0.85 + 0.6 * 0.15);
    expect(result[0].y).toBeCloseTo(0.5 * 0.85 + 0.6 * 0.15);
  });

  it('should preserve visibility from new landmarks', () => {
    const prev = [createLandmark(0.5, 0.5, 0, 0.5)];
    const curr = [createLandmark(0.6, 0.6, 0, 0.9)];
    const result = smoothLandmarks(curr, prev);
    expect(result[0].visibility).toBe(0.9);
  });
});

describe('detectCameraAngle', () => {
  it('should detect front view with wide shoulders', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.7, 0.4, 0, 0.9),
      [LANDMARKS.RIGHT_SHOULDER]: createLandmark(0.3, 0.4, 0, 0.9),
    });
    expect(detectCameraAngle(landmarks)).toBe('front');
  });

  it('should detect side view with narrow shoulders', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.52, 0.4, 0, 0.9),
      [LANDMARKS.RIGHT_SHOULDER]: createLandmark(0.48, 0.4, 0, 0.3),
      [LANDMARKS.LEFT_EAR]: createLandmark(0.5, 0.3, 0, 0.9),
      [LANDMARKS.RIGHT_EAR]: createLandmark(0.5, 0.3, 0, 0.1),
    });
    expect(detectCameraAngle(landmarks)).toBe('side');
  });

  it('should detect back view when face not visible', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.6, 0.4, 0, 0.8),
      [LANDMARKS.RIGHT_SHOULDER]: createLandmark(0.4, 0.4, 0, 0.8),
      [LANDMARKS.NOSE]: createLandmark(0.5, 0.3, 0, 0.1),
      [LANDMARKS.LEFT_EYE]: createLandmark(0.48, 0.28, 0, 0.1),
      [LANDMARKS.RIGHT_EYE]: createLandmark(0.52, 0.28, 0, 0.1),
      [LANDMARKS.LEFT_EAR]: createLandmark(0.45, 0.3, 0, 0.1),
      [LANDMARKS.RIGHT_EAR]: createLandmark(0.55, 0.3, 0, 0.1),
    });
    expect(detectCameraAngle(landmarks)).toBe('back');
  });
});

describe('analyzeFrontPosture', () => {
  const createCalibrated = () => ({
    viewMode: 'front',
    shoulderCenterY: 0.4,
    shoulderWidth: 0.2,
    shoulderTilt: 0.01,
    noseX: 0.5,
    noseY: 0.3,
  });

  it('should return good status for proper posture', () => {
    const landmarks = createLandmarks();
    const calibrated = createCalibrated();
    const result = analyzeFrontPosture(landmarks, calibrated, 1.0);
    expect(result.status).toBe('good');
    expect(result.issues).toHaveLength(0);
  });

  it('should detect shoulder drop', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.6, 0.5),
      [LANDMARKS.RIGHT_SHOULDER]: createLandmark(0.4, 0.5),
    });
    const calibrated = createCalibrated();
    const result = analyzeFrontPosture(landmarks, calibrated, 1.0);
    expect(result.issues).toContain('자세 처짐');
  });

  it('should detect forward lean via shoulder width', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.55, 0.4),
      [LANDMARKS.RIGHT_SHOULDER]: createLandmark(0.45, 0.4),
    });
    const calibrated = createCalibrated();
    const result = analyzeFrontPosture(landmarks, calibrated, 1.0);
    expect(result.issues).toContain('앞으로 숙임');
  });

  it('should detect head drop', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.NOSE]: createLandmark(0.5, 0.45),
    });
    const calibrated = createCalibrated();
    const result = analyzeFrontPosture(landmarks, calibrated, 1.0);
    expect(result.issues).toContain('고개 숙임');
  });

  it('should return bad status for multiple issues', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.55, 0.5),
      [LANDMARKS.RIGHT_SHOULDER]: createLandmark(0.45, 0.5),
      [LANDMARKS.NOSE]: createLandmark(0.5, 0.45),
    });
    const calibrated = createCalibrated();
    const result = analyzeFrontPosture(landmarks, calibrated, 1.0);
    expect(result.status).toBe('bad');
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle missing landmarks gracefully', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.6, 0.4, 0, 0.1),
      [LANDMARKS.RIGHT_SHOULDER]: createLandmark(0.4, 0.4, 0, 0.1),
    });
    const calibrated = createCalibrated();
    const result = analyzeFrontPosture(landmarks, calibrated, 1.0);
    expect(result.debug.error).toBe('어깨 감지 안됨');
  });
});

describe('analyzeSidePosture', () => {
  const createSideCalibrated = () => ({
    viewMode: 'side',
    shoulderX: 0.5,
    shoulderY: 0.4,
    earX: 0.45,
    earY: 0.3,
    earShoulderX: -0.05, // ear.x - shoulder.x = 0.45 - 0.5 = -0.05
    earNoseY: 0, // ear.y - nose.y = 0.3 - 0.3 = 0
    noseY: 0.3,
  });

  it('should return good status for proper side posture', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_EAR]: createLandmark(0.45, 0.3, 0, 0.9),
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.5, 0.4, 0, 0.9),
      [LANDMARKS.NOSE]: createLandmark(0.5, 0.3, 0, 0.9),
    });
    const calibrated = createSideCalibrated();
    const result = analyzeSidePosture(landmarks, calibrated, 1.0);
    expect(result.status).toBe('good');
  });

  it('should detect turtle neck', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_EAR]: createLandmark(0.4, 0.3, 0, 0.9),
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.5, 0.4, 0, 0.9),
    });
    const calibrated = createSideCalibrated();
    const result = analyzeSidePosture(landmarks, calibrated, 1.0);
    expect(result.issues).toContain('거북목');
  });
});

describe('analyzePosture', () => {
  it('should delegate to front posture analysis', () => {
    const landmarks = createLandmarks();
    const calibrated = {
      viewMode: 'front',
      shoulderCenterY: 0.4,
      shoulderWidth: 0.2,
      shoulderTilt: 0.01,
      noseY: 0.3,
    };
    const result = analyzePosture(landmarks, calibrated, 1.0, 'front');
    expect(result.debug.viewMode).toBe('정면');
  });

  it('should delegate to side posture analysis', () => {
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_EAR]: createLandmark(0.45, 0.3, 0, 0.9),
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.5, 0.4, 0, 0.9),
    });
    const calibrated = {
      viewMode: 'side',
      shoulderY: 0.4,
      earShoulderX: -0.05,
      earNoseY: 0,
      noseY: 0.3,
    };
    const result = analyzePosture(landmarks, calibrated, 1.0, 'side');
    expect(result.debug.viewMode).toBe('측면');
  });

  it('should return good status for null landmarks', () => {
    const result = analyzePosture(null, {}, 1.0, 'front');
    expect(result.status).toBe('good');
  });

  it('should return good status for null calibrated', () => {
    const landmarks = createLandmarks();
    const result = analyzePosture(landmarks, null, 1.0, 'front');
    expect(result.status).toBe('good');
  });

  it('should respect sensitivity parameter', () => {
    // Create landmarks with moderate deviation from calibrated pose
    const landmarks = createLandmarks({
      [LANDMARKS.LEFT_SHOULDER]: createLandmark(0.6, 0.44), // slight drop
      [LANDMARKS.RIGHT_SHOULDER]: createLandmark(0.4, 0.44),
    });
    const calibrated = {
      shoulderCenterY: 0.4,
      shoulderWidth: 0.2,
      shoulderTilt: 0.01,
      noseY: 0.3,
    };

    // Sensitivity affects threshold: threshold = base_threshold * sens
    // Higher sens = higher threshold = less strict = fewer issues
    // Lower sens = lower threshold = more strict = more issues
    const lowSensResult = analyzePosture(landmarks, calibrated, 0.5, 'front');
    const highSensResult = analyzePosture(landmarks, calibrated, 2.0, 'front');

    // Low sensitivity (stricter) should detect more or equal issues
    expect(lowSensResult.issues.length).toBeGreaterThanOrEqual(highSensResult.issues.length);
  });
});
