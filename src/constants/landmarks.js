// MediaPipe Pose Landmark indices
export const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
};

// 각 각도별 임계값
export const THRESHOLDS = {
  // 정면 뷰 임계값
  FRONT: {
    SHOULDER_DROP: 0.035,
    SHOULDER_WIDTH: 0.12,
    SHOULDER_TILT: 0.02,
    HEAD_DROP: 0.04,
  },
  // 측면 뷰 임계값
  SIDE: {
    HEAD_FORWARD: 0.04,
    SPINE_CURVE: 0.05,
    SHOULDER_DROP: 0.04,
  },
  // 정측면(대각선) 뷰 임계값
  DIAGONAL: {
    SHOULDER_DROP: 0.045,
    SHOULDER_WIDTH: 0.12,
    SHOULDER_TILT: 0.025,
    HEAD_FORWARD: 0.04,
    HEAD_DROP: 0.05,
    SPINE_ANGLE: 0.06,
    SHOULDER_Z_DIFF: 0.08,
    HEAD_Z_FORWARD: 0.06,
    HIP_SHOULDER_RATIO: 0.12,
  },
  // 후면 뷰 임계값
  BACK: {
    SHOULDER_DROP: 0.035,
    SHOULDER_WIDTH: 0.12,
    SHOULDER_TILT: 0.02,
    HEAD_DROP: 0.05,
  },
  MIN_VISIBILITY: 0.5,
};

// 뷰 모드 한글명
export const VIEW_MODE_LABELS = {
  front: '정면',
  side: '측면',
  diagonal: '정측면',
  back: '후면',
};

// 성능 설정
export const DETECTION_FPS = 15;
export const DETECTION_INTERVAL = 1000 / DETECTION_FPS;
export const SMOOTHING_FACTOR = 0.6;
